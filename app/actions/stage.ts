"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { gateBlockers, nextStage } from "@/lib/stages";
import type { Deal, EvidenceItem, StageOutput } from "@/lib/types";

export interface StageActionResult {
  error: string | null;
  blockers?: string[];
  ok?: boolean;
}

async function loadDealContext(dealId: string) {
  const supabase = await createClient();
  const [dealRes, evidenceRes, outputsRes] = await Promise.all([
    supabase.from("deals").select("*").eq("id", dealId).single(),
    supabase.from("evidence_items").select("*").eq("deal_id", dealId),
    supabase.from("stage_outputs").select("*").eq("deal_id", dealId),
  ]);
  const deal = (dealRes.data ?? null) as Deal | null;
  const evidence = (evidenceRes.data ?? []) as EvidenceItem[];
  const outputs = (outputsRes.data ?? []) as StageOutput[];
  return { supabase, deal, evidence, outputs };
}

/**
 * Confirm an AI stage output (medium risk: named human confirmation event).
 * Stores the human-edited version when it differs from the AI output.
 */
export async function confirmStageOutput(input: {
  dealId: string;
  stageOutputId: string;
  confirmedBy: string;
  editedOutput?: Record<string, unknown> | null;
}): Promise<StageActionResult> {
  const { dealId, stageOutputId, confirmedBy, editedOutput } = input;
  if (!confirmedBy.trim()) return { error: "A named confirmer is required." };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("stage_outputs")
    .select("*")
    .eq("id", stageOutputId)
    .single();
  if (error || !row) return { error: "Stage output not found." };
  const output = row as StageOutput;
  if (output.deal_id !== dealId) return { error: "Stage output does not belong to this deal." };

  const edited =
    editedOutput != null && JSON.stringify(editedOutput) !== JSON.stringify(output.ai_output);

  const { error: updateError } = await supabase
    .from("stage_outputs")
    .update({
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
      ai_output_review_status: edited ? "edited" : "confirmed",
      human_edited_output: edited ? editedOutput : null,
    })
    .eq("id", stageOutputId);
  if (updateError) return { error: `Could not confirm: ${updateError.message}` };

  if (edited) {
    await writeAudit({
      deal_id: dealId,
      event_type: "human_edit",
      actor: confirmedBy,
      prompt_template_version: output.prompt_template_version,
      ai_output_snapshot: output.ai_output,
      human_edit_snapshot: editedOutput,
      metadata: { stage: output.stage, stage_output_id: stageOutputId },
    });
  }

  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

/**
 * Advance a deal to the next stage. Server-side gate enforcement: refuses
 * with explicit blockers when any gate condition is unmet.
 */
export async function advanceStage(input: {
  dealId: string;
  actor: string;
}): Promise<StageActionResult> {
  const { dealId, actor } = input;
  if (!actor.trim()) return { error: "A named actor is required to advance a stage." };

  const { supabase, deal, evidence, outputs } = await loadDealContext(dealId);
  if (!deal) return { error: "Deal not found." };

  const to = nextStage(deal.stage);
  if (!to) return { error: `No stage after ${deal.stage}.` };

  const confirmedStageKeys = new Set(
    outputs.filter((o) => o.confirmed_at != null).map((o) => o.stage),
  );
  const blockers = gateBlockers({ deal, evidence, confirmedStageKeys }, to);
  if (blockers.length > 0) {
    return { error: "Advance blocked by gate checks.", blockers };
  }

  const { error } = await supabase
    .from("deals")
    .update({
      stage: to,
      last_stage_change_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);
  if (error) return { error: `Could not advance: ${error.message}` };

  await writeAudit({
    deal_id: dealId,
    event_type: "stage_transition",
    actor,
    metadata: { from: deal.stage, to },
  });

  revalidatePath("/");
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

/**
 * Stage 0 Triage verdict: confirm the AI output and apply the verdict.
 * Pursue advances to Research; Park parks the deal (mandatory revisit date);
 * Decline kills the deal (logged, never deleted).
 */
export async function confirmTriage(input: {
  dealId: string;
  stageOutputId: string;
  confirmedBy: string;
  verdict: "Pursue" | "Park" | "Decline";
  editedOutput?: Record<string, unknown> | null;
  revisitDate?: string;
}): Promise<StageActionResult> {
  const { dealId, stageOutputId, confirmedBy, verdict, editedOutput, revisitDate } = input;
  if (!["Pursue", "Park", "Decline"].includes(verdict)) return { error: "Invalid verdict." };
  if (verdict === "Park" && !revisitDate)
    return { error: "A revisit date is mandatory when parking a deal." };

  const confirm = await confirmStageOutput({ dealId, stageOutputId, confirmedBy, editedOutput });
  if (confirm.error) return confirm;

  const { supabase, deal } = await loadDealContext(dealId);
  if (!deal) return { error: "Deal not found." };

  if (verdict === "Pursue") {
    return advanceStage({ dealId, actor: confirmedBy });
  }

  const patch =
    verdict === "Park"
      ? { status: "Parked", revisit_date: revisitDate, updated_at: new Date().toISOString() }
      : { status: "Killed", updated_at: new Date().toISOString() };
  const { error } = await supabase.from("deals").update(patch).eq("id", dealId);
  if (error) return { error: `Could not apply verdict: ${error.message}` };

  await writeAudit({
    deal_id: dealId,
    event_type: "stage_transition",
    actor: confirmedBy,
    metadata: { verdict, status: patch.status, revisit_date: revisitDate ?? null },
  });
  revalidatePath("/");
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

/** Stage 1 gate: record the group conflict check with a named confirmer. */
export async function setConflictCheck(input: {
  dealId: string;
  status: "Pending" | "Cleared" | "Unknown";
  confirmedBy: string;
}): Promise<StageActionResult> {
  const { dealId, status, confirmedBy } = input;
  if (!["Pending", "Cleared", "Unknown"].includes(status)) return { error: "Invalid status." };
  if (status === "Cleared" && !confirmedBy.trim())
    return { error: "A named confirmer is required to clear the conflict check." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({
      conflict_check_status: status,
      conflict_check_confirmed_by: confirmedBy || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);
  if (error) return { error: error.message };

  await writeAudit({
    deal_id: dealId,
    event_type: "gate_approval",
    actor: confirmedBy || "unknown",
    metadata: { gate: "conflict_check", status },
  });
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

/**
 * Stage 2: the owner selects one of the three AI options and must supply a
 * value hypothesis, confidence and deposit impact before Proposal opens.
 */
export async function confirmOptionSelection(input: {
  dealId: string;
  stageOutputId: string;
  confirmedBy: string;
  selectedIndex: number;
  valueRm: string;
  valueBasis: string;
  confidence: "High" | "Med" | "Low";
  depositImpact: "Positive" | "Neutral" | "None";
}): Promise<StageActionResult> {
  const {
    dealId,
    stageOutputId,
    confirmedBy,
    selectedIndex,
    valueRm,
    valueBasis,
    confidence,
    depositImpact,
  } = input;

  const rm = Number(String(valueRm).replace(/[, ]/g, ""));
  if (!valueRm || !Number.isFinite(rm) || rm <= 0)
    return { error: "A value hypothesis amount (RM/year) is required." };
  if (!valueBasis.trim())
    return { error: "A one-line basis for the value hypothesis is required." };
  if (!["High", "Med", "Low"].includes(confidence)) return { error: "Invalid confidence." };
  if (!["Positive", "Neutral", "None"].includes(depositImpact))
    return { error: "Invalid deposit impact." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("stage_outputs")
    .select("*")
    .eq("id", stageOutputId)
    .single();
  if (!row) return { error: "Options output not found." };
  const output = row as StageOutput;
  const options = (output.ai_output?.options ?? []) as Record<string, unknown>[];
  if (selectedIndex < 0 || selectedIndex >= options.length)
    return { error: "Select one of the generated options." };

  const edited = {
    ...(output.ai_output ?? {}),
    selected_option_index: selectedIndex,
    selected_option: options[selectedIndex],
  };

  const confirm = await confirmStageOutput({
    dealId,
    stageOutputId,
    confirmedBy,
    editedOutput: edited,
  });
  if (confirm.error) return confirm;

  const { error } = await supabase
    .from("deals")
    .update({
      value_hypothesis_rm: rm,
      value_hypothesis_basis: valueBasis.trim(),
      confidence,
      deposit_impact: depositImpact,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);
  if (error) return { error: `Could not save value hypothesis: ${error.message}` };

  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

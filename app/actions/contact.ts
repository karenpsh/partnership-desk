"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import type { StageActionResult } from "./stage";
import type { StageOutput } from "@/lib/types";

const ASK_TYPES = ["Time", "Information", "Management support"];
const ASK_DOMAINS = ["Business", "Tech"];
const RISK_LEVELS = ["L", "M", "H"];
const CHANNELS = ["Call", "Email", "Meeting", "Other"];

/**
 * Save an owner-confirmed contact report (medium risk: AI structures the
 * fields, the owner confirms before write). Auto-creates and routes an
 * escalation when the ask is Management support.
 */
export async function createContactReport(input: {
  dealId: string;
  stageOutputId?: string | null;
  contactDate: string;
  channel: string;
  rawNotes: string;
  challenge: string;
  askType: string;
  askDomain: string;
  nextStep: string;
  riskLevel: string;
  followupInterval: string;
  nextFollowupDate: string;
  confirmedBy: string;
}): Promise<StageActionResult & { escalationCreated?: boolean }> {
  const {
    dealId,
    stageOutputId,
    contactDate,
    channel,
    rawNotes,
    challenge,
    askType,
    askDomain,
    nextStep,
    riskLevel,
    followupInterval,
    nextFollowupDate,
    confirmedBy,
  } = input;

  if (!contactDate) return { error: "Contact date is required." };
  if (!CHANNELS.includes(channel)) return { error: "Invalid channel." };
  if (!ASK_TYPES.includes(askType)) return { error: "Invalid ask type." };
  if (!ASK_DOMAINS.includes(askDomain)) return { error: "Invalid ask domain." };
  if (!RISK_LEVELS.includes(riskLevel)) return { error: "Invalid risk level." };
  if (!confirmedBy.trim()) return { error: "A named confirmer is required before saving." };

  const interval = followupInterval ? parseInt(followupInterval, 10) : null;
  if (followupInterval && (!Number.isFinite(interval) || interval! <= 0))
    return { error: "Follow-up interval must be a positive number of days." };

  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).single();
  if (!deal) return { error: "Deal not found." };

  // Pull AI provenance from the generation record when there is one.
  let aiConfidence: number | null = null;
  let aiSummary: string | null = null;
  let promptVersion: string | null = null;
  if (stageOutputId) {
    const { data: so } = await supabase
      .from("stage_outputs")
      .select("*")
      .eq("id", stageOutputId)
      .single();
    if (so) {
      const output = so as StageOutput;
      aiConfidence = output.ai_output_confidence;
      promptVersion = output.prompt_template_version;
      aiSummary = String(
        (output.ai_output as { two_line_summary?: string })?.two_line_summary ?? "",
      ) || null;
      await supabase
        .from("stage_outputs")
        .update({
          confirmed_by: confirmedBy,
          confirmed_at: new Date().toISOString(),
          ai_output_review_status: "confirmed",
        })
        .eq("id", stageOutputId);
    }
  }

  const { data: report, error } = await supabase
    .from("contact_reports")
    .insert({
      deal_id: dealId,
      contact_date: contactDate,
      channel,
      raw_notes: rawNotes || null,
      ai_challenge: challenge || null,
      ai_challenge_source: stageOutputId ? "llm" : "manual",
      ai_challenge_confidence: aiConfidence,
      ai_challenge_review_status: "confirmed",
      ask_type: askType,
      ask_domain: askDomain,
      next_step: nextStep || null,
      risk_level: riskLevel,
      recommended_followup_interval: interval,
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error || !report) return { error: `Could not save contact report: ${error?.message}` };

  await writeAudit({
    deal_id: dealId,
    event_type: "contact_report_created",
    actor: confirmedBy,
    prompt_template_version: promptVersion,
    metadata: { contact_report_id: report.id, askType, riskLevel, channel },
  });

  // Owner-confirmed follow-up date drives the notification engine.
  if (nextFollowupDate) {
    await supabase
      .from("deals")
      .update({ next_followup_date: nextFollowupDate, updated_at: new Date().toISOString() })
      .eq("id", dealId);
  }

  // Auto-escalation on Management support (medium risk: created then routed).
  let escalationCreated = false;
  if (askType === "Management support") {
    const summary =
      aiSummary ??
      `${deal.company}: management support requested. ${nextStep || challenge || ""}`.trim();
    const { data: esc, error: escError } = await supabase
      .from("escalations")
      .insert({
        deal_id: dealId,
        contact_report_id: report.id,
        ai_summary: summary,
        ai_summary_source: aiSummary ? "llm" : "rule",
        ai_summary_review_status: "unreviewed",
        assigned_to_role: "Approver",
        status: "Open",
      })
      .select()
      .single();
    if (!escError && esc) {
      escalationCreated = true;
      await writeAudit({
        deal_id: dealId,
        event_type: "escalation_created",
        actor: "system",
        metadata: {
          escalation_id: esc.id,
          contact_report_id: report.id,
          assigned_to_role: "Approver",
          summary,
        },
      });
    }
  }

  revalidatePath("/");
  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/notifications");
  return { error: null, ok: true, escalationCreated };
}

/** Approver resolves an escalation with notes; tracked to resolution. */
export async function resolveEscalation(input: {
  escalationId: string;
  resolvedBy: string;
  notes: string;
}): Promise<StageActionResult> {
  const { escalationId, resolvedBy, notes } = input;
  if (!resolvedBy.trim()) return { error: "A named resolver is required." };

  const supabase = await createClient();
  const { data: esc } = await supabase
    .from("escalations")
    .select("*")
    .eq("id", escalationId)
    .single();
  if (!esc) return { error: "Escalation not found." };

  const { error } = await supabase
    .from("escalations")
    .update({
      status: "Resolved",
      resolved_at: new Date().toISOString(),
      resolution_notes: notes.trim() || null,
    })
    .eq("id", escalationId);
  if (error) return { error: error.message };

  await writeAudit({
    deal_id: esc.deal_id,
    event_type: "gate_approval",
    actor: resolvedBy,
    metadata: { action: "escalation_resolved", escalation_id: escalationId, notes },
  });
  revalidatePath("/");
  revalidatePath("/notifications");
  revalidatePath(`/deals/${esc.deal_id}`);
  return { error: null, ok: true };
}

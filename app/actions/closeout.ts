"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import type { StageActionResult } from "./stage";

/**
 * High risk: named Approver signs off the Legal & Shariah gate. Recorded in
 * audit_events; advancing past the stage is blocked until this is done.
 */
export async function approveLegalShariahGate(input: {
  dealId: string;
  approvedBy: string;
  notes?: string;
}): Promise<StageActionResult> {
  const { dealId, approvedBy, notes } = input;
  if (!approvedBy.trim())
    return { error: "A named Approver is required for the Legal & Shariah gate." };

  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).single();
  if (!deal) return { error: "Deal not found." };
  if (deal.stage !== "Legal & Shariah")
    return { error: "The deal is not at the Legal & Shariah gate." };

  const { error } = await supabase
    .from("deals")
    .update({ gate: "Legal & Shariah approved", updated_at: new Date().toISOString() })
    .eq("id", dealId);
  if (error) return { error: error.message };

  await writeAudit({
    deal_id: dealId,
    event_type: "gate_approval",
    actor: approvedBy,
    metadata: { gate: "Legal & Shariah", notes: notes ?? null },
  });
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

const OUTCOMES = ["Won", "Lost", "Parked"] as const;

/**
 * Stage 6 Closeout: outcome form. The transferable lesson is mandatory;
 * the lesson row feeds the knowledge base, and the deal reaches its
 * terminal status (Won -> Live, Lost -> Killed, Parked -> Parked with a
 * mandatory revisit date).
 */
export async function submitCloseout(input: {
  dealId: string;
  outcome: string;
  whatWorked: string;
  whatStalled: string;
  dealShape: string;
  transferableLesson: string;
  tags: string;
  revisitDate?: string;
  submittedBy: string;
}): Promise<StageActionResult> {
  const {
    dealId,
    outcome,
    whatWorked,
    whatStalled,
    dealShape,
    transferableLesson,
    tags,
    revisitDate,
    submittedBy,
  } = input;

  if (!OUTCOMES.includes(outcome as (typeof OUTCOMES)[number]))
    return { error: "Outcome must be Won, Lost or Parked." };
  if (!transferableLesson.trim())
    return { error: "One transferable lesson is mandatory to complete closeout." };
  if (!submittedBy.trim()) return { error: "A named submitter is required." };
  if (outcome === "Parked" && !revisitDate)
    return { error: "A revisit date is mandatory when the outcome is Parked." };

  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).single();
  if (!deal) return { error: "Deal not found." };

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({
      deal_id: dealId,
      vertical: deal.vertical,
      outcome,
      what_worked: whatWorked.trim() || null,
      what_stalled: whatStalled.trim() || null,
      deal_shape: dealShape.trim() || null,
      transferable_lesson: transferableLesson.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    })
    .select()
    .single();
  if (lessonError || !lesson) return { error: `Could not file lesson: ${lessonError?.message}` };

  const status = outcome === "Won" ? "Live" : outcome === "Lost" ? "Killed" : "Parked";
  const { error: dealError } = await supabase
    .from("deals")
    .update({
      status,
      revisit_date: outcome === "Parked" ? revisitDate : deal.revisit_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);
  if (dealError) return { error: `Lesson filed but status update failed: ${dealError.message}` };

  await writeAudit({
    deal_id: dealId,
    event_type: "lesson_filed",
    actor: submittedBy,
    metadata: { lesson_id: lesson.id, outcome, status },
  });

  revalidatePath("/");
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

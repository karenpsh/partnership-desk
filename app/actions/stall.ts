"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { getSessionUser, isHead } from "@/lib/auth";
import type { StageActionResult } from "./stage";

const DECISIONS = ["Advance", "Park", "Kill"] as const;

/**
 * High risk: the Head (not the deal owner) decides a stalled deal's fate.
 * Advance keeps the deal Active and resets the stall clock; Park requires a
 * new revisit date; Kill is terminal (logged, never deleted).
 */
export async function decideStallReview(input: {
  stallReviewId: string;
  decision: string;
  newRevisitDate?: string;
  decidedBy: string;
}): Promise<StageActionResult> {
  const { stallReviewId, decision, newRevisitDate } = input;
  // High risk, Head-only: the deal owner does not hold the casting vote on
  // their own stalled deal. Enforced server-side and by RLS (stall_reviews
  // update is Head-only).
  const user = await getSessionUser();
  if (!user || !isHead(user.role))
    return { error: "Only the Head of Partnerships may decide a stall review." };
  const decidedBy = user.fullName;
  if (!DECISIONS.includes(decision as (typeof DECISIONS)[number]))
    return { error: "Decision must be Advance, Park or Kill." };
  if (decision === "Park" && !newRevisitDate)
    return { error: "A new revisit date is required to park a stalled deal." };

  const supabase = await createClient();
  const { data: review } = await supabase
    .from("stall_reviews")
    .select("*")
    .eq("id", stallReviewId)
    .single();
  if (!review) return { error: "Stall review not found." };
  if (review.decision) return { error: "This stall review has already been decided." };

  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", review.deal_id)
    .single();
  if (!deal) return { error: "Deal not found." };
  if (deal.owner_name && deal.owner_name.trim().toLowerCase() === decidedBy.trim().toLowerCase())
    return {
      error: "The deal owner cannot decide their own stalled deal — the Head holds the casting vote.",
    };

  const { error: reviewError } = await supabase
    .from("stall_reviews")
    .update({
      decision,
      new_revisit_date: decision === "Park" ? newRevisitDate : null,
      decided_by: decidedBy.trim(),
      decided_at: new Date().toISOString(),
    })
    .eq("id", stallReviewId);
  if (reviewError) return { error: reviewError.message };

  const dealPatch =
    decision === "Advance"
      ? { last_stage_change_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : decision === "Park"
        ? { status: "Parked", revisit_date: newRevisitDate, updated_at: new Date().toISOString() }
        : { status: "Killed", updated_at: new Date().toISOString() };
  const { error: dealError } = await supabase.from("deals").update(dealPatch).eq("id", deal.id);
  if (dealError) return { error: `Review saved but deal update failed: ${dealError.message}` };

  await writeAudit({
    deal_id: deal.id,
    event_type: "stall_decision",
    actor: decidedBy.trim(),
    metadata: { stall_review_id: stallReviewId, decision, new_revisit_date: newRevisitDate ?? null },
  });

  revalidatePath("/");
  revalidatePath(`/deals/${deal.id}`);
  revalidatePath("/notifications");
  return { error: null, ok: true };
}

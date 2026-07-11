"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { getSessionUser, isHead } from "@/lib/auth";
import { VERTICALS } from "@/lib/stages";
import type { StageActionResult } from "./stage";
import type { Deal } from "@/lib/types";

/**
 * Head confirms a pending inbound deal: it becomes Active and enters the
 * pipeline at Stage 0 Triage, optionally reassigned to an owner and vertical.
 * Medium-risk agentic action — a named human (the Head) activates it.
 */
export async function confirmInbound(input: {
  dealId: string;
  company: string;
  vertical: string;
  ownerId: string; // profile id to assign, or "" to self-assign to the Head
}): Promise<StageActionResult> {
  const { dealId, company, vertical, ownerId } = input;
  const user = await getSessionUser();
  if (!user || !isHead(user.role))
    return { error: "Only the Head of Partnerships may confirm inbound deals." };
  if (!company.trim()) return { error: "Company is required." };
  if (!VERTICALS.includes(vertical as (typeof VERTICALS)[number]))
    return { error: "Choose one of the seven verticals." };

  const supabase = await createClient();
  const { data: dealRow } = await supabase.from("deals").select("*").eq("id", dealId).single();
  if (!dealRow) return { error: "Inbound deal not found." };
  const deal = dealRow as Deal;
  if (deal.status !== "PendingInbound")
    return { error: "This deal is not awaiting inbound confirmation." };

  // Resolve owner: a chosen Manager/Head profile, else the confirming Head.
  let ownerUserId = user.id;
  let ownerName = user.fullName;
  if (ownerId && ownerId !== user.id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", ownerId)
      .single();
    if (prof) {
      ownerUserId = prof.id as string;
      ownerName = (prof.full_name as string) ?? ownerName;
    }
  }

  const { error } = await supabase
    .from("deals")
    .update({
      company: company.trim(),
      vertical,
      status: "Active",
      user_id: ownerUserId,
      owner_name: ownerName,
      last_stage_change_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);
  if (error) return { error: `Could not confirm: ${error.message}` };

  await writeAudit({
    deal_id: dealId,
    event_type: "inbound_confirmed",
    actor: user.fullName,
    metadata: { company: company.trim(), vertical, owner: ownerName },
  });

  revalidatePath("/");
  revalidatePath("/inbound");
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

/** Head declines a pending inbound deal: logged as Killed, never deleted. */
export async function declineInbound(input: {
  dealId: string;
  reason: string;
}): Promise<StageActionResult> {
  const { dealId, reason } = input;
  const user = await getSessionUser();
  if (!user || !isHead(user.role))
    return { error: "Only the Head of Partnerships may decline inbound deals." };

  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("status").eq("id", dealId).single();
  if (!deal) return { error: "Inbound deal not found." };
  if (deal.status !== "PendingInbound")
    return { error: "This deal is not awaiting inbound confirmation." };

  const { error } = await supabase
    .from("deals")
    .update({ status: "Killed", updated_at: new Date().toISOString() })
    .eq("id", dealId);
  if (error) return { error: error.message };

  await writeAudit({
    deal_id: dealId,
    event_type: "inbound_declined",
    actor: user.fullName,
    metadata: { reason: reason.trim() || null },
  });
  revalidatePath("/inbound");
  return { error: null, ok: true };
}

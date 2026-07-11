"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { VERTICALS } from "@/lib/stages";
import type { Deal } from "@/lib/types";

export interface ActionState {
  error: string | null;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

const PRIORITIES = ["High", "Medium", "Low"];
const CONFIDENCES = ["High", "Med", "Low"];
const DEPOSIT_IMPACTS = ["Positive", "Neutral", "None"];
const STATUSES = ["Active", "Parked", "Killed", "Live"];
const CONFLICT_STATUSES = ["Pending", "Cleared", "Unknown"];

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function createDeal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const company = str(formData, "company");
  const vertical = str(formData, "vertical");
  const source = str(formData, "source");
  const owner_name = str(formData, "owner_name");
  const industry = str(formData, "industry");
  const priority = str(formData, "priority") || "Medium";

  const fieldErrors: Record<string, string> = {};
  if (!company) fieldErrors.company = "Company is required.";
  if (!VERTICALS.includes(vertical as (typeof VERTICALS)[number]))
    fieldErrors.vertical = "Choose one of the seven verticals.";
  if (source !== "Inbound" && source !== "Outbound")
    fieldErrors.source = "Source must be Inbound or Outbound.";
  if (!owner_name) fieldErrors.owner_name = "Owner is required.";
  if (!PRIORITIES.includes(priority)) fieldErrors.priority = "Invalid priority.";
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const stage = source === "Inbound" ? "Triage" : "Research";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({
      company,
      industry: industry || null,
      vertical,
      source,
      owner_name,
      priority,
      stage,
      status: "Active",
      confidence: "Low",
      deposit_impact: "Neutral",
      conflict_check_status: "Pending",
      last_stage_change_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    return { error: `Could not create deal: ${error?.message ?? "unknown error"}` };
  }

  await writeAudit({
    deal_id: data.id,
    event_type: "deal_created",
    actor: owner_name,
    metadata: { company, vertical, source, stage },
  });

  revalidatePath("/");
  redirect(`/deals/${data.id}`);
}

export async function updateDeal(
  dealId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .single();
  if (fetchError || !existing) return { error: "Deal not found." };
  const deal = existing as Deal;

  const company = str(formData, "company");
  const vertical = str(formData, "vertical");
  const owner_name = str(formData, "owner_name");
  const priority = str(formData, "priority");
  const confidence = str(formData, "confidence");
  const deposit_impact = str(formData, "deposit_impact");
  const status = str(formData, "status");
  const conflict_check_status = str(formData, "conflict_check_status");
  const conflict_check_confirmed_by = str(formData, "conflict_check_confirmed_by");
  const value_hypothesis_rm_raw = str(formData, "value_hypothesis_rm");
  const revisit_date = str(formData, "revisit_date");
  const next_followup_date = str(formData, "next_followup_date");

  const fieldErrors: Record<string, string> = {};
  if (!company) fieldErrors.company = "Company is required.";
  if (!VERTICALS.includes(vertical as (typeof VERTICALS)[number]))
    fieldErrors.vertical = "Choose one of the seven verticals.";
  if (!owner_name) fieldErrors.owner_name = "Owner is required.";
  if (!PRIORITIES.includes(priority)) fieldErrors.priority = "Invalid priority.";
  if (!CONFIDENCES.includes(confidence)) fieldErrors.confidence = "Invalid confidence.";
  if (!DEPOSIT_IMPACTS.includes(deposit_impact))
    fieldErrors.deposit_impact = "Invalid deposit impact.";
  if (!STATUSES.includes(status)) fieldErrors.status = "Invalid status.";
  if (!CONFLICT_STATUSES.includes(conflict_check_status))
    fieldErrors.conflict_check_status = "Invalid conflict check status.";
  if (conflict_check_status === "Cleared" && !conflict_check_confirmed_by)
    fieldErrors.conflict_check_confirmed_by =
      "A named confirmer is required to clear the conflict check.";
  if (status === "Parked" && !revisit_date)
    fieldErrors.revisit_date = "A revisit date is mandatory when a deal is Parked.";

  let value_hypothesis_rm: number | null = null;
  if (value_hypothesis_rm_raw) {
    value_hypothesis_rm = Number(value_hypothesis_rm_raw.replace(/[, ]/g, ""));
    if (!Number.isFinite(value_hypothesis_rm) || value_hypothesis_rm < 0)
      fieldErrors.value_hypothesis_rm = "Value must be a non-negative number (RM/year).";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const patch = {
    company,
    industry: str(formData, "industry") || null,
    vertical,
    owner_name,
    priority,
    confidence,
    deposit_impact,
    status,
    conflict_check_status,
    conflict_check_confirmed_by: conflict_check_confirmed_by || null,
    value_hypothesis_rm,
    value_hypothesis_basis: str(formData, "value_hypothesis_basis") || null,
    next_followup_date: next_followup_date || null,
    revisit_date: revisit_date || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("deals").update(patch).eq("id", dealId);
  if (error) return { error: `Save failed: ${error.message}` };

  const changed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "updated_at") continue;
    const before = (deal as unknown as Record<string, unknown>)[k];
    if (String(before ?? "") !== String(v ?? "")) changed[k] = { from: before, to: v };
  }
  await writeAudit({
    deal_id: dealId,
    event_type: "deal_updated",
    actor: owner_name,
    metadata: { changed },
  });

  revalidatePath("/");
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

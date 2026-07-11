"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import type { StageActionResult } from "./stage";

const EVIDENCE_TYPES = ["Verified", "Inferred", "Claimed"];

export async function addEvidence(input: {
  dealId: string;
  claim: string;
  evidenceType: string;
  sourceUrl?: string;
  isMaterial: boolean;
  actor: string;
}): Promise<StageActionResult> {
  const { dealId, claim, evidenceType, sourceUrl, isMaterial, actor } = input;
  if (!claim.trim()) return { error: "The claim text is required." };
  if (!EVIDENCE_TYPES.includes(evidenceType)) return { error: "Invalid evidence type." };
  if (evidenceType === "Verified" && !sourceUrl?.trim())
    return { error: "A source URL is required for Verified evidence." };

  const supabase = await createClient();
  const { error } = await supabase.from("evidence_items").insert({
    deal_id: dealId,
    claim: claim.trim(),
    evidence_type: evidenceType,
    source_url: sourceUrl?.trim() || null,
    is_material: isMaterial,
    review_status: "unreviewed",
  });
  if (error) return { error: error.message };

  await writeAudit({
    deal_id: dealId,
    event_type: "evidence_updated",
    actor,
    metadata: { action: "added", claim, evidenceType, isMaterial },
  });
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

export async function setEvidenceType(input: {
  dealId: string;
  evidenceId: string;
  evidenceType: string;
  sourceUrl?: string;
  actor: string;
}): Promise<StageActionResult> {
  const { dealId, evidenceId, evidenceType, sourceUrl, actor } = input;
  if (!EVIDENCE_TYPES.includes(evidenceType)) return { error: "Invalid evidence type." };
  if (evidenceType === "Verified" && !sourceUrl?.trim())
    return { error: "A source URL is required to mark evidence Verified." };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("evidence_items")
    .select("*")
    .eq("id", evidenceId)
    .single();
  if (!before || before.deal_id !== dealId) return { error: "Evidence item not found." };

  const { error } = await supabase
    .from("evidence_items")
    .update({
      evidence_type: evidenceType,
      source_url: sourceUrl?.trim() || before.source_url,
      review_status: "reviewed",
    })
    .eq("id", evidenceId);
  if (error) return { error: error.message };

  await writeAudit({
    deal_id: dealId,
    event_type: "evidence_updated",
    actor,
    metadata: {
      action: "type_changed",
      evidence_id: evidenceId,
      from: before.evidence_type,
      to: evidenceType,
    },
  });
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

/** High risk: Head-only waiver of a material Claimed item, with a logged reason. */
export async function waiveClaimedEvidence(input: {
  dealId: string;
  evidenceId: string;
  waivedBy: string;
  reason: string;
}): Promise<StageActionResult> {
  const { dealId, evidenceId, waivedBy, reason } = input;
  if (!waivedBy.trim()) return { error: "The Head's name is required to waive a Claimed block." };
  if (!reason.trim()) return { error: "A reason is required and will be logged." };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("evidence_items")
    .select("*")
    .eq("id", evidenceId)
    .single();
  if (!item || item.deal_id !== dealId) return { error: "Evidence item not found." };

  const { error } = await supabase
    .from("evidence_items")
    .update({ waived_by: waivedBy.trim(), waive_reason: reason.trim() })
    .eq("id", evidenceId);
  if (error) return { error: error.message };

  await writeAudit({
    deal_id: dealId,
    event_type: "claimed_block_waived",
    actor: waivedBy,
    metadata: { evidence_id: evidenceId, claim: item.claim, reason: reason.trim() },
  });
  revalidatePath(`/deals/${dealId}`);
  return { error: null, ok: true };
}

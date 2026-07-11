"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";
import { getSessionUser, isAdmin } from "@/lib/auth";
import type { StageActionResult } from "./stage";
import type { PromptTemplate } from "@/lib/types";

const ROLES = ["Manager", "Head", "Approver", "Reviewer", "Admin"];

/**
 * Admin publishes a new version of a stage prompt template. Never overwrites:
 * the current active row is deactivated and a new incremented version is
 * inserted, so the full history is retained and auditable.
 */
export async function savePromptTemplateVersion(input: {
  stage: string;
  templateBody: string;
}): Promise<StageActionResult> {
  const { stage, templateBody } = input;
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role))
    return { error: "Only the Admin role may edit prompt templates." };
  if (!templateBody.trim()) return { error: "The template body cannot be empty." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("prompt_templates")
    .select("*")
    .eq("stage", stage)
    .order("version", { ascending: false })
    .limit(1);
  const latest = (current?.[0] ?? null) as PromptTemplate | null;
  const nextVersion = (latest?.version ?? 0) + 1;

  // Deactivate the previous active row, then insert the new version active.
  if (latest?.is_active) {
    await supabase.from("prompt_templates").update({ is_active: false }).eq("id", latest.id);
  }
  const { error } = await supabase.from("prompt_templates").insert({
    stage,
    version: nextVersion,
    template_body: templateBody.trim(),
    is_active: true,
    updated_by: user.fullName,
  });
  if (error) { console.error("[admin:template]", error.message); return { error: "Could not save template." }; }

  await writeAudit({
    event_type: "gate_approval",
    actor: user.fullName,
    prompt_template_version: `${stage}-v${nextVersion}`,
    metadata: { action: "prompt_template_published", stage, version: nextVersion },
  });

  revalidatePath("/admin");
  return { error: null, ok: true };
}

/** Admin assigns a role to a user. Uses the service client to update any
 *  profile row after the Admin check (RLS allows Admin, but the service path
 *  is robust regardless of policy wiring). */
export async function assignRole(input: {
  userId: string;
  role: string;
}): Promise<StageActionResult> {
  const { userId, role } = input;
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role))
    return { error: "Only the Admin role may assign roles." };
  if (!ROLES.includes(role)) return { error: "Invalid role." };

  const supabase = createServiceClient() ?? (await createClient());
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  await writeAudit({
    event_type: "gate_approval",
    actor: user.fullName,
    metadata: { action: "role_assigned", target_user: userId, role },
  });
  revalidatePath("/admin");
  return { error: null, ok: true };
}

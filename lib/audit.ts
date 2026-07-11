import { createClient } from "@/lib/supabase/server";

export interface AuditEntry {
  deal_id?: string | null;
  event_type:
    | "ai_generation"
    | "human_edit"
    | "gate_approval"
    | "stage_transition"
    | "escalation_created"
    | "stall_triggered"
    | "stall_decision"
    | "followup_reminder"
    | "inbound_received"
    | "inbound_confirmed"
    | "inbound_declined"
    | "deal_created"
    | "deal_updated"
    | "evidence_updated"
    | "claimed_block_waived"
    | "contact_report_created"
    | "lesson_filed";
  actor: string;
  prompt_template_version?: string | null;
  ai_inputs?: Record<string, unknown> | null;
  ai_output_snapshot?: Record<string, unknown> | null;
  human_edit_snapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Append an immutable audit event. Failures are logged, never swallowed into
 * user-facing errors: record-keeping must not block the core action, but the
 * caller can await and inspect the result when the audit row is load-bearing.
 */
export async function writeAudit(entry: AuditEntry): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("audit_events").insert({
    deal_id: entry.deal_id ?? null,
    event_type: entry.event_type,
    actor: entry.actor,
    prompt_template_version: entry.prompt_template_version ?? null,
    ai_inputs: entry.ai_inputs ?? null,
    ai_output_snapshot: entry.ai_output_snapshot ?? null,
    human_edit_snapshot: entry.human_edit_snapshot ?? null,
    metadata: entry.metadata ?? null,
  });
  if (error) {
    console.error("audit_events insert failed:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

export type Vertical =
  | "Merchant & Acquiring"
  | "Supply Chain Financing"
  | "Consumer & Co-lending"
  | "Bancatakaful & Wealth"
  | "Remittance & FX"
  | "Retail Media"
  | "Payroll & Deposits";

export type Stage =
  | "Triage"
  | "Research"
  | "Options"
  | "Proposal"
  | "Meeting Prep"
  | "In Dialogue"
  | "Legal & Shariah"
  | "Tech Integration"
  | "Live"
  | "Closeout";

export type DealStatus = "Active" | "Parked" | "Killed" | "Live" | "PendingInbound";
export type Confidence = "High" | "Med" | "Low";
export type DepositImpact = "Positive" | "Neutral" | "None";
export type Priority = "High" | "Medium" | "Low";
export type Source = "Inbound" | "Outbound";
export type ConflictCheckStatus = "Pending" | "Cleared" | "Unknown";
export type EvidenceType = "Verified" | "Inferred" | "Claimed";

export interface Deal {
  id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  company: string;
  industry: string | null;
  vertical: Vertical;
  source: Source;
  owner_name: string | null;
  priority: Priority;
  stage: Stage;
  gate: string | null;
  value_hypothesis_basis: string | null;
  value_hypothesis_rm: number | null;
  confidence: Confidence;
  deposit_impact: DepositImpact;
  next_followup_date: string | null;
  revisit_date: string | null;
  conflict_check_status: ConflictCheckStatus;
  conflict_check_confirmed_by: string | null;
  status: DealStatus;
  last_stage_change_at: string;
}

export interface EvidenceItem {
  id: string;
  created_at: string;
  deal_id: string;
  claim: string;
  evidence_type: EvidenceType;
  source_url: string | null;
  is_material: boolean;
  waived_by: string | null;
  waive_reason: string | null;
  review_status: string;
}

export interface StageOutput {
  id: string;
  created_at: string;
  deal_id: string;
  stage: string;
  ai_output: Record<string, unknown> | null;
  ai_output_source: string;
  ai_output_confidence: number | null;
  ai_output_review_status: string;
  human_edited_output: Record<string, unknown> | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  prompt_template_version: string | null;
}

export interface ContactReport {
  id: string;
  created_at: string;
  deal_id: string;
  contact_date: string;
  channel: string | null;
  raw_notes: string | null;
  ai_challenge: string | null;
  ai_challenge_source: string;
  ai_challenge_confidence: number | null;
  ai_challenge_review_status: string;
  ask_type: string | null;
  ask_domain: string | null;
  next_step: string | null;
  risk_level: string | null;
  recommended_followup_interval: number | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
}

export interface Escalation {
  id: string;
  created_at: string;
  deal_id: string;
  contact_report_id: string | null;
  ai_summary: string | null;
  ai_summary_source: string;
  ai_summary_confidence: number | null;
  ai_summary_review_status: string;
  assigned_to_role: string;
  status: "Open" | "Resolved";
  resolved_at: string | null;
  resolution_notes: string | null;
}

export interface Lesson {
  id: string;
  created_at: string;
  deal_id: string;
  vertical: string;
  outcome: string | null;
  what_worked: string | null;
  what_stalled: string | null;
  deal_shape: string | null;
  transferable_lesson: string;
  tags: string[] | null;
}

export interface AuditEvent {
  id: string;
  created_at: string;
  deal_id: string | null;
  event_type: string;
  actor: string | null;
  prompt_template_version: string | null;
  ai_inputs: Record<string, unknown> | null;
  ai_output_snapshot: Record<string, unknown> | null;
  human_edit_snapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

export interface PromptTemplate {
  id: string;
  created_at: string;
  stage: string;
  version: number;
  template_body: string;
  is_active: boolean;
  updated_by: string | null;
}

export interface StallReview {
  id: string;
  created_at: string;
  deal_id: string;
  assigned_to_role: string;
  decision: "Advance" | "Park" | "Kill" | null;
  new_revisit_date: string | null;
  decided_by: string | null;
  decided_at: string | null;
}

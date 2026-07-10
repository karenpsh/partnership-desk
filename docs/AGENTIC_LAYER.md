# Agentic Layer

## Risk levels and approval rules

### Low risk — auto-execute (no approval needed)
- Generate AI draft for any stage and store in `stage_outputs` (never advances stage alone)
- Structure contact report fields from raw notes
- Calculate confidence-weighted pipeline value
- Flag overdue / stalled deals with status chip
- Send follow-up reminder email (to the deal owner only)

### Medium risk — light approval (owner confirms before write)
- Advance deal to next stage (owner clicks Confirm on AI output)
- Create `contact_report` record (owner confirms AI-structured fields before save)
- Set `next_followup_date` from AI recommendation (owner confirms)
- Create `escalation` record auto on Management support (created, then routed — Head/Approver notified)

### High risk — named approver action required
- Gate advance at Legal & Shariah (Approver role must approve in-app; logged to audit_events)
- Stall review decision: Advance / Park / Kill (Head role only; owner cannot decide own stalled deal)
- Waive a Claimed-evidence block on proposal generation (Head only; logged with reason)

### Critical — human-only, no AI action
- Permanent deal deletion (not permitted; terminal states are Killed/Parked, not deleted)
- Prompt template publish (Admin edits, Head approves; versioned, never auto-deployed)
- Audit log export (Admin only; no AI involvement)
- User role assignment / removal

## Named tools (server-side only)
| Tool | Action | Risk |
|---|---|---|
| `generate_stage_output` | Call LLM, store result | Low |
| `confirm_stage_output` | Write confirmed_by + advance stage | Medium |
| `create_escalation` | Insert escalation row, notify Approver | Medium |
| `create_stall_review` | Insert stall_review, notify Head | Medium |
| `approve_gate` | Write gate approval to audit_events | High |
| `waive_claimed_block` | Write waiver with reason to evidence_items | High |
| `export_audit_log` | Read + package audit_events | Critical |

## Audit log fields (every agentic action)
`event_type` · `actor` · `deal_id` · `prompt_template_version` · `ai_inputs` · `ai_output_snapshot` · `human_edit_snapshot` · `metadata` · `created_at`

## v1 vs later
- **v1:** All tools above; no autonomous multi-step chains
- **Later:** Inbound email → auto Stage 0 deal creation (Medium risk, requires Head to confirm before deal is active)

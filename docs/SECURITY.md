# Security

## Secret handling
- LLM API key stored in Vercel environment variables (server-only); never passed to the browser or logged
- Supabase service-role key never exposed client-side; all privileged writes go through server API routes
- All AI calls made from `/api/ai/*` Next.js routes; browser receives only the structured response

## Permission model (v1 → lock-down)
| Role | Deals | AI stages | Gate approvals | Config | Audit export |
|---|---|---|---|---|---|
| Manager | Own (create/edit) | Own deals | — | — | — |
| Head | All (create/edit) | All deals | Advance gates | Verticals / dropdowns | Read |
| Approver | Read all | — | Legal & Shariah | — | — |
| Reviewer | Read all + annotate | — | — | — | — |
| Admin | — | — | — | Prompt templates / users | Export |

- v1 RLS: permissive (demo-first, no login required)
- Lock-down sprint: `deals.user_id = auth.uid()` for Managers; Head bypasses via role claim; Approver/Reviewer SELECT only; audit_events: no UPDATE/DELETE for any role
- `stall_reviews.decision` only writeable by Head role — enforced server-side before any Postgres write

## Approved-tools rule
No raw `eval`, `exec`, or open-ended tool calls. Every agentic action maps to a named function in `/lib/tools/` with explicit input schema validation (zod) before execution.

## Audit principle
Every meaningful action — AI generation, human edit, gate approval, stage transition, escalation creation, stall decision — writes an immutable row to `audit_events`. No UPDATE or DELETE is permitted on that table for any role. Audit export is Admin-only and produces a signed, timestamped file.

## Regulatory notes
- PDPA (Malaysia): business contact data only; right-to-erasure workflow for contact_reports (soft-delete `raw_notes`; structured fields retained for audit)
- BNM RMiT: LLM vendor data-handling terms must be reviewed by Compliance before go-live; deal data hosted in-region (Supabase ap-southeast-1)
- If in doubt on a security, data-loss, or compliance decision: stop and get a human specialist

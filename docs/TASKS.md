# Tasks and Sprints

## Sprint 1 — Database foundation and demo board
**Goal:** Pipeline board renders seeded deals at `/` without a login wall. Any deal can be created and edited; changes persist and survive a refresh.

- [ ] Apply migration SQL (all tables, RLS v1 policies, seed data)
- [ ] Pipeline board page (`/`): Kanban columns by stage + table toggle
- [ ] Status chips: Overdue, Due Soon, Stalled, Needs Management (computed from DB fields)
- [ ] Meeting mode filter button (overdue + stalled + escalated deals first)
- [ ] Deal detail page (`/deals/[id]`): all fields, edit form, save to DB
- [ ] New deal form: required fields validated before insert
- [ ] Five UI states on board: loading skeleton, empty state, partial (some deals), error banner, ready
- [ ] Five UI states on deal detail: loading, not found, read-only, edit mode, save error

**Definition of Done:** Seeded board renders at `/` in < 2 s. Edit a deal's company name → refresh → new name persists. Create a new deal → appears on board in correct stage column. No login required.

---

## Sprint 2 — Stage machine and gate enforcement *(v1 functional milestone begins)*
**Goal:** The core deal engine works end-to-end: create → Triage AI → confirm → gate-blocked advance → Research AI.

- [ ] Stage transition server action with gate enforcement (conflict check, Claimed blocker, value hypothesis required)
- [ ] Stage 0 Triage screen: paste form → POST `/api/ai/triage` → display structured output → Confirm button
- [ ] Stage 1 Research screen: trigger AI → evidence items created with type → conflict-check checklist (blocks advance until Cleared)
- [ ] Stage 2 Options screen: three options displayed → owner selects one → value hypothesis + confidence + deposit impact required fields
- [ ] Every stage transition writes to `audit_events`
- [ ] Claimed-evidence blocker: Stage 3 generation disabled if material Claimed items exist; Head waive path
- [ ] Graceful degradation: if LLM unavailable, form shows "AI queued" and saves inputs

**Definition of Done:** Create inbound deal → run Triage AI → confirm Pursue → advance to Research → AI brief generated with evidence items typed → conflict check blocks advance until confirmed → advance to Options → three options generated → value hypothesis entered → advance to Proposal → Claimed blocker fires if material evidence unresolved. All transitions in audit log.

---

## Sprint 3 — Remaining AI stages and contact logging
**Goal:** Full Stage 3–6 workflow works; contact reports log and auto-escalate.

- [ ] Stage 3 Proposal: AI draft generated, human edit tracked in `human_edited_output`, Approve button writes `confirmed_at`
- [ ] Stage 4 Meeting Prep: AI prep sheet (objective, 5 objections, who to bring, one thing not to do), approve to advance
- [ ] Stage 5 Contact Analysis: paste notes → AI structures `contact_report` fields → owner confirms → saved; if ask_type = Management support → escalation auto-created
- [ ] Escalation record created with AI two-line summary; notification placeholder (in-app banner)
- [ ] Stage 6 Closeout: outcome form; `transferable_lesson` required to submit; lesson written to `lessons` table
- [ ] All AI generations log to `audit_events` with `prompt_template_version`

**Definition of Done:** End-to-end run from Stage 0 to Closeout completes for one deal. Lesson row exists in `lessons`. All 7+ AI generations appear in `audit_events`. Escalation row created when contact report has ask_type = Management support. *(v1 functional milestone: success scenario is fully usable)*

---

## Sprint 4 — Follow-up engine and stall trigger
**Goal:** No zombie pipeline. Follow-up dates drive notifications; stalled deals surface to Head.

- [ ] Follow-up date field drives Overdue / Due Soon chips (already shown in Sprint 1; now wired to real dates)
- [ ] In-app notification list: overdue follow-ups, open escalations, pending stall reviews
- [ ] Email reminder via Resend on follow-up date (server-side, deal owner only)
- [ ] Parked revisit date: mandatory field when status set to Parked; email reminder on that date
- [ ] 60-day stall trigger: Supabase Edge Function runs daily; inserts `stall_reviews` row for qualifying deals; sets Stalled chip
- [ ] Stall review screen (Head only): Advance / Park / Kill decision form; writes to `stall_reviews` and updates deal status
- [ ] Graceful degradation confirmed: board and deal CRUD work when Edge Function is down

**Definition of Done:** Set a deal's `next_followup_date` to yesterday → Overdue chip appears on board. Manually set `last_stage_change_at` to 61 days ago → stall review row created and Stalled chip appears. Head completes stall review → deal status updated and decision in audit log.

---

## Sprint 5 — Lock it down (auth + per-user permissions)
**Goal:** Real users can log in; data is owner-scoped; anonymous access removed.

- [ ] SSO integration (Supabase Auth with bank IdP SAML/OIDC)
- [ ] Role assignment table + middleware checks
- [ ] Replace v1 open RLS policies with owner-scoped policies: Manager sees own deals; Head sees all; Approver/Reviewer SELECT only; Admin no deal editing
- [ ] `audit_events`: no UPDATE/DELETE policy for any role
- [ ] Escalation routing: notify Approver role users only
- [ ] Gate approvals (Legal & Shariah): Approver role only
- [ ] Stall review decision: Head role only (server-side check + RLS)
- [ ] Prompt template versioning UI: Admin edits, new version inserted (never overwrites)
- [ ] Audit log export: Admin role only, timestamped download
- [ ] Anonymous visitor → redirect to `/login`

**Definition of Done:** Manager A cannot read or edit Manager B's deal via direct URL. Head can read all. Approver can read all but POST to /api/ai/* returns 403. Anonymous request to `/` redirects to `/login`. Audit log export returns 403 for non-Admin.

---

## Sprint 6 — Dashboard, knowledge base, and reporting
**Goal:** Management can see the pipeline's value, health, and trends at a glance; lessons feed future deals.

- [ ] Dashboard (`/dashboard`): confidence-weighted pipeline value by vertical + owner; funnel conversion by stage
- [ ] Deposit-impact coverage metric; stalled + killed counts; inbound triage outcome breakdown; logging-compliance rate
- [ ] Knowledge base (`/knowledge`): searchable lessons by vertical and outcome; closeout reports linked
- [ ] Triage log market-intelligence view: inbound inquiries by industry over time
- [ ] Retrieval layer: Stage 1 and Stage 2 prompts automatically include top 3 matching lessons by vertical
- [ ] Exportable monthly PDF pack (server-rendered)
- [ ] All dashboard figures verified against live deal counts (not seeded constants)

**Definition of Done:** File a lesson on a Closeout → lesson appears in knowledge base search → create a new deal in the same vertical → Stage 1 AI brief includes that lesson in its output. Dashboard confidence-weighted value matches manual calculation from deals table.

---

## Gantt (sprint → features)
```
Sprint 1 │ DB + board + deal CRUD + status chips
Sprint 2 │ Stage machine + gate enforcement + AI Stages 0–2
Sprint 3 │ AI Stages 3–6 + contact reports + escalations + lessons   ← v1 functional
Sprint 4 │ Follow-up engine + stall trigger + notifications
Sprint 5 │ SSO + RLS lock-down + role enforcement                     ← auth milestone
Sprint 6 │ Dashboard + knowledge base + retrieval layer + PDF export
```

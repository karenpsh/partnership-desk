# Partnership Desk — PRD

## Problem
Anon's four-person partnerships team runs on a shared spreadsheet. Junior staff produce inconsistent research; pipeline records drift because logging is voluntary; and the desk optimises deal count over value. No existing tool enforces Anon's ecosystem-first logic, deposit-stickiness mandate, or Shariah compliance.

## Target users
- **Manager** — partnership staff (x4): create and work own deals, run AI stages, log contacts
- **Head** — Head of Partnerships: full access, gate approvals, kill/park decisions, config
- **Approver** — CEO office / CFO delegate: read all, approve Legal & Shariah gate, resolve escalations
- **Reviewer** — Shariah secretariat / Compliance: read all, annotate, flag
- **Admin** — IT-appointed: user management, prompt versioning, audit export

## Core objects
`Deal` · `EvidenceItem` · `StageOutput` · `ContactReport` · `Escalation` · `Lesson` · `AuditEvent` · `PromptTemplate` · `StallReview`

## MVP must-haves (v1)
- [ ] Deal record with all fields (company, vertical, stage, value hypothesis, confidence, deposit impact)
- [ ] Pipeline board: Kanban + table, status chips, meeting mode
- [ ] Enforced stage machine with gate blockers (conflict check, Claimed evidence, missing value hypothesis)
- [ ] AI Copilot for all seven stages (0 Triage → 6 Closeout)
- [ ] Evidence typing (Verified / Inferred / Claimed) with Claimed-blocker on proposal generation
- [ ] Contact report with AI-structured fields; auto-escalation on Management support ask
- [ ] 60-day stall trigger → Head review task
- [ ] In-app + email follow-up notifications
- [ ] Immutable audit log for every AI generation, edit, gate approval, transition
- [ ] Lesson mandatory at closeout
- [ ] Seeded demo deals visible without login

## Non-goals (v1)
- No SSO / auth wall (Sprint 1–4); no per-user data isolation until Lock-down sprint
- No retrieval-augmented lesson injection (lessons stored; manual consult only)
- No mobile push, no email ingestion, no calendar integration
- No core-banking or Anon group system integration
- No group-automated conflict check (manual checklist only)

## Success criteria — end-to-end scenario
A Manager creates an inbound deal, runs Stage 0 Triage (AI scores and recommends Pursue, Manager confirms), advances to Stage 1 (AI research brief generated, Claimed evidence flagged), passes conflict check, selects a Stage 2 option (value hypothesis and deposit impact entered), generates a Stage 3 Proposal (blocked until Claimed item resolved), logs a contact report (AI structures it, escalation auto-created for Management support ask), and files a lesson at Closeout — every step persisted to the database and visible on the pipeline board, every AI generation present in the audit log.

# PRD: Partnership Desk
**An AI-guided partnership operating system for Anon (M) Berhad**

Version 1.0 · July 2026 · Owner: Head of Partnerships
Status: Draft for review

---

## 1. Problem statement

Anon's partnerships function must grow financing and fee income with a team of four staff, several of them junior, across six commercial verticals. Today the process quality lives in people's heads and in a shared spreadsheet held together by managerial discipline. Three failures follow predictably: junior staff produce inconsistent research and weak qualification of inbound approaches; pipeline records drift from reality because logging is voluntary; and the desk optimises deal count rather than deal value because nothing in the system carries a number.

The bank's specific context raises the stakes. Its durable advantage is the Anon retail ecosystem (malls, hypermarkets, suppliers, tenants, shoppers), which every partnership must exploit to avoid being commoditised against better-capitalised digital banks. Its most urgent funding problem is deposit stickiness following the expiry of promotional rates. And every proposition must be Shariah-compliant. A generic CRM enforces none of this.

Partnership Desk is a purpose-built application that embeds a staged, AI-assisted workflow (research, options, proposal, objections, contact analysis, closeout) into the pipeline record itself, with hard gates, mandatory valuation, automated follow-up, and a knowledge base that compounds with every closed deal.

## 2. Objectives and success metrics

| Objective | Metric | Target (12 months post-launch) |
|---|---|---|
| Grow revenue-weighted pipeline | Total estimated annual value of active deals, confidence-weighted | Baseline set in month 1; 3x by month 12 |
| Address funding cost | Number of live deals with a scored deposit impact (payroll, settlement float) | ≥ 30% of live deals deposit-positive |
| Raise junior output quality | % of proposals passing management review without material rework | > 70% |
| Kill zombie pipeline | Deals stalled > 60 days without a review decision | 0 (structurally impossible) |
| Record integrity | Interactions logged within 48 hours of occurrence | > 90% |
| Compounding knowledge | Closed deals with a filed lesson | 100% (enforced at closeout) |
| Cycle time | Median days from Identified to first proposal sent | Establish baseline; reduce 25% |

## 3. Non-goals

- Not a group-wide CRM. Scope is the bank's partnership desk only.
- Not an autopilot. The AI drafts and analyses; a named human approves every artefact before it advances a stage or leaves the building.
- No consumer-facing surface. Internal tool only.
- No crypto, conventional-interest, or non-halal propositions anywhere in generated content (hard content rule in AI layer).
- Phase 1 does not integrate with core banking or Anon group systems (see Phasing).

## 4. Users and roles

| Role | Who | Permissions |
|---|---|---|
| Manager | The four partnership staff | Create and work deals they own; log contacts; run AI stages; propose stage advances |
| Head | Head of Partnerships | Everything above across all deals; approve gate advances where required; kill/park decisions; edit verticals and config; view analytics |
| Approver | Senior management (CEO office, CFO delegate) | Read all; act on escalations routed to them; approve deals at Legal & Shariah gate |
| Reviewer | Compliance / Shariah secretariat | Read all; annotate; flag |
| Admin | IT-appointed | User management, prompt template versioning, audit export. No deal editing |

Design principle: a brand-new hire must be able to run a target end to end on day one with no training beyond a 15-minute walkthrough, because the workflow itself is the training.

## 5. Core concepts and data model

**Deal.** The central object. Fields: company, industry, vertical (one of seven, see below), source (Inbound / Outbound), owner, priority, stage, gate, value hypothesis (RM/yr, free-text basis + number), confidence (High/Med/Low), deposit impact score (Positive/Neutral/None), next follow-up date, revisit date (mandatory if Parked), conflict-check status, created/updated timestamps.

**Verticals (7).** Merchant & Acquiring; Supply Chain Financing; Consumer & Co-lending; Bancatakaful & Wealth; Remittance & FX; Retail Media; **Payroll & Deposits** (elevated to its own vertical; owns the funding-stickiness mandate).

**Stage machine.** Stage 0 Inbound Triage (inbound only) → 1 Research → 2 Options → 3 Proposal → 4 Meeting Prep → In Dialogue ↔ 5 Contact Analysis (repeats) → Legal & Shariah → Tech Integration → Live → 6 Closeout. Terminal states: Live, Parked (with mandatory revisit date), Killed. Transitions are enforced: a deal cannot enter Stage 3 without a confirmed Stage 1 record, a selected Stage 2 option, and a passed conflict check.

**Evidence item.** Every factual claim attached to a deal carries a type: **Verified** (independent source, link stored), **Inferred** (model reasoning, stated), or **Claimed** (partner-supplied, unconfirmed). Material claims (volumes, users, defaults, revenue) typed Claimed block proposal generation until upgraded or explicitly waived by the Head with a logged reason.

**Contact report.** Date, channel, raw notes, AI-extracted challenge, ask type (Time / Information / Management support), ask domain (Business / Tech), next step, risk (L/M/H), recommended follow-up interval. AI writes the structured fields; the owner confirms or edits before save.

**Lesson.** One per closed deal, tagged by vertical, auto-injected into future Stage 1–2 generations in that vertical (retrieval layer).

**Escalation.** Created automatically when ask type = Management support; routed to an Approver with a two-line AI-drafted summary; status tracked to resolution.

**Audit event.** Immutable log of every AI generation (prompt template version, inputs, output), every human edit to AI output, every gate approval, every stage transition, with actor and timestamp.

## 6. Functional requirements

### F1. Pipeline board
Kanban and table views across the stage machine, filterable by owner, vertical, source, status. Colour-coded status chips: Overdue (follow-up date passed), Due soon (≤ 2 days), Stalled (no stage change in 60 days), Needs management (open escalation). Default sort: confidence-weighted value, descending. The board is the Monday meeting artefact; a "meeting mode" presents overdue, stalled, and escalated deals first.

### F2. AI Copilot: staged workflow
Each stage is a screen within the deal record, not a chat. The copilot runs one stage at a time and cannot be advanced past a gate by prompting.

- **Stage 0 Triage (inbound only).** Staff paste the inbound material. Output: one-sentence reframe of what the party actually wants; four-lever scoring (cost of funds / CAC / asset origination / fee income) each Yes-Weak-No with reasoning; ecosystem test; red-flag checklist (one-way value, vendor-in-disguise, Shariah doubt, manufactured urgency, bank-agnostic pitch); verdict Pursue / Park / Decline with a drafted holding reply or courteous decline. Human confirms the verdict; Declines are logged, not deleted.
- **Stage 1 Research.** Live web research producing a company brief: scale, recent moves, likely financial needs, visible banking relationships, and every Anon ecosystem touchpoint found or inferred. All items typed Verified/Inferred/Claimed. Ends with the three load-bearing facts the owner must confirm. **Group conflict check** presented here as a blocking checklist: does any Anon entity have an active relationship or dispute with this target? (Unknown = go ask; the field records who confirmed.)
- **Stage 2 Options.** Exactly three collaboration options, each mapped to a vertical with value exchange, revenue mechanism, and partner motivation; ranked; ecosystem-led vs bank-led flagged, with a plain warning if all three are bank-led. **Mandatory before advance:** a value hypothesis (number + one-line basis) and confidence rating for the selected option, and a deposit impact score.
- **Stage 3 Proposal.** One-page draft (< 400 words) in the partner's language, Shariah structure named. Generation blocked if material evidence is still Claimed (Head may waive with logged reason). Human edits and approves; approved version is the artefact of record.
- **Stage 4 Meeting prep.** Objective, opening angle, five ranked objections with responses, who to bring (retail/leasing colleague required when the ecosystem is the lead card), one thing not to do. Rendered as a prep sheet, explicitly not a script.
- **Stage 5 Contact analysis.** Owner pastes raw notes; AI writes the structured contact report fields and sets the next follow-up date; owner confirms. If ask = Management support, an escalation is created and routed automatically with an AI-drafted two-line summary.
- **Stage 6 Closeout.** On Live or Killed/Parked: outcome, what worked, what stalled it, deal shape if won, one transferable lesson. Lesson filing is mandatory to complete closeout.

### F3. Follow-up engine
Scheduled notifications (email + in-app; push in Phase 2) on follow-up dates, overdue items, parked-deal revisit dates, and 60-day stall triggers. Stall trigger opens a review task assigned to the Head: Advance / Park (new revisit date) / Kill. The deal owner does not hold the casting vote on their own stalled deal.

### F4. Knowledge base and retrieval
Searchable library of lessons and closeout reports, tagged by vertical and outcome. Retrieval layer injects the top relevant lessons into Stage 1–2 generations automatically. Triage log doubles as market intelligence: a view of inbound inquiries by industry over time.

### F5. Dashboard and reporting
Confidence-weighted pipeline value by vertical and owner; funnel conversion by stage; deposit-impact coverage; stalled and killed counts; inbound triage outcomes; logging-compliance rate. Exportable monthly pack (PDF) for management.

### F6. Admin
User and role management; vertical and dropdown configuration; **prompt template versioning** (every AI stage prompt is configuration, not code; changes are versioned and auditable); audit log export.

## 7. AI design requirements

- Server-side integration with the LLM provider using a bank-held API key. No end-user keys, no client-side calls.
- Prompt templates encode the bank context (ecosystem-first rule, Shariah constraints, seven verticals, deposit priority) and are maintained by the Head via Admin, versioned.
- Hard content rules in the system prompt: no crypto, no conventional interest, no non-halal categories; UK English; no em dashes; unverifiable statements labelled as such.
- Every generation logged (template version, inputs, output) to the audit trail.
- Human-in-the-loop is structural: no AI artefact reaches a partner, an approver, or the next stage without a named human confirmation event.
- Graceful degradation: if the AI service is unavailable, all record-keeping and pipeline functions continue; AI stages queue.

## 8. Non-functional requirements

- **Access:** SSO against bank identity provider; role-based access control per §4; MFA inherited from SSO.
- **Data protection:** PDPA (Malaysia) compliance; partner personal data minimised (business contacts only); retention policy configurable; right-to-erasure workflow for contact data.
- **Regulatory posture:** BNM RMiT expectations apply as an internal material system: vendor/outsourcing assessment for the LLM provider, data residency review, and inclusion in the bank's technology risk register. Legal & Shariah gate approvals recorded for governance.
- **Audit:** immutable event log per §5; exportable for internal audit.
- **Availability:** business-hours criticality; 99.5% is sufficient. This is not a payments system.
- **Performance:** AI stage generation < 30s p95; board loads < 2s with 500 deals.
- **Data residency:** deal data hosted in-region per bank policy; LLM data-handling terms reviewed by compliance before go-live.

## 9. Phasing

**Phase 0 (now, pre-build).** Run the process on the shared spreadsheet plus the Claude Project for 4–8 weeks. Purpose: validate stage definitions, triage rules, and field lists against reality. Exit criteria: the team has run ≥ 10 deals through the full workflow and the Head signs off the process as stable. Everything the app enforces must first survive contact with real deals.

**Phase 1 MVP (8–12 weeks build).** Deal record and stage machine; AI copilot Stages 0–6 with gates; contact logging with AI analysis; follow-up notifications (email + in-app); mandatory valuation and deposit fields; conflict-check blocker; 60-day stall trigger; basic dashboard; audit log; SSO and roles. Explicitly excluded: retrieval-augmented knowledge base (lessons are stored and searchable but manually consulted), push notifications, integrations.

**Phase 2.** Retrieval layer feeding lessons into generations; management reporting pack; mobile push; calendar integration for follow-ups; inbound email ingestion (forward an inquiry to a desk address, deal auto-created at Stage 0).

**Phase 3 (only if scale justifies).** Group-data integration for automated conflict checks; tracker-to-core reporting of live-deal revenue actuals against the value hypothesis, closing the loop between estimate and reality.

## 10. Build vs buy

An honest assessment: roughly 60–70% of F1, F3 and F5 exists in commercial CRMs (HubSpot, Pipedrive, Dynamics) and could be configured in weeks. What no off-the-shelf product provides: the staged AI copilot with enforced gates, the evidence-typing and Claimed-blocking logic, Shariah and ecosystem-aware generation, and the compounding lesson loop, which together are the actual point of the system. Two viable paths: (a) full custom build per this PRD; (b) CRM as the pipeline substrate with a custom AI layer on top via API. Path (b) is faster and cheaper but creates a permanent integration seam and limits gate enforcement. Recommendation: decide after Phase 0, when the process is proven and the true cost of the seam can be judged. Do not begin either before Phase 0 exit criteria are met.

## 11. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Process frozen before validated; app enforces wrong workflow | High if Phase 0 skipped | Phase 0 exit criteria are a hard gate on build start |
| Staff treat AI proposals as finished work | Medium | Human confirmation events named and logged; Head spot-checks in weeks 1–4; review-pass metric tracked |
| AI research poisoned by partner marketing or claimed figures | Medium | Evidence typing; Claimed blocks proposals; independent-source rule for material numbers |
| Logging decays; board drifts from reality | Medium | Monday meeting runs off the board only; logging-compliance metric visible to management |
| LLM vendor or data-handling fails compliance review | Low-Medium | Vendor assessment in Phase 0; graceful degradation means the pipeline survives without AI |
| Group-entity conflict embarrasses the bank | Low, high impact | Blocking conflict check before Stage 3, with named confirmer |
| Tool becomes deal-count theatre | Medium | Default board sort and all dashboards are value-weighted, not count-based |

## 12. Open questions

1. Does the Payroll & Deposits vertical own a deposit revenue target, and who staffs it? (Org decision, precedes build.)
2. Which LLM deployment satisfies compliance: vendor API with contractual terms, or a private/regional deployment? (Drives cost and Phase 1 timeline.)
3. Is Legal & Shariah gate approval in-app sufficient for the Shariah secretariat, or do they require their own workflow system of record?
4. Value hypothesis methodology: standardise per vertical (e.g. acquiring = outlets × volume × MDR) or leave free-form with a number? Recommend standardised templates per vertical by Phase 2.
5. Who is the internal system owner post-launch: partnerships (business-owned) or IT?

---
*End of document.*

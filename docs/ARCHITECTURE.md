# Architecture

## Stack
- **Frontend:** Next.js 14 (App Router) on Vercel
- **Database + Auth:** Supabase (Postgres + RLS + Auth)
- **AI:** Server-side API route calls to Anthropic Claude (bank-held key in Vercel env, never exposed to browser)
- **Email notifications:** Resend (server-side)
- **Background jobs:** Supabase Edge Functions (stall trigger, follow-up reminders)

## What runs without AI
All deal creation, stage transitions, evidence logging, contact report saving, follow-up scheduling, and pipeline board rendering work independently. AI stages queue and show a "Waiting for AI" state when the LLM is unavailable.

## Key action — running Stage 0 Triage end-to-end
1. Manager opens a new Inbound deal and pastes the inbound text into the Triage form
2. Browser POSTs to `/api/ai/triage` — server retrieves the active PromptTemplate (version logged), builds the prompt, calls Claude
3. Response stored in `stage_outputs` with `ai_output`, `prompt_template_version`, `ai_output_review_status = 'unreviewed'`; AuditEvent written
4. UI renders the AI output (four-lever scores, red flags, verdict)
5. Manager edits (diff stored in `human_edited_output`) and clicks Confirm
6. `confirmed_by` + `confirmed_at` written; deal `stage` updated; second AuditEvent written
7. Pipeline board re-fetches and reflects updated stage chip

## Layer plan
1. **Data layer first** — all tables, constraints, RLS, seed data
2. **Core CRUD** — deal create/edit, stage transitions, evidence items, contact reports
3. **Gate enforcement** — server-side checks before any `stage` column update
4. **AI copilot** — server API routes per stage, output stored before shown
5. **Smart features** — stall trigger, escalation routing, notification engine
6. **Analytics + knowledge base** — dashboard queries, lesson retrieval

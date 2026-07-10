create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company text not null,
  industry text,
  vertical text not null,
  source text not null default 'Outbound',
  owner_name text,
  priority text default 'Medium',
  stage text not null default 'Research',
  gate text,
  value_hypothesis_basis text,
  value_hypothesis_rm numeric,
  confidence text default 'Low',
  deposit_impact text default 'Neutral',
  next_followup_date date,
  revisit_date date,
  conflict_check_status text default 'Pending',
  conflict_check_confirmed_by text,
  status text default 'Active',
  last_stage_change_at timestamptz not null default now()
);

alter table deals enable row level security;
drop policy if exists "deals_v1_read" on deals;
create policy "deals_v1_read" on deals for select using (true);
drop policy if exists "deals_v1_write" on deals;
create policy "deals_v1_write" on deals for all using (true) with check (true);

create table if not exists evidence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  deal_id uuid not null references deals(id) on delete cascade,
  claim text not null,
  evidence_type text not null default 'Inferred',
  source_url text,
  is_material boolean default false,
  waived_by text,
  waive_reason text,
  review_status text default 'unreviewed'
);

alter table evidence_items enable row level security;
drop policy if exists "evidence_items_v1_read" on evidence_items;
create policy "evidence_items_v1_read" on evidence_items for select using (true);
drop policy if exists "evidence_items_v1_write" on evidence_items;
create policy "evidence_items_v1_write" on evidence_items for all using (true) with check (true);

create table if not exists stage_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  deal_id uuid not null references deals(id) on delete cascade,
  stage text not null,
  ai_output jsonb,
  ai_output_source text default 'llm',
  ai_output_confidence numeric,
  ai_output_review_status text default 'unreviewed',
  human_edited_output jsonb,
  confirmed_by text,
  confirmed_at timestamptz,
  prompt_template_version text
);

alter table stage_outputs enable row level security;
drop policy if exists "stage_outputs_v1_read" on stage_outputs;
create policy "stage_outputs_v1_read" on stage_outputs for select using (true);
drop policy if exists "stage_outputs_v1_write" on stage_outputs;
create policy "stage_outputs_v1_write" on stage_outputs for all using (true) with check (true);

create table if not exists contact_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  deal_id uuid not null references deals(id) on delete cascade,
  contact_date date not null,
  channel text,
  raw_notes text,
  ai_challenge text,
  ai_challenge_source text default 'llm',
  ai_challenge_confidence numeric,
  ai_challenge_review_status text default 'unreviewed',
  ask_type text,
  ask_domain text,
  next_step text,
  risk_level text,
  recommended_followup_interval integer,
  confirmed_by text,
  confirmed_at timestamptz
);

alter table contact_reports enable row level security;
drop policy if exists "contact_reports_v1_read" on contact_reports;
create policy "contact_reports_v1_read" on contact_reports for select using (true);
drop policy if exists "contact_reports_v1_write" on contact_reports;
create policy "contact_reports_v1_write" on contact_reports for all using (true) with check (true);

create table if not exists escalations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  deal_id uuid not null references deals(id) on delete cascade,
  contact_report_id uuid references contact_reports(id),
  ai_summary text,
  ai_summary_source text default 'llm',
  ai_summary_confidence numeric,
  ai_summary_review_status text default 'unreviewed',
  assigned_to_role text default 'Approver',
  status text default 'Open',
  resolved_at timestamptz,
  resolution_notes text
);

alter table escalations enable row level security;
drop policy if exists "escalations_v1_read" on escalations;
create policy "escalations_v1_read" on escalations for select using (true);
drop policy if exists "escalations_v1_write" on escalations;
create policy "escalations_v1_write" on escalations for all using (true) with check (true);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  deal_id uuid not null references deals(id) on delete cascade,
  vertical text not null,
  outcome text,
  what_worked text,
  what_stalled text,
  deal_shape text,
  transferable_lesson text not null,
  tags text[]
);

alter table lessons enable row level security;
drop policy if exists "lessons_v1_read" on lessons;
create policy "lessons_v1_read" on lessons for select using (true);
drop policy if exists "lessons_v1_write" on lessons;
create policy "lessons_v1_write" on lessons for all using (true) with check (true);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  deal_id uuid references deals(id),
  event_type text not null,
  actor text,
  prompt_template_version text,
  ai_inputs jsonb,
  ai_output_snapshot jsonb,
  human_edit_snapshot jsonb,
  metadata jsonb
);

alter table audit_events enable row level security;
drop policy if exists "audit_events_v1_read" on audit_events;
create policy "audit_events_v1_read" on audit_events for select using (true);
drop policy if exists "audit_events_v1_write" on audit_events;
create policy "audit_events_v1_write" on audit_events for all using (true) with check (true);

create table if not exists prompt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  stage text not null,
  version integer not null default 1,
  template_body text not null,
  is_active boolean default true,
  updated_by text
);

alter table prompt_templates enable row level security;
drop policy if exists "prompt_templates_v1_read" on prompt_templates;
create policy "prompt_templates_v1_read" on prompt_templates for select using (true);
drop policy if exists "prompt_templates_v1_write" on prompt_templates;
create policy "prompt_templates_v1_write" on prompt_templates for all using (true) with check (true);

create table if not exists stall_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  deal_id uuid not null references deals(id) on delete cascade,
  assigned_to_role text default 'Head',
  decision text,
  new_revisit_date date,
  decided_by text,
  decided_at timestamptz
);

alter table stall_reviews enable row level security;
drop policy if exists "stall_reviews_v1_read" on stall_reviews;
create policy "stall_reviews_v1_read" on stall_reviews for select using (true);
drop policy if exists "stall_reviews_v1_write" on stall_reviews;
create policy "stall_reviews_v1_write" on stall_reviews for all using (true) with check (true);

insert into deals (company, industry, vertical, source, owner_name, priority, stage, value_hypothesis_basis, value_hypothesis_rm, confidence, deposit_impact, next_followup_date, conflict_check_status, status, last_stage_change_at) values
('Parkson Retail Group', 'Retail', 'Merchant & Acquiring', 'Outbound', 'Amirah Zulkifli', 'High', 'Proposal', 'Est. 120 outlets × RM2.8M avg turnover × 0.6% MDR', 2016000, 'High', 'Neutral', current_date + 3, 'Cleared', 'Active', now() - interval '12 days'),
('Lam Soon (M) Bhd', 'FMCG / Manufacturing', 'Supply Chain Financing', 'Inbound', 'Faiz Harun', 'High', 'Research', 'Trade receivables cycle of RM180M pa; 1.2% facility fee', 2160000, 'Med', 'Positive', current_date + 1, 'Pending', 'Active', now() - interval '5 days'),
('AXA Affin Life', 'Insurance', 'Bancatakaful & Wealth', 'Outbound', 'Nurul Aina Bt Ramli', 'Medium', 'In Dialogue', 'Bancatakaful premium split RM40M pa at 15% commission', 6000000, 'Med', 'Neutral', current_date - 1, 'Cleared', 'Active', now() - interval '18 days'),
('Poh Kong Holdings', 'Jewellery Retail', 'Merchant & Acquiring', 'Inbound', 'Amirah Zulkifli', 'Low', 'Triage', NULL, NULL, 'Low', 'Neutral', current_date + 5, 'Pending', 'Active', now() - interval '2 days'),
('Pos Malaysia Berhad', 'Logistics', 'Payroll & Deposits', 'Outbound', 'Faiz Harun', 'High', 'Options', 'Payroll float from 28k staff; avg float RM9M; 2.1% p.a. benefit', 189000, 'Med', 'Positive', current_date + 2, 'Cleared', 'Active', now() - interval '30 days'),
('Mydin Mohamed Holdings', 'Wholesale / Retail', 'Retail Media', 'Inbound', 'Nurul Aina Bt Ramli', 'Medium', 'Meeting Prep', 'In-store media inventory across 55 outlets; RM1.2M/yr sponsorship target', 1200000, 'Low', 'Neutral', current_date - 3, 'Cleared', 'Active', now() - interval '65 days');

insert into lessons (deal_id, vertical, outcome, what_worked, what_stalled, deal_shape, transferable_lesson, tags)
select id, 'Bancatakaful & Wealth', 'Won', 'Leading with AEON cardholder base as distribution channel', 'Shariah sign-off took 6 weeks; engage secretariat at Options stage', 'Revenue-share on takaful premium, minimum 3-yr commitment', 'Always loop in Shariah secretariat at Stage 2 Options — late engagement adds 6 weeks and kills momentum', array['bancatakaful','shariah','timing']
from deals where company = 'AXA Affin Life' limit 1;

insert into prompt_templates (stage, version, template_body, is_active, updated_by) values
('triage', 1, 'You are the AI copilot for AEON Bank Partnership Desk. Evaluate the inbound material below. Output: (1) one-sentence reframe of what the party actually wants; (2) four-lever scoring — cost of funds / CAC / asset origination / fee income, each rated Yes/Weak/No with one-line reasoning; (3) ecosystem test — does this use the AEON mall/hypermarket/supplier/tenant/shopper network?; (4) red-flag checklist: one-way value, vendor-in-disguise, Shariah doubt, manufactured urgency, bank-agnostic pitch; (5) verdict: Pursue / Park / Decline with a drafted holding reply or courteous decline. UK English. No em dashes. No crypto, no conventional interest, no non-halal categories.', true, 'system'),
('research', 1, 'You are the AI copilot for AEON Bank Partnership Desk. Produce a company research brief for the target below. Include: scale, recent moves, likely financial needs, visible banking relationships, and every AEON ecosystem touchpoint found or inferable. Label every claim Verified (source URL), Inferred (reasoning stated), or Claimed (partner-supplied). End with the three load-bearing facts the owner must independently confirm. UK English. No em dashes.', true, 'system'),
('options', 1, 'You are the AI copilot for AEON Bank Partnership Desk. Generate exactly three collaboration options for the deal below. Each option: mapped vertical, value exchange, revenue mechanism, partner motivation, ecosystem-led or bank-led flag. Rank them. If all three are bank-led, add a plain warning. UK English. No em dashes. Shariah-compliant structures only.', true, 'system');
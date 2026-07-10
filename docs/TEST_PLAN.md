# Test Plan

## End-to-end success scenario (manual)
Run this after Sprint 3 is complete.

### Setup
- Confirm 6 seeded deals are visible on the board at `/` without login
- Confirm board renders in < 2 s (observe browser network tab)

### Step 1 — Create a new inbound deal
1. Click **New Deal**; set Company = "Test Co", Vertical = "Merchant & Acquiring", Source = "Inbound"
2. Save → deal appears on board in Triage column
3. **Pass:** card visible; refresh → card still present

### Step 2 — Run Stage 0 Triage
1. Open deal → Stage 0 tab → paste sample inbound text → click **Analyse**
2. Wait for AI output (≤ 30 s); confirm four-lever scores, red flags, and verdict are displayed
3. Edit the drafted reply; click **Confirm Pursue**
4. **Pass:** `stage_outputs` row exists with `confirmed_at` set; `audit_events` row with `event_type = 'ai_generation'` exists; deal stage chip updates to Research

### Step 3 — Stage 1 Research and conflict check
1. Click **Run Research** → AI brief appears with evidence items typed Verified/Inferred/Claimed
2. Attempt to advance with conflict check = Pending → **expect:** advance blocked, error message shown
3. Set conflict check to Cleared (enter confirmer name) → advance succeeds
4. **Pass:** `evidence_items` rows exist; `conflict_check_status = 'Cleared'` in deals table

### Step 4 — Stage 2 Options gate
1. Generate three options; select option 2
2. Attempt to advance without entering value hypothesis → **expect:** advance blocked
3. Enter value hypothesis (RM 500,000, basis text) + confidence = Med + deposit impact = Positive → advance
4. **Pass:** deals row updated; `audit_events` stage_transition row exists

### Step 5 — Stage 3 Proposal Claimed-item blocker
1. Add an evidence item: claim = "Partner has 2M users", type = Claimed, is_material = true
2. Attempt to generate proposal → **expect:** blocked; message explains Claimed item
3. Upgrade evidence type to Verified → generate proposal succeeds
4. Edit proposal text → click **Approve**
5. **Pass:** `human_edited_output` differs from `ai_output`; `confirmed_at` set

### Step 6 — Contact report and escalation
1. Log a contact report: paste raw notes including a request for MD sign-off
2. AI structures fields; set ask_type = "Management support"; confirm
3. **Pass:** `contact_reports` row saved; `escalations` row auto-created with AI summary; in-app escalation banner appears

### Step 7 — Closeout and lesson
1. Advance deal to Closeout; fill outcome form; leave `transferable_lesson` blank → attempt submit
2. **Expect:** submit blocked; lesson field highlighted
3. Fill lesson → submit
4. **Pass:** `lessons` row exists with correct `vertical`; deal status = Live or Killed

### Step 8 — Stall trigger (manual simulation)
1. Update `last_stage_change_at` to `now() - interval '61 days'` for one deal via Supabase table editor
2. Trigger stall Edge Function manually (or wait for daily run)
3. **Pass:** `stall_reviews` row created; deal chip shows Stalled on board

---

## Empty and error states
| Scenario | Expected behaviour |
|---|---|
| Board with 0 deals | Empty state illustration + "Create your first deal" CTA |
| AI service returns 5xx | Stage screen shows "AI unavailable — inputs saved, try again shortly"; no partial output displayed |
| Advance with missing required field | Inline field error; stage does not change |
| Navigate to `/deals/nonexistent-id` | 404 message; Back to Board link |
| Network timeout on board load | Error banner: "Could not load pipeline — refresh to try again" |
| Lesson field empty on Closeout submit | Field highlighted red; submit disabled |

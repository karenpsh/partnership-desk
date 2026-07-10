# Data Model

## deals
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | owner; FK added at lock-down |
| company | text | |
| industry | text | |
| vertical | text | one of 7 enum values |
| source | text | Inbound / Outbound |
| owner_name | text | denormalised for v1 |
| priority | text | High / Medium / Low |
| stage | text | enforced stage machine value |
| gate | text | current gate name if blocked |
| value_hypothesis_basis | text | one-line rationale |
| value_hypothesis_rm | numeric | RM/year estimate |
| confidence | text | High / Med / Low |
| deposit_impact | text | Positive / Neutral / None |
| next_followup_date | date | |
| revisit_date | date | mandatory if Parked |
| conflict_check_status | text | Pending / Cleared / Unknown |
| conflict_check_confirmed_by | text | |
| status | text | Active / Parked / Killed / Live |
| last_stage_change_at | timestamptz | drives 60-day stall |
| created_at | timestamptz | |
| updated_at | timestamptz | |

## evidence_items
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| deal_id | uuid FK → deals | |
| claim | text | |
| evidence_type | text | Verified / Inferred / Claimed |
| source_url | text | required if Verified |
| is_material | boolean | material Claimed items block Stage 3 |
| waived_by | text | Head name if waived |
| waive_reason | text | logged reason for waiver |
| review_status | text | default 'unreviewed' |

## stage_outputs
Stores every AI generation and its human-confirmed version per stage per deal.
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| deal_id | uuid FK → deals | |
| stage | text | e.g. 'triage', 'research' |
| ai_output | jsonb | raw AI response |
| ai_output_source | text | 'llm' |
| ai_output_confidence | numeric | model self-reported or rule-derived |
| ai_output_review_status | text | unreviewed / confirmed / edited |
| human_edited_output | jsonb | diff from AI if owner edited |
| confirmed_by | text | actor name |
| confirmed_at | timestamptz | |
| prompt_template_version | text | for audit |

## contact_reports
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| deal_id | uuid FK → deals | |
| contact_date | date | |
| channel | text | Call / Email / Meeting / Other |
| raw_notes | text | pasted by owner |
| ai_challenge | text | AI-extracted |
| ai_challenge_source | text | 'llm' |
| ai_challenge_confidence | numeric | |
| ai_challenge_review_status | text | |
| ask_type | text | Time / Information / Management support |
| ask_domain | text | Business / Tech |
| next_step | text | |
| risk_level | text | L / M / H |
| recommended_followup_interval | integer | days |
| confirmed_by | text | |
| confirmed_at | timestamptz | |

## escalations
Auto-created when ask_type = 'Management support'.
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| deal_id | uuid FK → deals | |
| contact_report_id | uuid FK → contact_reports | |
| ai_summary | text | two-line AI draft |
| ai_summary_source | text | 'llm' |
| ai_summary_confidence | numeric | |
| ai_summary_review_status | text | |
| assigned_to_role | text | Approver |
| status | text | Open / Resolved |
| resolved_at | timestamptz | |
| resolution_notes | text | |

## lessons
One per closed deal; tagged by vertical for retrieval injection.
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| deal_id | uuid FK → deals | |
| vertical | text | |
| outcome | text | Won / Lost / Parked |
| what_worked | text | |
| what_stalled | text | |
| deal_shape | text | |
| transferable_lesson | text | mandatory |
| tags | text[] | |

## audit_events
Immutable. No UPDATE/DELETE policies.
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| deal_id | uuid nullable FK → deals | |
| event_type | text | ai_generation / human_edit / gate_approval / stage_transition / escalation_created / stall_triggered |
| actor | text | user name or 'system' |
| prompt_template_version | text | |
| ai_inputs | jsonb | |
| ai_output_snapshot | jsonb | |
| human_edit_snapshot | jsonb | |
| metadata | jsonb | |

## prompt_templates
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| stage | text | |
| version | integer | incremented on each edit |
| template_body | text | |
| is_active | boolean | only one active per stage |
| updated_by | text | Admin actor |

## stall_reviews
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| deal_id | uuid FK → deals | |
| assigned_to_role | text | Head |
| decision | text | Advance / Park / Kill |
| new_revisit_date | date | required if Park |
| decided_by | text | |
| decided_at | timestamptz | |

## RLS summary
- v1: all tables open (permissive policies) — demo-first
- Lock-down sprint: `deals.user_id = auth.uid()` for Managers; Head role bypasses; Approver/Reviewer read-only; audit_events no delete for anyone

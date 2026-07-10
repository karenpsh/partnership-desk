# Intelligence Layer

## Messy inputs per stage
| Stage | Raw input |
|---|---|
| 0 Triage | Pasted inbound email / deck / WhatsApp thread |
| 1 Research | Company name + industry + known context |
| 2 Options | Research brief + confirmed evidence items |
| 3 Proposal | Selected option + value hypothesis + partner profile |
| 4 Meeting Prep | Proposal + contact history + deal context |
| 5 Contact Analysis | Free-text meeting notes |
| 6 Closeout | Owner's free-text outcome summary |

## Structured output schema (example: Stage 0 Triage)
```json
{
  "reframe": "string",
  "levers": {
    "cost_of_funds": { "rating": "Yes|Weak|No", "reasoning": "string" },
    "cac": { "rating": "Yes|Weak|No", "reasoning": "string" },
    "asset_origination": { "rating": "Yes|Weak|No", "reasoning": "string" },
    "fee_income": { "rating": "Yes|Weak|No", "reasoning": "string" }
  },
  "ecosystem_test": "string",
  "red_flags": ["string"],
  "verdict": "Pursue|Park|Decline",
  "drafted_reply": "string"
}
```
Every `stage_outputs.ai_output` follows a stage-specific JSON schema. `ai_output_confidence` is model-reported or rule-derived (e.g. 0.9 if all four levers are Yes, 0.4 if two or more are No).

## Scoring rules (rule-based, v1)
- **Confidence-weighted deal value:** `value_hypothesis_rm × confidence_multiplier` (High=1.0, Med=0.6, Low=0.3)
- **Triage lever score:** 4×Yes=strong, ≥2 No=weak, any red flag=flag for review
- **Deposit-impact coverage:** count of Live deals where `deposit_impact = 'Positive'` ÷ total Live deals
- **Logging compliance:** contact reports filed within 48 h of `contact_date` ÷ total contacts
- **Stall trigger:** `now() - last_stage_change_at > 60 days`

## What gets ranked
- Pipeline board default: confidence-weighted value descending
- Stage 2 options: ranked 1–3 by AI with ecosystem-led flagged first
- Knowledge base lessons: matched by vertical, then recency

## v1 vs later
- **v1:** Rule-based scoring; lessons stored and manually searchable
- **Next:** Retrieval layer injects top 3 vertical-matched lessons into Stage 1–2 prompts automatically
- **Later:** Cross-deal pattern detection; value-hypothesis vs actual revenue actuals loop

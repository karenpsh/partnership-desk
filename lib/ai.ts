import { createClient } from "@/lib/supabase/server";
import type { PromptTemplate } from "@/lib/types";

// Server-side only. The bank-held key lives in Vercel env; it is never sent
// to the browser. All AI calls go through /api/ai/* routes.

export type AiStageKey =
  | "triage"
  | "research"
  | "options"
  | "proposal"
  | "meeting_prep"
  | "contact_analysis";

export const AI_STAGE_KEYS: AiStageKey[] = [
  "triage",
  "research",
  "options",
  "proposal",
  "meeting_prep",
  "contact_analysis",
];

const HARD_RULES = `
Hard content rules: no crypto, no conventional interest, no non-halal categories. Shariah-compliant structures only. UK English. No em dashes. Label unverifiable statements as such.
Respond with ONLY a single valid JSON object matching the requested schema. No markdown fences, no commentary.`;

// Built-in fallbacks so the app keeps working if a prompt_templates row is
// missing. DB rows (Admin-versioned) always take precedence.
const BUILTIN_TEMPLATES: Record<AiStageKey, string> = {
  triage:
    "You are the AI copilot for Anon Partnership Desk. Evaluate the inbound material below. Output: (1) one-sentence reframe of what the party actually wants; (2) four-lever scoring, cost of funds / CAC / asset origination / fee income, each rated Yes/Weak/No with one-line reasoning; (3) ecosystem test, does this use the Anon mall/hypermarket/supplier/tenant/shopper network?; (4) red-flag checklist: one-way value, vendor-in-disguise, Shariah doubt, manufactured urgency, bank-agnostic pitch; (5) verdict: Pursue / Park / Decline with a drafted holding reply or courteous decline.",
  research:
    "You are the AI copilot for Anon Partnership Desk. Produce a company research brief for the target below. Include: scale, recent moves, likely financial needs, visible banking relationships, and every Anon ecosystem touchpoint found or inferable. Label every claim Verified (source URL), Inferred (reasoning stated), or Claimed (partner-supplied). End with the three load-bearing facts the owner must independently confirm.",
  options:
    "You are the AI copilot for Anon Partnership Desk. Generate exactly three collaboration options for the deal below. Each option: mapped vertical, value exchange, revenue mechanism, partner motivation, ecosystem-led or bank-led flag. Rank them. If all three are bank-led, add a plain warning.",
  proposal:
    "You are the AI copilot for Anon Partnership Desk. Draft a one-page partnership proposal (under 400 words) in the partner's language for the deal below, based on the selected option and value hypothesis. Name the Shariah structure used. Structure: the opportunity, the proposed collaboration, what each side brings, commercial terms in principle, next step.",
  meeting_prep:
    "You are the AI copilot for Anon Partnership Desk. Produce a meeting prep sheet for the deal below: the objective, an opening angle, five ranked likely objections each with a response, who to bring (a retail or leasing colleague is required when the Anon ecosystem is the lead card), and one thing not to do. This is a prep sheet, not a script.",
  contact_analysis:
    "You are the AI copilot for Anon Partnership Desk. Structure the raw contact notes below into a contact report. Extract: the partner's core challenge, ask type (Time / Information / Management support), ask domain (Business / Tech), the next step, risk level (L/M/H), and a recommended follow-up interval in days. Also write a two-line summary suitable for management escalation.",
};

const OUTPUT_SCHEMAS: Record<AiStageKey, string> = {
  triage: `{
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
}`,
  research: `{
  "brief": {
    "scale": "string",
    "recent_moves": "string",
    "likely_financial_needs": "string",
    "visible_banking_relationships": "string",
    "ecosystem_touchpoints": "string"
  },
  "evidence": [
    { "claim": "string", "evidence_type": "Verified|Inferred|Claimed", "source_url": "string or null", "is_material": true }
  ],
  "load_bearing_facts": ["string", "string", "string"]
}`,
  options: `{
  "options": [
    { "rank": 1, "title": "string", "vertical": "one of the seven verticals", "value_exchange": "string", "revenue_mechanism": "string", "partner_motivation": "string", "led_by": "ecosystem|bank" }
  ],
  "warning": "string or null"
}`,
  proposal: `{
  "proposal_text": "string (under 400 words, UK English, Shariah structure named)",
  "shariah_structure": "string"
}`,
  meeting_prep: `{
  "objective": "string",
  "opening_angle": "string",
  "objections": [ { "objection": "string", "response": "string" } ],
  "who_to_bring": "string",
  "one_thing_not_to_do": "string"
}`,
  contact_analysis: `{
  "challenge": "string",
  "ask_type": "Time|Information|Management support",
  "ask_domain": "Business|Tech",
  "next_step": "string",
  "risk_level": "L|M|H",
  "recommended_followup_interval": 7,
  "two_line_summary": "string"
}`,
};

export async function getActiveTemplate(
  stage: AiStageKey,
): Promise<{ body: string; version: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prompt_templates")
    .select("*")
    .eq("stage", stage)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1);
  const row = (data?.[0] ?? null) as PromptTemplate | null;
  if (row) return { body: row.template_body, version: `${stage}-v${row.version}` };
  return { body: BUILTIN_TEMPLATES[stage], version: `${stage}-builtin` };
}

export interface AiResult {
  ok: boolean;
  output: Record<string, unknown> | null;
  confidence: number | null;
  promptVersion: string;
  error: string | null;
}

/** Rule-derived confidence for triage (INTELLIGENCE_LAYER scoring rules). */
function deriveConfidence(stage: AiStageKey, output: Record<string, unknown>): number | null {
  if (stage === "triage") {
    const levers = output.levers as Record<string, { rating?: string }> | undefined;
    if (!levers) return null;
    const ratings = Object.values(levers).map((l) => l?.rating);
    const yes = ratings.filter((r) => r === "Yes").length;
    const no = ratings.filter((r) => r === "No").length;
    if (yes === 4) return 0.9;
    if (no >= 2) return 0.4;
    return 0.65;
  }
  return null;
}

export async function generateStageOutput(
  stage: AiStageKey,
  userInput: string,
): Promise<AiResult> {
  const { body, version } = await getActiveTemplate(stage);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      output: null,
      confidence: null,
      promptVersion: version,
      error: "AI service is not configured (missing API key).",
    };
  }

  const system = `${body}\n${HARD_RULES}\nJSON schema to follow exactly:\n${OUTPUT_SCHEMAS[stage]}`;

  try {
    const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 3000,
        system,
        messages: [{ role: "user", content: userInput }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        output: null,
        confidence: null,
        promptVersion: version,
        error: `AI service returned ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const payload = (await res.json()) as {
      content: { type: string; text?: string }[];
    };
    const text = payload.content?.find((c) => c.type === "text")?.text ?? "";
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const output = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      ok: true,
      output,
      confidence: deriveConfidence(stage, output),
      promptVersion: version,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      output: null,
      confidence: null,
      promptVersion: version,
      error: err instanceof Error ? err.message : "AI call failed.",
    };
  }
}

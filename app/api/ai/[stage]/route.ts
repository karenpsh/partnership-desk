import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import {
  AI_STAGE_KEYS,
  generateStageOutput,
  type AiStageKey,
} from "@/lib/ai";
import { proposalGenerationBlockers } from "@/lib/stages";
import { getSessionUser, canRunAi } from "@/lib/auth";
import {
  rateLimit,
  clientIp,
  tooManyRequests,
  isSameOrigin,
  forbiddenCrossOrigin,
} from "@/lib/security";
import type { Deal, EvidenceItem } from "@/lib/types";

// POST /api/ai/{triage|research|options|proposal|meeting_prep|contact_analysis}
// Body: { dealId: string, input?: string, actor?: string }
// Generates the stage's AI output server-side, stores it in stage_outputs
// (review_status 'unreviewed'), writes an ai_generation audit event, and
// returns the stored row. Generation never advances a stage by itself.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stage: string }> },
) {
  // CSRF defence: this is a cookie-authed POST route handler.
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  const { stage: rawStage } = await params;
  const stage = rawStage.replace(/-/g, "_") as AiStageKey;
  if (!AI_STAGE_KEYS.includes(stage)) {
    return NextResponse.json({ error: "Unknown AI stage." }, { status: 404 });
  }

  // Only Managers and the Head may run the AI copilot. Approver / Reviewer /
  // Admin are read-only over deal work and get a hard 403.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  // Rate-limit AI generation per user (expensive + LLM-cost sensitive).
  const rl = rateLimit(`ai:${user.id}:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  if (!canRunAi(user.role)) {
    return NextResponse.json(
      { error: `Your role (${user.role}) may not run AI stages.` },
      { status: 403 },
    );
  }

  let body: { dealId?: string; input?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { dealId, input = "" } = body;
  const actor = user.fullName;
  // Input validation: strict UUID for dealId, bounded input size.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof dealId !== "string" || !UUID.test(dealId)) {
    return NextResponse.json({ error: "A valid dealId is required." }, { status: 400 });
  }
  if (typeof input !== "string" || input.length > 20_000) {
    return NextResponse.json({ error: "Input is missing or too large." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: dealRow, error: dealError } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .single();
  if (dealError || !dealRow) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  const deal = dealRow as Deal;

  // Hard gate: proposal generation is blocked while material Claimed
  // evidence stands unwaived (PRD F2 Stage 3). Enforced server-side so it
  // cannot be bypassed by prompting or a modified client.
  if (stage === "proposal") {
    const { data: evidenceRows } = await supabase
      .from("evidence_items")
      .select("*")
      .eq("deal_id", dealId);
    const blockers = proposalGenerationBlockers((evidenceRows ?? []) as EvidenceItem[]);
    if (blockers.length > 0) {
      return NextResponse.json(
        { error: "Proposal generation blocked by Claimed evidence.", blockers },
        { status: 409 },
      );
    }
  }

  // Build the model input from deal context plus the caller's raw input.
  const context = [
    `Company: ${deal.company}`,
    deal.industry ? `Industry: ${deal.industry}` : null,
    `Vertical: ${deal.vertical}`,
    `Source: ${deal.source}`,
    deal.value_hypothesis_rm != null
      ? `Value hypothesis: RM ${deal.value_hypothesis_rm}/yr (${deal.value_hypothesis_basis ?? "no basis"}), confidence ${deal.confidence}, deposit impact ${deal.deposit_impact}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Retrieval layer: Stage 1 (research) and Stage 2 (options) generations
  // automatically include the top three vertical-matched lessons from the
  // knowledge base, so the copilot compounds learning across deals.
  let lessonsApplied: { transferable_lesson: string; outcome: string | null; deal_id: string }[] = [];
  if (stage === "research" || stage === "options") {
    const { data: lessonRows } = await supabase
      .from("lessons")
      .select("transferable_lesson, outcome, deal_id, created_at")
      .eq("vertical", deal.vertical)
      .order("created_at", { ascending: false })
      .limit(3);
    lessonsApplied = (lessonRows ?? []).map((l) => ({
      transferable_lesson: l.transferable_lesson as string,
      outcome: (l.outcome as string) ?? null,
      deal_id: l.deal_id as string,
    }));
  }

  const lessonsBlock = lessonsApplied.length
    ? `\n\nRelevant lessons from past ${deal.vertical} deals (apply these):\n` +
      lessonsApplied.map((l, i) => `${i + 1}. ${l.transferable_lesson}`).join("\n")
    : "";
  const userInput = (input ? `${context}\n\n---\n\n${input}` : context) + lessonsBlock;

  const result = await generateStageOutput(stage, userInput);

  if (!result.ok) {
    // Graceful degradation: record that the request was made and keep the
    // inputs, so the owner can retry without retyping.
    await writeAudit({
      deal_id: dealId,
      event_type: "ai_generation",
      actor,
      prompt_template_version: result.promptVersion,
      ai_inputs: { stage, input },
      metadata: { status: "unavailable", error: result.error },
    });
    const { data: queuedRow } = await supabase
      .from("stage_outputs")
      .insert({
        deal_id: dealId,
        stage,
        ai_output: { queued: true, saved_input: input },
        ai_output_source: "queued",
        ai_output_review_status: "queued",
        prompt_template_version: result.promptVersion,
      })
      .select()
      .single();
    return NextResponse.json(
      {
        error: "AI unavailable — inputs saved, try again shortly.",
        detail: result.error,
        stageOutput: queuedRow ?? null,
      },
      { status: 503 },
    );
  }

  // Record which knowledge-base lessons the retrieval layer applied, so the
  // brief shows them and the provenance is auditable.
  const outputWithLessons =
    lessonsApplied.length > 0
      ? { ...result.output, lessons_applied: lessonsApplied }
      : result.output;

  const { data: stored, error: storeError } = await supabase
    .from("stage_outputs")
    .insert({
      deal_id: dealId,
      stage,
      ai_output: outputWithLessons,
      ai_output_source: "llm",
      ai_output_confidence: result.confidence,
      ai_output_review_status: "unreviewed",
      prompt_template_version: result.promptVersion,
    })
    .select()
    .single();
  if (storeError || !stored) {
    console.error("[ai:store]", storeError?.message);
    return NextResponse.json({ error: "Could not store AI output." }, { status: 500 });
  }

  // Stage 1 Research: create typed evidence items from the AI brief.
  let evidenceCreated = 0;
  if (stage === "research" && Array.isArray(result.output?.evidence)) {
    const rows = (result.output.evidence as Record<string, unknown>[])
      .filter((e) => typeof e.claim === "string" && e.claim)
      .map((e) => ({
        deal_id: dealId,
        claim: String(e.claim),
        evidence_type: ["Verified", "Inferred", "Claimed"].includes(String(e.evidence_type))
          ? String(e.evidence_type)
          : "Inferred",
        source_url: e.source_url ? String(e.source_url) : null,
        is_material: Boolean(e.is_material),
        review_status: "unreviewed",
      }));
    if (rows.length > 0) {
      const { data: ev } = await supabase.from("evidence_items").insert(rows).select();
      evidenceCreated = ev?.length ?? 0;
    }
  }

  await writeAudit({
    deal_id: dealId,
    event_type: "ai_generation",
    actor,
    prompt_template_version: result.promptVersion,
    ai_inputs: { stage, input, lessons_applied: lessonsApplied.map((l) => l.transferable_lesson) },
    ai_output_snapshot: result.output,
    metadata: {
      stage_output_id: (stored as { id: string }).id,
      evidenceCreated,
      lessonsApplied: lessonsApplied.length,
    },
  });

  return NextResponse.json({ stageOutput: stored, evidenceCreated, lessonsApplied: lessonsApplied.length });
}

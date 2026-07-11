import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseInbound } from "@/lib/inbound";

// Inbound email ingestion (Phase 2). An email provider's inbound-parse
// webhook (or a manual forward) POSTs here; a deal is auto-created at Stage 0
// in the PendingInbound state. Per the agentic-layer risk model this is
// medium risk: the deal is NOT active until the Head confirms it in the
// inbound review queue.
//
// Secured by a shared secret: set INBOUND_EMAIL_SECRET in the environment and
// have the provider send it as `x-inbound-secret` (or `?secret=`). If the
// secret is not configured the endpoint refuses all requests (secure default).
export async function POST(req: NextRequest) {
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Inbound ingestion is not configured (INBOUND_EMAIL_SECRET unset)." },
      { status: 503 },
    );
  }
  const provided =
    req.headers.get("x-inbound-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseInbound(payload);
  if (!parsed.from && !parsed.subject && !parsed.body) {
    return NextResponse.json({ error: "Empty inbound message." }, { status: 400 });
  }

  // Service-role: the webhook has no user session, and the deal must exist for
  // the Head to review it. It is created inactive (PendingInbound).
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured for ingestion." }, { status: 503 });
  }

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      company: parsed.company,
      vertical: parsed.vertical,
      source: "Inbound",
      stage: "Triage",
      status: "PendingInbound",
      priority: "Medium",
      confidence: "Low",
      deposit_impact: "Neutral",
      conflict_check_status: "Pending",
      last_stage_change_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error || !deal) {
    return NextResponse.json({ error: `Could not create inbound deal: ${error?.message}` }, { status: 500 });
  }

  // Store the raw email as a queued triage input so the Head/owner can run
  // Stage 0 Triage on it directly once confirmed.
  const emailText = [
    parsed.from ? `From: ${parsed.from}` : null,
    parsed.subject ? `Subject: ${parsed.subject}` : null,
    "",
    parsed.body,
  ]
    .filter((x) => x !== null)
    .join("\n");
  await supabase.from("stage_outputs").insert({
    deal_id: deal.id,
    stage: "triage",
    ai_output: { queued: true, saved_input: emailText, inbound: { from: parsed.from, subject: parsed.subject } },
    ai_output_source: "inbound",
    ai_output_review_status: "queued",
  });

  await supabase.from("audit_events").insert({
    deal_id: deal.id,
    event_type: "inbound_received",
    actor: "system",
    ai_inputs: { from: parsed.from, subject: parsed.subject },
    metadata: { company: parsed.company, vertical: parsed.vertical },
  });

  return NextResponse.json({ ok: true, dealId: deal.id, company: parsed.company }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import type { Deal, StallReview } from "@/lib/types";

// Daily background job (Vercel Cron, see vercel.json; also manually
// triggerable for testing per the test plan). Responsibilities:
//   1. 60-day stall trigger: open a stall review task for the Head on every
//      Active deal whose stage has not changed in > 60 days.
//   2. Follow-up reminders: email for deals whose next_followup_date is due
//      or overdue (deal owner's desk inbox in v1).
//   3. Parked revisit reminders: email when a parked deal's revisit date
//      arrives.
// The board and all deal CRUD work fine when this job never runs — it only
// adds review tasks and reminders (graceful degradation requirement).
export async function GET(req: NextRequest) {
  // When CRON_SECRET is set (Vercel injects it for cron invocations),
  // require it; otherwise allow manual triggering.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The cron job runs with no user session, so it uses the service-role
  // client (bypasses RLS) to scan all deals and write review tasks / audit
  // rows. Falls back to the anon client if the service key is missing, in
  // which case RLS simply limits what it can do — the app never breaks.
  const supabase = createServiceClient() ?? (await createClient());
  const audit = (entry: Record<string, unknown>) =>
    supabase.from("audit_events").insert(entry);
  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    stallReviewsCreated: 0,
    followupReminders: 0,
    revisitReminders: 0,
    emailErrors: [] as string[],
  };

  const [dealsRes, stallsRes, remindersRes] = await Promise.all([
    supabase.from("deals").select("*"),
    supabase.from("stall_reviews").select("*").is("decision", null),
    supabase
      .from("audit_events")
      .select("*")
      .eq("event_type", "followup_reminder")
      .gte("created_at", `${today}T00:00:00Z`),
  ]);
  if (dealsRes.error) {
    return NextResponse.json({ error: dealsRes.error.message }, { status: 500 });
  }

  const deals = (dealsRes.data ?? []) as Deal[];
  const pendingStallDealIds = new Set(
    ((stallsRes.data ?? []) as StallReview[]).map((s) => s.deal_id),
  );
  const remindedToday = new Set(
    (remindersRes.data ?? []).map(
      (e) => (e.metadata as { deal_id?: string })?.deal_id ?? e.deal_id,
    ),
  );

  const now = Date.now();
  const MS_60_DAYS = 60 * 86_400_000;

  for (const deal of deals) {
    // 1. Stall trigger
    if (
      deal.status === "Active" &&
      now - new Date(deal.last_stage_change_at).getTime() > MS_60_DAYS &&
      !pendingStallDealIds.has(deal.id)
    ) {
      const { error } = await supabase.from("stall_reviews").insert({
        deal_id: deal.id,
        assigned_to_role: "Head",
      });
      if (!error) {
        summary.stallReviewsCreated++;
        await audit({
          deal_id: deal.id,
          event_type: "stall_triggered",
          actor: "system",
          metadata: {
            last_stage_change_at: deal.last_stage_change_at,
            stage: deal.stage,
          },
        });
      }
    }

    // 2. Follow-up reminder (due today or overdue), once per deal per day
    if (
      deal.status === "Active" &&
      deal.next_followup_date &&
      deal.next_followup_date <= today &&
      !remindedToday.has(deal.id)
    ) {
      const result = await sendEmail(
        `Follow-up due: ${deal.company} (${deal.owner_name ?? "unassigned"})`,
        `<p>The follow-up for <strong>${deal.company}</strong> (owner: ${deal.owner_name ?? "unassigned"}, stage: ${deal.stage}) was due on ${deal.next_followup_date}.</p><p>Log the contact or set a new follow-up date in Partnership Desk.</p>`,
      );
      if (result.sent) summary.followupReminders++;
      else if (result.reason) summary.emailErrors.push(result.reason);
      await audit({
        deal_id: deal.id,
        event_type: "followup_reminder",
        actor: "system",
        metadata: { deal_id: deal.id, due: deal.next_followup_date, emailed: result.sent },
      });
    }

    // 3. Parked revisit reminder on the revisit date
    if (deal.status === "Parked" && deal.revisit_date === today) {
      const result = await sendEmail(
        `Parked deal revisit: ${deal.company}`,
        `<p><strong>${deal.company}</strong> was parked with a revisit date of ${deal.revisit_date}. Review whether to reactivate it.</p>`,
      );
      if (result.sent) summary.revisitReminders++;
      else if (result.reason) summary.emailErrors.push(result.reason);
      await audit({
        deal_id: deal.id,
        event_type: "followup_reminder",
        actor: "system",
        metadata: { deal_id: deal.id, revisit: deal.revisit_date, emailed: result.sent },
      });
    }
  }

  // Dedupe repeated email errors for a readable summary
  summary.emailErrors = [...new Set(summary.emailErrors)];
  return NextResponse.json({ ok: true, date: today, ...summary });
}

export const POST = GET;

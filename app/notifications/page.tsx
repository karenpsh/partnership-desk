import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { daysUntilFollowup } from "@/lib/stages";
import type { Deal, Escalation, StallReview } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const [dealsRes, escRes, stallRes] = await Promise.all([
    supabase.from("deals").select("*").eq("status", "Active"),
    supabase.from("escalations").select("*").eq("status", "Open"),
    supabase.from("stall_reviews").select("*").is("decision", null),
  ]);

  if (dealsRes.error || escRes.error || stallRes.error) {
    const msg = dealsRes.error?.message ?? escRes.error?.message ?? stallRes.error?.message;
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
        Could not load notifications: {msg}
      </div>
    );
  }

  const deals = (dealsRes.data ?? []) as Deal[];
  const escalations = (escRes.data ?? []) as Escalation[];
  const stallReviews = (stallRes.data ?? []) as StallReview[];
  const companyById = new Map(deals.map((d) => [d.id, d.company]));

  const overdue = deals
    .map((d) => ({ deal: d, days: daysUntilFollowup(d) }))
    .filter((x): x is { deal: Deal; days: number } => x.days != null && x.days < 0)
    .sort((a, b) => a.days - b.days);

  const total = overdue.length + escalations.length + stallReviews.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Overdue follow-ups, open escalations and pending stall reviews.
        </p>
      </div>

      {total === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center text-sm text-neutral-500">
          Nothing needs attention. The pipeline is clean.
        </div>
      )}

      {escalations.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Open escalations ({escalations.length})
          </h2>
          {escalations.map((e) => (
            <Link
              key={e.id}
              href={`/deals/${e.deal_id}`}
              className="block rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 hover:bg-violet-100"
            >
              <p className="text-sm font-medium text-violet-900">
                {companyById.get(e.deal_id) ?? "Deal"} — routed to {e.assigned_to_role}
              </p>
              <p className="mt-0.5 text-sm text-violet-800">{e.ai_summary ?? "Management support requested."}</p>
            </Link>
          ))}
        </section>
      )}

      {overdue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Overdue follow-ups ({overdue.length})
          </h2>
          {overdue.map(({ deal, days }) => (
            <Link
              key={deal.id}
              href={`/deals/${deal.id}`}
              className="block rounded-lg border border-red-200 bg-red-50 px-4 py-3 hover:bg-red-100"
            >
              <p className="text-sm font-medium text-red-900">{deal.company}</p>
              <p className="mt-0.5 text-sm text-red-700">
                Follow-up was due {Math.abs(days)} day{Math.abs(days) === 1 ? "" : "s"} ago (
                {deal.next_followup_date}) · Owner: {deal.owner_name}
              </p>
            </Link>
          ))}
        </section>
      )}

      {stallReviews.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Pending stall reviews ({stallReviews.length})
          </h2>
          {stallReviews.map((s) => (
            <Link
              key={s.id}
              href={`/deals/${s.deal_id}`}
              className="block rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 hover:bg-orange-100"
            >
              <p className="text-sm font-medium text-orange-900">
                {companyById.get(s.deal_id) ?? "Deal"} — stalled, awaiting {s.assigned_to_role} decision
              </p>
              <p className="mt-0.5 text-sm text-orange-700">
                Raised {new Date(s.created_at).toLocaleDateString("en-GB")}
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

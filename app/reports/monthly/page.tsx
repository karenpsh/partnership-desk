import { createClient } from "@/lib/supabase/server";
import { formatRM } from "@/lib/stages";
import {
  weightedByVertical,
  weightedByOwner,
  totalWeighted,
  funnelByStage,
  depositImpactCoverage,
  statusCounts,
  loggingCompliance,
  inboundByIndustry,
} from "@/lib/metrics";
import type { ContactReport, Deal, Lesson } from "@/lib/types";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

// Server-rendered monthly management pack. Print-to-PDF from the browser
// produces the exportable pack (server-rendered figures, no client compute).
export default async function MonthlyReportPage() {
  const supabase = await createClient();
  const [dealsRes, contactsRes, lessonsRes] = await Promise.all([
    supabase.from("deals").select("*"),
    supabase.from("contact_reports").select("*"),
    supabase.from("lessons").select("*").order("created_at", { ascending: false }),
  ]);

  const deals = (dealsRes.data ?? []) as Deal[];
  const contacts = (contactsRes.data ?? []) as ContactReport[];
  const lessons = (lessonsRes.data ?? []) as Lesson[];

  const byVertical = weightedByVertical(deals);
  const byOwner = weightedByOwner(deals);
  const counts = statusCounts(deals);
  const deposit = depositImpactCoverage(deals);
  const logging = loggingCompliance(contacts);
  const funnel = funnelByStage(deals).filter((f) => f.count > 0);
  const inbound = inboundByIndustry(deals);
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-500">
          Print or save as PDF (⌘/Ctrl-P) for the management pack.
        </p>
        <PrintButton />
      </div>

      <article className="rounded-lg border border-neutral-200 bg-white p-8 print:border-0 print:p-0">
        <header className="border-b border-neutral-200 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">Partnership Desk — Monthly Pack</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Anon Partnerships · confidence-weighted pipeline report
          </p>
        </header>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Headline
          </h2>
          <table className="mt-2 w-full text-sm">
            <tbody>
              <Row k="Confidence-weighted pipeline (ex-Killed)" v={formatRM(totalWeighted(deals))} />
              <Row k="Active deals" v={String(counts.active)} />
              <Row k="Live deals" v={String(counts.live)} />
              <Row k="Parked / Killed" v={`${counts.parked} / ${counts.killed}`} />
              <Row k="Stalled (>60 days)" v={String(counts.stalled)} />
              <Row
                k="Deposit-impact coverage (Live)"
                v={`${pct(deposit.rate)} (${deposit.positive}/${deposit.live})`}
              />
              <Row
                k="Logging compliance (48h)"
                v={`${pct(logging.rate)} (${logging.onTime}/${logging.total})`}
              />
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Weighted value by vertical
          </h2>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {byVertical.map((v) => (
                <Row key={v.vertical} k={`${v.vertical} (${v.count})`} v={formatRM(v.weighted)} />
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Weighted value by owner
          </h2>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {byOwner.map((o) => (
                <Row key={o.owner} k={`${o.owner} (${o.count})`} v={formatRM(o.weighted)} />
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Funnel &amp; inbound mix
          </h2>
          <p className="mt-2 text-sm text-neutral-700">
            {funnel.map((f) => `${f.stage}: ${f.count}`).join(" · ") || "No deals."}
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            Inbound by industry:{" "}
            {inbound.map((i) => `${i.industry} (${i.count})`).join(", ") || "none"}
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Lessons filed ({lessons.length})
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {lessons.slice(0, 12).map((l) => (
              <li key={l.id}>
                <span className="font-medium">{l.vertical}</span> — {l.transferable_lesson}
              </li>
            ))}
            {lessons.length === 0 && <li className="text-neutral-400">No lessons filed yet.</li>}
          </ul>
        </section>
      </article>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="py-1.5 pr-4 text-neutral-600">{k}</td>
      <td className="py-1.5 text-right font-medium tabular-nums text-neutral-900">{v}</td>
    </tr>
  );
}

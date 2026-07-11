import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { formatRM } from "@/lib/stages";
import {
  weightedByVertical,
  weightedByOwner,
  totalWeighted,
  funnelByStage,
  depositImpactCoverage,
  statusCounts,
  triageOutcomes,
  inboundByIndustry,
  loggingCompliance,
} from "@/lib/metrics";
import type { ContactReport, Deal, StageOutput } from "@/lib/types";

export const dynamic = "force-dynamic";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function Bar({ value, max, label, right }: { value: number; max: number; label: string; right: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-700">{label}</span>
        <span className="font-medium tabular-nums text-neutral-800">{right}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-100">
        <div className="h-2 rounded-full bg-violet-600" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  const supabase = await createClient();
  const [dealsRes, outputsRes, contactsRes] = await Promise.all([
    supabase.from("deals").select("*"),
    supabase.from("stage_outputs").select("*"),
    supabase.from("contact_reports").select("*"),
  ]);

  if (dealsRes.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
        Could not load dashboard: {dealsRes.error.message}
      </div>
    );
  }

  // Exclude PendingInbound (not yet in the pipeline) from all figures.
  const deals = ((dealsRes.data ?? []) as Deal[]).filter((d) => d.status !== "PendingInbound");
  const outputs = (outputsRes.data ?? []) as StageOutput[];
  const contacts = (contactsRes.data ?? []) as ContactReport[];

  const byVertical = weightedByVertical(deals);
  const byOwner = weightedByOwner(deals);
  const total = totalWeighted(deals);
  const funnel = funnelByStage(deals);
  const deposit = depositImpactCoverage(deals);
  const counts = statusCounts(deals);
  const triage = triageOutcomes(outputs);
  const inbound = inboundByIndustry(deals);
  const logging = loggingCompliance(contacts);

  const maxVertical = Math.max(1, ...byVertical.map((v) => v.weighted));
  const maxOwner = Math.max(1, ...byOwner.map((o) => o.weighted));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {user && (user.role === "Manager")
              ? "Your pipeline, confidence-weighted. Figures reflect the deals you own."
              : "Pipeline value, health and trends across the desk. Every figure is computed live from the deals table."}
          </p>
        </div>
        <Link
          href="/reports/monthly"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Monthly report pack →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Weighted pipeline" value={formatRM(total)} sub="confidence-weighted, ex-Killed" />
        <StatTile label="Active" value={String(counts.active)} />
        <StatTile label="Live" value={String(counts.live)} />
        <StatTile label="Parked" value={String(counts.parked)} />
        <StatTile label="Killed" value={String(counts.killed)} />
        <StatTile label="Stalled" value={String(counts.stalled)} sub=">60 days no change" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Confidence-weighted value by vertical
          </h2>
          <div className="space-y-3">
            {byVertical.length === 0 && <p className="text-sm text-neutral-400">No deals yet.</p>}
            {byVertical.map((v) => (
              <Bar
                key={v.vertical}
                label={`${v.vertical} (${v.count})`}
                value={v.weighted}
                max={maxVertical}
                right={formatRM(v.weighted)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Confidence-weighted value by owner
          </h2>
          <div className="space-y-3">
            {byOwner.length === 0 && <p className="text-sm text-neutral-400">No deals yet.</p>}
            {byOwner.map((o) => (
              <Bar
                key={o.owner}
                label={`${o.owner} (${o.count})`}
                value={o.weighted}
                max={maxOwner}
                right={formatRM(o.weighted)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Funnel — deals by stage
          </h2>
          <div className="space-y-2">
            {funnel.map((f) => (
              <Bar key={f.stage} label={f.stage} value={f.count} max={maxFunnel} right={String(f.count)} />
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Deposit-impact coverage
            </h2>
            <p className="text-3xl font-semibold tracking-tight">{pct(deposit.rate)}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {deposit.positive} of {deposit.live} Live deals are deposit-positive (target ≥ 30%).
            </p>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Logging compliance
            </h2>
            <p className="text-3xl font-semibold tracking-tight">{pct(logging.rate)}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {logging.onTime} of {logging.total} contact reports filed within 48h (target &gt; 90%).
            </p>
          </section>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Inbound triage outcomes
          </h2>
          {triage.length === 0 ? (
            <p className="text-sm text-neutral-400">No triage runs recorded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {triage.map((t) => (
                <span
                  key={t.verdict}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm"
                >
                  <span className="font-medium">{t.verdict}</span>{" "}
                  <span className="text-neutral-500">× {t.count}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Inbound inquiries by industry (market intelligence)
          </h2>
          {inbound.length === 0 ? (
            <p className="text-sm text-neutral-400">No inbound deals yet.</p>
          ) : (
            <div className="space-y-2">
              {inbound.map((i) => (
                <Bar
                  key={i.industry}
                  label={i.industry}
                  value={i.count}
                  max={Math.max(1, ...inbound.map((x) => x.count))}
                  right={String(i.count)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

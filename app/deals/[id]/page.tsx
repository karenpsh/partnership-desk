import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeChips, daysSinceStageChange, formatRM, weightedValue } from "@/lib/stages";
import type { Deal, EvidenceItem, StageOutput } from "@/lib/types";
import { StatusChips } from "@/app/components/chips";
import { DealEditForm } from "./deal-edit-form";
import { StageWorkflow } from "./stage-workflow";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.from("deals").select("*").eq("id", id).single();
  if (error || !data) notFound();
  const deal = data as Deal;

  const [evidenceRes, outputsRes, escRes] = await Promise.all([
    supabase.from("evidence_items").select("*").eq("deal_id", id).order("created_at", { ascending: true }),
    supabase.from("stage_outputs").select("*").eq("deal_id", id),
    supabase.from("escalations").select("*").eq("deal_id", id).eq("status", "Open"),
  ]);

  const evidence = (evidenceRes.data ?? []) as EvidenceItem[];
  const outputs = (outputsRes.data ?? []) as StageOutput[];
  const openEscalations = escRes.data ?? [];
  const chips = computeChips(deal, new Set(openEscalations.length ? [deal.id] : []));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-violet-700 hover:underline">
          ← Back to Board
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{deal.company}</h1>
          <span className="rounded-md bg-neutral-200 px-2 py-0.5 text-sm font-medium text-neutral-700">
            {deal.stage}
          </span>
          <StatusChips chips={chips} status={deal.status} />
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {deal.vertical} · {deal.source} · Owner: {deal.owner_name ?? "—"} · Weighted value:{" "}
          <span className="font-medium text-neutral-700">{formatRM(weightedValue(deal))}</span> · In
          stage {daysSinceStageChange(deal)} day{daysSinceStageChange(deal) === 1 ? "" : "s"}
        </p>
      </div>

      {openEscalations.length > 0 && (
        <div className="rounded-md border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <span className="font-semibold">Escalation open:</span>{" "}
          {(openEscalations[0].ai_summary as string) ?? "Management support requested."}{" "}
          <Link href="/notifications" className="underline">
            View escalations
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <StageWorkflow deal={deal} evidence={evidence} outputs={outputs} />
        <div className="space-y-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Deal record
            </h2>
            <div className="mt-3">
              <DealEditForm deal={deal} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

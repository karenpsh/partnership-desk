import type { ContactReport, Deal, Lesson, StageOutput } from "./types";
import { STAGES, weightedValue, CONFIDENCE_MULTIPLIER } from "./stages";

export interface VerticalValue {
  vertical: string;
  weighted: number;
  raw: number;
  count: number;
}

export function weightedByVertical(deals: Deal[]): VerticalValue[] {
  const map = new Map<string, VerticalValue>();
  for (const d of deals) {
    if (d.status === "Killed") continue;
    const cur =
      map.get(d.vertical) ?? { vertical: d.vertical, weighted: 0, raw: 0, count: 0 };
    cur.weighted += weightedValue(d);
    cur.raw += Number(d.value_hypothesis_rm ?? 0);
    cur.count += 1;
    map.set(d.vertical, cur);
  }
  return [...map.values()].sort((a, b) => b.weighted - a.weighted);
}

export interface OwnerValue {
  owner: string;
  weighted: number;
  count: number;
}

export function weightedByOwner(deals: Deal[]): OwnerValue[] {
  const map = new Map<string, OwnerValue>();
  for (const d of deals) {
    if (d.status === "Killed") continue;
    const owner = d.owner_name ?? "Unassigned";
    const cur = map.get(owner) ?? { owner, weighted: 0, count: 0 };
    cur.weighted += weightedValue(d);
    cur.count += 1;
    map.set(owner, cur);
  }
  return [...map.values()].sort((a, b) => b.weighted - a.weighted);
}

export function totalWeighted(deals: Deal[]): number {
  return deals
    .filter((d) => d.status !== "Killed")
    .reduce((sum, d) => sum + weightedValue(d), 0);
}

export interface FunnelStage {
  stage: string;
  count: number;
}

export function funnelByStage(deals: Deal[]): FunnelStage[] {
  const counts = new Map<string, number>();
  for (const d of deals) counts.set(d.stage, (counts.get(d.stage) ?? 0) + 1);
  return STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
}

/** Live deals with a Positive deposit impact ÷ total Live deals. */
export function depositImpactCoverage(deals: Deal[]): {
  positive: number;
  live: number;
  rate: number;
} {
  const live = deals.filter((d) => d.status === "Live");
  const positive = live.filter((d) => d.deposit_impact === "Positive").length;
  return { positive, live: live.length, rate: live.length ? positive / live.length : 0 };
}

export function statusCounts(deals: Deal[]): {
  active: number;
  parked: number;
  killed: number;
  live: number;
  stalled: number;
} {
  const MS = 86_400_000;
  const now = Date.now();
  let stalled = 0;
  for (const d of deals) {
    if (d.status === "Active" && now - new Date(d.last_stage_change_at).getTime() > 60 * MS)
      stalled++;
  }
  return {
    active: deals.filter((d) => d.status === "Active").length,
    parked: deals.filter((d) => d.status === "Parked").length,
    killed: deals.filter((d) => d.status === "Killed").length,
    live: deals.filter((d) => d.status === "Live").length,
    stalled,
  };
}

export interface TriageOutcome {
  verdict: string;
  count: number;
}

/** Inbound triage outcomes from confirmed triage stage outputs. */
export function triageOutcomes(outputs: StageOutput[]): TriageOutcome[] {
  const counts = new Map<string, number>();
  for (const o of outputs) {
    if (o.stage !== "triage") continue;
    const src = (o.human_edited_output ?? o.ai_output) as { verdict?: string } | null;
    const verdict = src?.verdict ?? "Unreviewed";
    counts.set(verdict, (counts.get(verdict) ?? 0) + 1);
  }
  return [...counts.entries()].map(([verdict, count]) => ({ verdict, count }));
}

/** Inbound deals grouped by industry (market-intelligence view). */
export function inboundByIndustry(deals: Deal[]): { industry: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of deals) {
    if (d.source !== "Inbound") continue;
    const industry = d.industry ?? "Unspecified";
    counts.set(industry, (counts.get(industry) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count);
}

/** Contact reports filed within 48h of contact_date ÷ total contacts. */
export function loggingCompliance(reports: ContactReport[]): {
  onTime: number;
  total: number;
  rate: number;
} {
  const MS_48H = 48 * 3_600_000;
  let onTime = 0;
  for (const r of reports) {
    if (!r.confirmed_at || !r.contact_date) continue;
    const contact = new Date(r.contact_date + "T00:00:00").getTime();
    const filed = new Date(r.confirmed_at).getTime();
    if (filed - contact <= MS_48H) onTime++;
  }
  return { onTime, total: reports.length, rate: reports.length ? onTime / reports.length : 0 };
}

export const CONFIDENCE_WEIGHTS = CONFIDENCE_MULTIPLIER;

/** Top N lessons for a vertical, most recent first (retrieval ranking). */
export function topLessonsForVertical(lessons: Lesson[], vertical: string, n = 3): Lesson[] {
  return lessons
    .filter((l) => l.vertical === vertical)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, n);
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STAGES, formatRM, needsAttention, type DealChips } from "@/lib/stages";
import type { Deal, Stage } from "@/lib/types";
import { StatusChips } from "./components/chips";

export interface BoardDeal {
  deal: Deal;
  chips: DealChips;
  weighted: number;
}

type ViewMode = "kanban" | "table";

export function BoardView({
  deals,
  escalationCount,
}: {
  deals: BoardDeal[];
  escalationCount: number;
}) {
  const [view, setView] = useState<ViewMode>("kanban");
  const [meetingMode, setMeetingMode] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [verticalFilter, setVerticalFilter] = useState("");

  const owners = useMemo(
    () => [...new Set(deals.map((d) => d.deal.owner_name).filter(Boolean))] as string[],
    [deals],
  );
  const verticals = useMemo(
    () => [...new Set(deals.map((d) => d.deal.vertical))],
    [deals],
  );

  const filtered = useMemo(() => {
    let list = deals;
    if (ownerFilter) list = list.filter((d) => d.deal.owner_name === ownerFilter);
    if (verticalFilter) list = list.filter((d) => d.deal.vertical === verticalFilter);
    // Default sort: confidence-weighted value descending; meeting mode puts
    // overdue + stalled + escalated deals first.
    return [...list].sort((a, b) => {
      if (meetingMode) {
        const na = needsAttention(a.chips) ? 1 : 0;
        const nb = needsAttention(b.chips) ? 1 : 0;
        if (na !== nb) return nb - na;
      }
      return b.weighted - a.weighted;
    });
  }, [deals, ownerFilter, verticalFilter, meetingMode]);

  const attentionCount = deals.filter((d) => needsAttention(d.chips)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight mr-2">Pipeline</h1>
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-sm">
          {(["kanban", "table"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setView(m)}
              className={`rounded px-3 py-1 capitalize ${
                view === m ? "bg-violet-700 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={() => setMeetingMode((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            meetingMode
              ? "border-violet-700 bg-violet-700 text-white"
              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
          }`}
        >
          Meeting mode{attentionCount > 0 ? ` (${attentionCount})` : ""}
        </button>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">All verticals</option>
          {verticals.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        {escalationCount > 0 && (
          <Link
            href="/notifications"
            className="ml-auto rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-100"
          >
            {escalationCount} open escalation{escalationCount > 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {meetingMode && (
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          Meeting mode: overdue, stalled and escalated deals are listed first in every
          column.
        </div>
      )}

      {view === "kanban" ? (
        <KanbanView deals={filtered} />
      ) : (
        <TableView deals={filtered} />
      )}
    </div>
  );
}

function DealCard({ item }: { item: BoardDeal }) {
  const { deal, chips, weighted } = item;
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block rounded-lg border border-neutral-200 bg-white p-3 shadow-sm hover:border-violet-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium leading-tight">{deal.company}</span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
            deal.priority === "High"
              ? "bg-red-50 text-red-700"
              : deal.priority === "Medium"
                ? "bg-amber-50 text-amber-700"
                : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {deal.priority}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-500">{deal.vertical}</p>
      <p className="mt-1.5 text-sm font-semibold text-neutral-800">
        {deal.value_hypothesis_rm != null ? (
          <>
            {formatRM(weighted)}
            <span className="ml-1 font-normal text-xs text-neutral-400">
              weighted ({deal.confidence})
            </span>
          </>
        ) : (
          <span className="font-normal text-xs text-neutral-400">No value hypothesis yet</span>
        )}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-neutral-500">{deal.owner_name}</span>
        <StatusChips chips={chips} status={deal.status} />
      </div>
    </Link>
  );
}

function KanbanView({ deals }: { deals: BoardDeal[] }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3" style={{ minWidth: "max-content" }}>
        {STAGES.map((stage: Stage) => {
          const col = deals.filter((d) => d.deal.stage === stage);
          return (
            <div key={stage} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {stage}
                </h3>
                <span className="rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-600">
                  {col.length}
                </span>
              </div>
              <div className="space-y-2 rounded-lg bg-neutral-100/70 p-2 min-h-24">
                {col.map((item) => (
                  <DealCard key={item.deal.id} item={item} />
                ))}
                {col.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs text-neutral-400">No deals</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableView({ deals }: { deals: BoardDeal[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Vertical</th>
            <th className="px-3 py-2">Owner</th>
            <th className="px-3 py-2 text-right">Value (RM/yr)</th>
            <th className="px-3 py-2 text-right">Weighted</th>
            <th className="px-3 py-2">Confidence</th>
            <th className="px-3 py-2">Deposit</th>
            <th className="px-3 py-2">Follow-up</th>
            <th className="px-3 py-2">Chips</th>
          </tr>
        </thead>
        <tbody>
          {deals.map(({ deal, chips, weighted }) => (
            <tr key={deal.id} className="border-b border-neutral-100 last:border-0 hover:bg-violet-50/40">
              <td className="px-3 py-2 font-medium">
                <Link href={`/deals/${deal.id}`} className="hover:text-violet-700">
                  {deal.company}
                </Link>
              </td>
              <td className="px-3 py-2">{deal.stage}</td>
              <td className="px-3 py-2 text-neutral-600">{deal.vertical}</td>
              <td className="px-3 py-2 text-neutral-600">{deal.owner_name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRM(deal.value_hypothesis_rm)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{formatRM(weighted)}</td>
              <td className="px-3 py-2">{deal.confidence}</td>
              <td className="px-3 py-2">{deal.deposit_impact}</td>
              <td className="px-3 py-2 text-neutral-600">{deal.next_followup_date ?? "—"}</td>
              <td className="px-3 py-2">
                <StatusChips chips={chips} status={deal.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

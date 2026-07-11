"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { VERTICALS } from "@/lib/stages";
import type { Lesson } from "@/lib/types";

export interface LessonWithCompany extends Lesson {
  company: string | null;
}

const OUTCOME_BADGE: Record<string, string> = {
  Won: "bg-emerald-100 text-emerald-800",
  Lost: "bg-red-100 text-red-800",
  Parked: "bg-sky-100 text-sky-800",
};

export function KnowledgeBrowser({ lessons }: { lessons: LessonWithCompany[] }) {
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState("");
  const [outcome, setOutcome] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessons.filter((l) => {
      if (vertical && l.vertical !== vertical) return false;
      if (outcome && l.outcome !== outcome) return false;
      if (!q) return true;
      const hay = [
        l.transferable_lesson,
        l.what_worked,
        l.what_stalled,
        l.deal_shape,
        l.company,
        (l.tags ?? []).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [lessons, query, vertical, outcome]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lessons, tags, companies…"
          className="min-w-64 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
        >
          <option value="">All verticals</option>
          {VERTICALS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
        >
          <option value="">All outcomes</option>
          <option>Won</option>
          <option>Lost</option>
          <option>Parked</option>
        </select>
      </div>

      <p className="text-xs text-neutral-400">
        {filtered.length} of {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center text-sm text-neutral-400">
          {lessons.length === 0
            ? "No lessons filed yet. Close out a deal to add the first one."
            : "No lessons match your filters."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((l) => (
            <article key={l.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  {l.vertical}
                </span>
                {l.outcome && (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      OUTCOME_BADGE[l.outcome] ?? "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {l.outcome}
                  </span>
                )}
                {l.company && (
                  <Link
                    href={`/deals/${l.deal_id}`}
                    className="ml-auto text-xs text-violet-700 hover:underline"
                  >
                    {l.company} →
                  </Link>
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-neutral-900">{l.transferable_lesson}</p>
              {l.what_worked && (
                <p className="mt-2 text-xs text-neutral-600">
                  <span className="font-semibold text-neutral-500">What worked: </span>
                  {l.what_worked}
                </p>
              )}
              {l.what_stalled && (
                <p className="mt-1 text-xs text-neutral-600">
                  <span className="font-semibold text-neutral-500">What stalled: </span>
                  {l.what_stalled}
                </p>
              )}
              {l.tags && l.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {l.tags.map((t) => (
                    <span key={t} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideStallReview } from "@/app/actions/stall";
import type { StallReview } from "@/lib/types";

export function StallReviewPanel({
  review,
  daysSinceStageChange,
}: {
  review: StallReview;
  daysSinceStageChange: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [decidedBy, setDecidedBy] = useState("");
  const [revisitDate, setRevisitDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "Advance" | "Park" | "Kill") => {
    setError(null);
    startTransition(async () => {
      const res = await decideStallReview({
        stallReviewId: review.id,
        decision,
        newRevisitDate: revisitDate || undefined,
        decidedBy,
      });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <section className="rounded-lg border border-orange-300 bg-orange-50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-700">
        Stall review — {review.assigned_to_role} decision required
      </h2>
      <p className="mt-1 text-sm text-orange-900">
        No stage change in {daysSinceStageChange} days. The Head of Partnerships must decide:
        advance it, park it with a new revisit date, or kill it. The deal owner does not hold
        the casting vote on their own stalled deal.
      </p>
      {error && (
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-orange-800">
            Decided by (Head)
          </label>
          <input
            value={decidedBy}
            onChange={(e) => setDecidedBy(e.target.value)}
            placeholder="Head of Partnerships name"
            className="w-56 rounded-md border border-orange-300 bg-white px-3 py-1.5 text-sm"
          />
        </div>
        <button
          disabled={pending}
          onClick={() => decide("Advance")}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Advance (keep working)
        </button>
        <div className="flex items-end gap-1">
          <div>
            <label className="mb-1 block text-xs font-medium text-orange-800">
              New revisit date
            </label>
            <input
              type="date"
              value={revisitDate}
              onChange={(e) => setRevisitDate(e.target.value)}
              className="rounded-md border border-orange-300 bg-white px-3 py-1.5 text-sm"
            />
          </div>
          <button
            disabled={pending}
            onClick={() => decide("Park")}
            className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Park
          </button>
        </div>
        <button
          disabled={pending}
          onClick={() => decide("Kill")}
          className="rounded-md bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Kill
        </button>
      </div>
    </section>
  );
}

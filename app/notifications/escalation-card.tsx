"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveEscalation } from "@/app/actions/contact";
import type { Escalation } from "@/lib/types";

export function EscalationCard({
  escalation,
  company,
}: {
  escalation: Escalation;
  company: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/deals/${escalation.deal_id}`} className="text-sm font-medium text-violet-900 hover:underline">
            {company} — routed to {escalation.assigned_to_role}
          </Link>
          <p className="mt-0.5 text-sm text-violet-800">
            {escalation.ai_summary ?? "Management support requested."}
          </p>
          <p className="mt-1 text-xs text-violet-600">
            Raised {new Date(escalation.created_at).toLocaleDateString("en-GB")}
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-md border border-violet-300 bg-white px-3 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100"
        >
          {open ? "Close" : "Resolve"}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-violet-200 pt-3">
          {error && (
            <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Resolved by (Approver name)"
            className="w-full rounded-md border border-violet-200 bg-white px-3 py-1.5 text-sm"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Resolution notes"
            className="w-full rounded-md border border-violet-200 bg-white px-3 py-1.5 text-sm"
          />
          <button
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await resolveEscalation({
                  escalationId: escalation.id,
                  resolvedBy: name,
                  notes,
                });
                if (res.error) setError(res.error);
                else router.refresh();
              });
            }}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {pending ? "Resolving…" : "Mark resolved"}
          </button>
        </div>
      )}
    </div>
  );
}

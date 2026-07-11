"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmInbound, declineInbound } from "@/app/actions/inbound";
import { VERTICALS } from "@/lib/stages";
import type { Deal, Vertical } from "@/lib/types";

export function InboundCard({
  deal,
  email,
  owners,
  headId,
}: {
  deal: Deal;
  email: string;
  owners: { id: string; name: string; role: string }[];
  headId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [company, setCompany] = useState(deal.company);
  const [vertical, setVertical] = useState<Vertical>(deal.vertical);
  const [ownerId, setOwnerId] = useState(headId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);

  const run = (fn: () => Promise<{ error: string | null }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const input =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
          Pending inbound
        </span>
        <span className="text-xs text-neutral-400">
          received {new Date(deal.created_at).toLocaleString("en-GB")}
        </span>
      </div>

      {email && (
        <pre className="mb-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
          {email}
        </pre>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Company</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Vertical</span>
          <select value={vertical} onChange={(e) => setVertical(e.target.value as Vertical)} className={input}>
            {VERTICALS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Assign owner</span>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={input}>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.role})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          disabled={pending}
          onClick={() => run(() => confirmInbound({ dealId: deal.id, company, vertical, ownerId }))}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Confirm &amp; activate
        </button>
        <button
          disabled={pending}
          onClick={() => setDeclineOpen((v) => !v)}
          className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Decline
        </button>
      </div>

      {declineOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (logged)"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button
            disabled={pending}
            onClick={() => run(() => declineInbound({ dealId: deal.id, reason }))}
            className="rounded-md bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Confirm decline
          </button>
        </div>
      )}
    </div>
  );
}

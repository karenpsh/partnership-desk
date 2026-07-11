"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEvidence, setEvidenceType, waiveClaimedEvidence } from "@/app/actions/evidence";
import type { Deal, EvidenceItem } from "@/lib/types";
import { inputCls } from "@/app/deals/new/new-deal-form";

const TYPE_BADGE: Record<string, string> = {
  Verified: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Inferred: "bg-sky-100 text-sky-800 border-sky-200",
  Claimed: "bg-amber-100 text-amber-800 border-amber-200",
};

export function EvidencePanel({ deal, evidence }: { deal: Deal; evidence: EvidenceItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const run = (fn: () => Promise<{ error: string | null }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        setAdding(false);
        router.refresh();
      }
    });
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Evidence ({evidence.length})
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          {adding ? "Close" : "Add evidence"}
        </button>
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        Verified needs a source link. Material Claimed items block proposal generation until
        upgraded or waived by the Head.
      </p>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {adding && (
        <AddEvidenceForm
          onSubmit={(fields) =>
            run(() => addEvidence({ dealId: deal.id, actor: deal.owner_name ?? "unknown", ...fields }))
          }
          pending={pending}
        />
      )}

      <ul className="mt-3 space-y-3">
        {evidence.length === 0 && (
          <li className="rounded-md bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-400">
            No evidence yet. Stage 1 Research creates typed items automatically.
          </li>
        )}
        {evidence.map((item) => (
          <EvidenceRow key={item.id} item={item} deal={deal} run={run} pending={pending} />
        ))}
      </ul>
    </section>
  );
}

function AddEvidenceForm({
  onSubmit,
  pending,
}: {
  onSubmit: (fields: {
    claim: string;
    evidenceType: string;
    sourceUrl?: string;
    isMaterial: boolean;
  }) => void;
  pending: boolean;
}) {
  const [claim, setClaim] = useState("");
  const [type, setType] = useState("Claimed");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isMaterial, setIsMaterial] = useState(false);

  return (
    <div className="mt-3 space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <input
        value={claim}
        onChange={(e) => setClaim(e.target.value)}
        placeholder='Claim, e.g. "Partner has 2M users"'
        className={inputCls()}
      />
      <div className="flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls()}>
          <option>Verified</option>
          <option>Inferred</option>
          <option>Claimed</option>
        </select>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={isMaterial}
            onChange={(e) => setIsMaterial(e.target.checked)}
          />
          Material
        </label>
      </div>
      {type === "Verified" && (
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Source URL (required for Verified)"
          className={inputCls()}
        />
      )}
      <button
        disabled={pending}
        onClick={() => onSubmit({ claim, evidenceType: type, sourceUrl, isMaterial })}
        className="w-full rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add item"}
      </button>
    </div>
  );
}

function EvidenceRow({
  item,
  deal,
  run,
  pending,
}: {
  item: EvidenceItem;
  deal: Deal;
  run: (fn: () => Promise<{ error: string | null }>) => void;
  pending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newType, setNewType] = useState(item.evidence_type);
  const [sourceUrl, setSourceUrl] = useState(item.source_url ?? "");
  const [waiver, setWaiver] = useState({ name: "", reason: "" });

  const blocking = item.evidence_type === "Claimed" && item.is_material && !item.waived_by;

  return (
    <li className={`rounded-md border p-3 ${blocking ? "border-amber-300 bg-amber-50/60" : "border-neutral-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-neutral-800">{item.claim}</p>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-xs text-violet-700 hover:underline"
        >
          {expanded ? "Close" : "Manage"}
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[item.evidence_type]}`}
        >
          {item.evidence_type}
        </span>
        {item.is_material && (
          <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
            Material
          </span>
        )}
        {blocking && (
          <span className="text-[11px] font-medium text-amber-700">Blocks proposal</span>
        )}
        {item.waived_by && (
          <span className="text-[11px] text-neutral-500">
            Waived by {item.waived_by}: {item.waive_reason}
          </span>
        )}
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-violet-700 hover:underline"
          >
            source
          </a>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
          <div className="flex gap-2">
            <select value={newType} onChange={(e) => setNewType(e.target.value as typeof newType)} className={inputCls()}>
              <option>Verified</option>
              <option>Inferred</option>
              <option>Claimed</option>
            </select>
            <button
              disabled={pending}
              onClick={() =>
                run(() =>
                  setEvidenceType({
                    dealId: deal.id,
                    evidenceId: item.id,
                    evidenceType: newType,
                    sourceUrl,
                    actor: deal.owner_name ?? "unknown",
                  }),
                )
              }
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
            >
              Set type
            </button>
          </div>
          {newType === "Verified" && (
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Source URL (required for Verified)"
              className={inputCls()}
            />
          )}
          {blocking && (
            <div className="space-y-2 rounded-md bg-white p-2 ring-1 ring-amber-200">
              <p className="text-xs font-medium text-amber-800">
                Head waiver (high risk, logged to audit)
              </p>
              <input
                value={waiver.name}
                onChange={(e) => setWaiver({ ...waiver, name: e.target.value })}
                placeholder="Head of Partnerships name"
                className={inputCls()}
              />
              <input
                value={waiver.reason}
                onChange={(e) => setWaiver({ ...waiver, reason: e.target.value })}
                placeholder="Reason for waiving this Claimed block"
                className={inputCls()}
              />
              <button
                disabled={pending}
                onClick={() =>
                  run(() =>
                    waiveClaimedEvidence({
                      dealId: deal.id,
                      evidenceId: item.id,
                      waivedBy: waiver.name,
                      reason: waiver.reason,
                    }),
                  )
                }
                className="w-full rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Waive Claimed block
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

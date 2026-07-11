"use client";

import { useActionState, useEffect, useState } from "react";
import { updateDeal, type ActionState } from "@/app/actions/deals";
import { VERTICALS, formatRM } from "@/lib/stages";
import type { Deal } from "@/lib/types";
import { inputCls } from "@/app/deals/new/new-deal-form";

const initial: ActionState = { error: null };

export function DealEditForm({ deal }: { deal: Deal }) {
  const [editing, setEditing] = useState(false);
  const action = updateDeal.bind(null, deal.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <div className="space-y-2 text-sm">
        <ReadRow label="Company" value={deal.company} />
        <ReadRow label="Industry" value={deal.industry ?? "—"} />
        <ReadRow label="Vertical" value={deal.vertical} />
        <ReadRow label="Source" value={deal.source} />
        <ReadRow label="Owner" value={deal.owner_name ?? "—"} />
        <ReadRow label="Priority" value={deal.priority} />
        <ReadRow label="Status" value={deal.status} />
        <ReadRow
          label="Value hypothesis"
          value={
            deal.value_hypothesis_rm != null
              ? `${formatRM(deal.value_hypothesis_rm)}/yr — ${deal.value_hypothesis_basis ?? "no basis"}`
              : "—"
          }
        />
        <ReadRow label="Confidence" value={deal.confidence} />
        <ReadRow label="Deposit impact" value={deal.deposit_impact} />
        <ReadRow label="Next follow-up" value={deal.next_followup_date ?? "—"} />
        <ReadRow label="Revisit date" value={deal.revisit_date ?? "—"} />
        <ReadRow
          label="Conflict check"
          value={
            deal.conflict_check_status +
            (deal.conflict_check_confirmed_by ? ` (by ${deal.conflict_check_confirmed_by})` : "")
          }
        />
        {state.ok && !editing && (
          <p className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Saved.</p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Edit deal
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 text-sm">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <Field label="Company" error={fe.company}>
        <input name="company" defaultValue={deal.company} className={inputCls(fe.company)} />
      </Field>
      <Field label="Industry">
        <input name="industry" defaultValue={deal.industry ?? ""} className={inputCls()} />
      </Field>
      <Field label="Vertical" error={fe.vertical}>
        <select name="vertical" defaultValue={deal.vertical} className={inputCls(fe.vertical)}>
          {VERTICALS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner" error={fe.owner_name}>
          <input name="owner_name" defaultValue={deal.owner_name ?? ""} className={inputCls(fe.owner_name)} />
        </Field>
        <Field label="Priority" error={fe.priority}>
          <select name="priority" defaultValue={deal.priority} className={inputCls(fe.priority)}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status" error={fe.status}>
          <select name="status" defaultValue={deal.status} className={inputCls(fe.status)}>
            <option>Active</option>
            <option>Parked</option>
            <option>Killed</option>
            <option>Live</option>
          </select>
        </Field>
        <Field label="Revisit date (if Parked)" error={fe.revisit_date}>
          <input
            type="date"
            name="revisit_date"
            defaultValue={deal.revisit_date ?? ""}
            className={inputCls(fe.revisit_date)}
          />
        </Field>
      </div>
      <Field label="Value hypothesis (RM/year)" error={fe.value_hypothesis_rm}>
        <input
          name="value_hypothesis_rm"
          defaultValue={deal.value_hypothesis_rm ?? ""}
          placeholder="e.g. 500000"
          className={inputCls(fe.value_hypothesis_rm)}
        />
      </Field>
      <Field label="Value hypothesis basis (one line)">
        <input
          name="value_hypothesis_basis"
          defaultValue={deal.value_hypothesis_basis ?? ""}
          placeholder="e.g. 120 outlets × RM2.8M turnover × 0.6% MDR"
          className={inputCls()}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Confidence" error={fe.confidence}>
          <select name="confidence" defaultValue={deal.confidence} className={inputCls(fe.confidence)}>
            <option>High</option>
            <option>Med</option>
            <option>Low</option>
          </select>
        </Field>
        <Field label="Deposit impact" error={fe.deposit_impact}>
          <select name="deposit_impact" defaultValue={deal.deposit_impact} className={inputCls(fe.deposit_impact)}>
            <option>Positive</option>
            <option>Neutral</option>
            <option>None</option>
          </select>
        </Field>
      </div>
      <Field label="Next follow-up date">
        <input
          type="date"
          name="next_followup_date"
          defaultValue={deal.next_followup_date ?? ""}
          className={inputCls()}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Conflict check" error={fe.conflict_check_status}>
          <select
            name="conflict_check_status"
            defaultValue={deal.conflict_check_status}
            className={inputCls(fe.conflict_check_status)}
          >
            <option>Pending</option>
            <option>Cleared</option>
            <option>Unknown</option>
          </select>
        </Field>
        <Field label="Confirmed by" error={fe.conflict_check_confirmed_by}>
          <input
            name="conflict_check_confirmed_by"
            defaultValue={deal.conflict_check_confirmed_by ?? ""}
            placeholder="Who confirmed?"
            className={inputCls(fe.conflict_check_confirmed_by)}
          />
        </Field>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 pb-1.5 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value}</span>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

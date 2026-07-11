"use client";

import { useActionState } from "react";
import { createDeal, type ActionState } from "@/app/actions/deals";
import { VERTICALS } from "@/lib/stages";

const initial: ActionState = { error: null };

export function NewDealForm() {
  const [state, formAction, pending] = useActionState(createDeal, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <Field label="Company" error={fe.company}>
        <input
          name="company"
          className={inputCls(fe.company)}
          placeholder="e.g. Senheng Electric"
          required
        />
      </Field>

      <Field label="Industry" error={fe.industry}>
        <input name="industry" className={inputCls()} placeholder="e.g. Consumer Electronics Retail" />
      </Field>

      <Field label="Vertical" error={fe.vertical}>
        <select name="vertical" className={inputCls(fe.vertical)} defaultValue="" required>
          <option value="" disabled>
            Select vertical…
          </option>
          {VERTICALS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Source" error={fe.source}>
          <select name="source" className={inputCls(fe.source)} defaultValue="Inbound">
            <option>Inbound</option>
            <option>Outbound</option>
          </select>
        </Field>
        <Field label="Priority" error={fe.priority}>
          <select name="priority" className={inputCls(fe.priority)} defaultValue="Medium">
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </Field>
      </div>

      <Field label="Owner" error={fe.owner_name}>
        <input
          name="owner_name"
          className={inputCls(fe.owner_name)}
          placeholder="Deal owner's name"
          required
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create deal"}
      </button>
    </form>
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
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function inputCls(error?: string): string {
  return `w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 ${
    error ? "border-red-400" : "border-neutral-300"
  }`;
}

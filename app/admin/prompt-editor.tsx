"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePromptTemplateVersion } from "@/app/actions/admin";
import type { PromptTemplate } from "@/lib/types";

export function PromptTemplateEditor({ template }: { template: PromptTemplate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(template.template_body);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium capitalize">{template.stage}</span>
          <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
            v{template.version} · active
          </span>
          {template.updated_by && (
            <span className="ml-2 text-xs text-neutral-400">by {template.updated_by}</span>
          )}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {!open ? (
        <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{template.template_body}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Published as v{template.version + 1}. The previous version is retained.
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <p className="text-xs text-neutral-400">
            Saving publishes a new version (never overwrites). The old version is deactivated
            but kept for audit.
          </p>
          <button
            disabled={pending}
            onClick={() => {
              setError(null);
              setSaved(false);
              startTransition(async () => {
                const res = await savePromptTemplateVersion({
                  stage: template.stage,
                  templateBody: body,
                });
                if (res.error) setError(res.error);
                else {
                  setSaved(true);
                  router.refresh();
                }
              });
            }}
            className="rounded-md bg-violet-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {pending ? "Publishing…" : "Publish new version"}
          </button>
        </div>
      )}
    </div>
  );
}

import { STAGES } from "@/lib/stages";
import type { Deal, EvidenceItem, StageOutput } from "@/lib/types";

// Sprint 1 placeholder: shows the enforced stage machine position.
// The per-stage AI copilot screens land in Sprint 2.
export function StageWorkflow({
  deal,
}: {
  deal: Deal;
  evidence: EvidenceItem[];
  outputs: StageOutput[];
}) {
  const currentIdx = STAGES.indexOf(deal.stage);
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Stage machine
      </h2>
      <ol className="mt-4 space-y-2">
        {STAGES.map((stage, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isCurrent
                    ? "bg-violet-700 text-white"
                    : isPast
                      ? "bg-violet-100 text-violet-700"
                      : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-sm ${
                  isCurrent ? "font-semibold text-neutral-900" : isPast ? "text-neutral-600" : "text-neutral-400"
                }`}
              >
                {stage}
              </span>
              {isCurrent && (
                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                  Current
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-neutral-400">
        Stage screens with the AI copilot and gate enforcement arrive in the next sprint.
      </p>
    </section>
  );
}

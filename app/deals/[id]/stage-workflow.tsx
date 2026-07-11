"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  advanceStage,
  confirmOptionSelection,
  confirmStageOutput,
  confirmTriage,
  setConflictCheck,
} from "@/app/actions/stage";
import { createContactReport } from "@/app/actions/contact";
import { approveLegalShariahGate, submitCloseout } from "@/app/actions/closeout";
import { STAGES, nextStage } from "@/lib/stages";
import type { ContactReport, Deal, EvidenceItem, Lesson, StageOutput } from "@/lib/types";
import { inputCls } from "@/app/deals/new/new-deal-form";

// ── Shared helpers ───────────────────────────────────────────────────────────

function latestOutput(outputs: StageOutput[], stageKey: string): StageOutput | null {
  const rows = outputs
    .filter((o) => o.stage === stageKey)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return rows[0] ?? null;
}

function useAiCall(dealId: string, actor: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (stageKey: string, input: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/ai/${stageKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, input, actor }),
      });
      const payload = await res.json();
      if (!res.ok) {
        const blockers = Array.isArray(payload.blockers) ? ` ${payload.blockers.join(" ")}` : "";
        setMessage((payload.error ?? "AI request failed.") + blockers);
      } else {
        router.refresh();
      }
    } catch {
      setMessage("AI unavailable — inputs saved, try again shortly.");
    } finally {
      setBusy(false);
    }
  };

  return { run, busy, message, setMessage };
}

function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {text}
    </div>
  );
}

function LessonsApplied({ output }: { output: StageOutput | null }) {
  const lessons = (output?.ai_output as { lessons_applied?: { transferable_lesson: string }[] } | null)
    ?.lessons_applied;
  if (!lessons || lessons.length === 0) return null;
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-emerald-700">
        Knowledge base applied ({lessons.length} vertical-matched lesson
        {lessons.length > 1 ? "s" : ""})
      </p>
      <ul className="mt-1 list-disc pl-5 text-sm text-emerald-900">
        {lessons.map((l, i) => (
          <li key={i}>{l.transferable_lesson}</li>
        ))}
      </ul>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ deal }: { deal: Deal }) {
  const currentIdx = STAGES.indexOf(deal.stage);
  return (
    <div className="overflow-x-auto">
      <ol className="flex items-center gap-1 whitespace-nowrap py-1">
        {STAGES.map((stage, i) => (
          <li key={stage} className="flex items-center gap-1">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                i === currentIdx
                  ? "bg-violet-700 text-white"
                  : i < currentIdx
                    ? "bg-violet-100 text-violet-700"
                    : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {stage}
            </span>
            {i < STAGES.length - 1 && <span className="text-neutral-300">→</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Advance bar with gate blockers ───────────────────────────────────────────

function AdvanceBar({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actor, setActor] = useState(deal.owner_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const to = nextStage(deal.stage);
  if (!to || deal.status !== "Active") return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="Your name"
          className="w-44 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button
          disabled={pending}
          onClick={() => {
            setError(null);
            setBlockers([]);
            startTransition(async () => {
              const res = await advanceStage({ dealId: deal.id, actor });
              if (res.error) {
                setError(res.error);
                setBlockers(res.blockers ?? []);
              } else {
                router.refresh();
              }
            });
          }}
          className="rounded-md bg-violet-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {pending ? "Checking gates…" : `Advance to ${to}`}
        </button>
        <span className="text-xs text-neutral-400">
          Gate checks run server-side; blockers are listed here.
        </span>
      </div>
      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">{error}</p>
          {blockers.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stage 0: Triage ──────────────────────────────────────────────────────────

function TriageScreen({ deal, output }: { deal: Deal; output: StageOutput | null }) {
  const router = useRouter();
  const actorDefault = deal.owner_name ?? "";
  const { run, busy, message } = useAiCall(deal.id, actorDefault);
  const [pasted, setPasted] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmedBy, setConfirmedBy] = useState(actorDefault);
  const [reply, setReply] = useState<string | null>(null);
  const [revisitDate, setRevisitDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ai = output?.ai_output as
    | {
        reframe?: string;
        levers?: Record<string, { rating?: string; reasoning?: string }>;
        ecosystem_test?: string;
        red_flags?: string[];
        verdict?: string;
        drafted_reply?: string;
      }
    | null
    | undefined;
  // 'queued' = a prior AI attempt failed; 'inbound' = created from a forwarded
  // email. Both pre-fill the paste box with the saved input for Stage 0.
  const isQueued =
    output?.ai_output_source === "queued" || output?.ai_output_source === "inbound";
  const confirmed = output?.confirmed_at != null;

  const decide = (verdict: "Pursue" | "Park" | "Decline") => {
    if (!output) return;
    setError(null);
    startTransition(async () => {
      const editedOutput =
        reply != null && ai ? { ...ai, drafted_reply: reply } : undefined;
      const res = await confirmTriage({
        dealId: deal.id,
        stageOutputId: output.id,
        confirmedBy,
        verdict,
        editedOutput,
        revisitDate: revisitDate || undefined,
      });
      if (res.error) setError([res.error, ...(res.blockers ?? [])].join(" "));
      else router.refresh();
    });
  };

  return (
    <SectionCard title="Stage 0 · Inbound Triage">
      {!output || isQueued ? (
        <>
          <p className="text-sm text-neutral-600">
            Paste the inbound material (email, deck notes, WhatsApp thread). The copilot
            reframes the ask, scores the four levers, runs the ecosystem test and red-flag
            checklist, and drafts a reply.
          </p>
          {isQueued && (
            <ErrorNote text="AI was unavailable on the last attempt — your inputs were saved. Try again." />
          )}
          <textarea
            value={pasted || (isQueued ? String((output?.ai_output as { saved_input?: string })?.saved_input ?? "") : "")}
            onChange={(e) => setPasted(e.target.value)}
            rows={7}
            placeholder="Paste inbound text here…"
            className={inputCls()}
          />
          <ErrorNote text={message} />
          <button
            disabled={busy || !(pasted || isQueued)}
            onClick={() =>
              run(
                "triage",
                pasted || String((output?.ai_output as { saved_input?: string })?.saved_input ?? ""),
              )
            }
            className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {busy ? "Analysing… (≤30s)" : "Analyse"}
          </button>
        </>
      ) : (
        <>
          {ai?.reframe && (
            <p className="rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-900">
              <span className="font-semibold">What they actually want:</span> {ai.reframe}
            </p>
          )}
          {ai?.levers && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(ai.levers).map(([key, lever]) => (
                <div key={key} className="rounded-md border border-neutral-200 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      lever.rating === "Yes"
                        ? "text-emerald-700"
                        : lever.rating === "Weak"
                          ? "text-amber-700"
                          : "text-red-700"
                    }`}
                  >
                    {lever.rating}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">{lever.reasoning}</p>
                </div>
              ))}
            </div>
          )}
          {ai?.ecosystem_test && (
            <p className="text-sm text-neutral-700">
              <span className="font-medium">Ecosystem test:</span> {ai.ecosystem_test}
            </p>
          )}
          {ai?.red_flags && ai.red_flags.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-red-700">Red flags</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-red-800">
                {ai.red_flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm">
            <span className="font-medium">AI verdict:</span>{" "}
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-semibold">{ai?.verdict}</span>
            {output.ai_output_confidence != null && (
              <span className="ml-2 text-xs text-neutral-400">
                confidence {Number(output.ai_output_confidence).toFixed(2)}
              </span>
            )}
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Drafted reply (edit before confirming — edits are logged)
            </label>
            <textarea
              value={reply ?? ai?.drafted_reply ?? ""}
              onChange={(e) => setReply(e.target.value)}
              rows={5}
              className={inputCls()}
              disabled={confirmed}
            />
          </div>
          {confirmed ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Confirmed by {output.confirmed_by} on{" "}
              {new Date(output.confirmed_at!).toLocaleString("en-GB")}.
            </p>
          ) : (
            <>
              <ErrorNote text={error} />
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">
                    Confirmed by
                  </label>
                  <input
                    value={confirmedBy}
                    onChange={(e) => setConfirmedBy(e.target.value)}
                    className="w-44 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <button
                  disabled={pending}
                  onClick={() => decide("Pursue")}
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Confirm Pursue → Research
                </button>
                <div className="flex items-end gap-1">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">
                      Revisit date (for Park)
                    </label>
                    <input
                      type="date"
                      value={revisitDate}
                      onChange={(e) => setRevisitDate(e.target.value)}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
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
                  onClick={() => decide("Decline")}
                  className="rounded-md bg-neutral-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
              <button
                disabled={busy}
                onClick={() => run("triage", pasted)}
                className="text-xs text-violet-700 hover:underline"
              >
                Re-run triage with new input
              </button>
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ── Stage 1: Research ────────────────────────────────────────────────────────

function ResearchScreen({
  deal,
  output,
  evidenceCount,
}: {
  deal: Deal;
  output: StageOutput | null;
  evidenceCount: number;
}) {
  const router = useRouter();
  const actorDefault = deal.owner_name ?? "";
  const { run, busy, message } = useAiCall(deal.id, actorDefault);
  const [context, setContext] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmer, setConfirmer] = useState(deal.conflict_check_confirmed_by ?? actorDefault);
  const [error, setError] = useState<string | null>(null);

  const ai = output?.ai_output as
    | {
        brief?: Record<string, string>;
        load_bearing_facts?: string[];
      }
    | null
    | undefined;
  const isQueued = output?.ai_output_source === "queued";

  const saveConflict = (status: "Pending" | "Cleared" | "Unknown") => {
    setError(null);
    startTransition(async () => {
      const res = await setConflictCheck({ dealId: deal.id, status, confirmedBy: confirmer });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <SectionCard title="Stage 1 · Research">
      {!output || isQueued ? (
        <>
          <p className="text-sm text-neutral-600">
            The copilot produces a company brief with every claim typed
            Verified / Inferred / Claimed, and creates the evidence items automatically.
          </p>
          {isQueued && (
            <ErrorNote text="AI was unavailable on the last attempt — your inputs were saved. Try again." />
          )}
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
            placeholder="Optional known context (existing relationship, who approached whom…)"
            className={inputCls()}
          />
          <ErrorNote text={message} />
          <button
            disabled={busy}
            onClick={() => run("research", context)}
            className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {busy ? "Researching… (≤30s)" : "Run Research"}
          </button>
        </>
      ) : (
        <>
          <LessonsApplied output={output} />
          {ai?.brief &&
            Object.entries(ai.brief).map(([key, value]) => (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="mt-0.5 text-sm text-neutral-700">{value}</p>
              </div>
            ))}
          {ai?.load_bearing_facts && (
            <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-violet-700">
                Three load-bearing facts to confirm independently
              </p>
              <ol className="mt-1 list-decimal pl-5 text-sm text-violet-900">
                {ai.load_bearing_facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            </div>
          )}
          <p className="text-xs text-neutral-500">
            {evidenceCount} evidence item{evidenceCount === 1 ? "" : "s"} on file — manage types in
            the Evidence panel.
          </p>
          <ErrorNote text={message} />
          <button
            disabled={busy}
            onClick={() => run("research", context)}
            className="text-xs text-violet-700 hover:underline"
          >
            Re-run research
          </button>
        </>
      )}

      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <p className="text-sm font-semibold text-neutral-700">
          Group conflict check{" "}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              deal.conflict_check_status === "Cleared"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {deal.conflict_check_status}
          </span>
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Does any AEON entity have an active relationship or dispute with this target? Unknown
          means go and ask. Advancing past Research is blocked until Cleared, and the confirmer
          is recorded.
        </p>
        <ErrorNote text={error} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={confirmer}
            onChange={(e) => setConfirmer(e.target.value)}
            placeholder="Confirmed by (name)"
            className="w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button
            disabled={pending}
            onClick={() => saveConflict("Cleared")}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Mark Cleared
          </button>
          <button
            disabled={pending}
            onClick={() => saveConflict("Unknown")}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Unknown
          </button>
          <button
            disabled={pending}
            onClick={() => saveConflict("Pending")}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Reset to Pending
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Stage 2: Options ─────────────────────────────────────────────────────────

interface OptionRecord {
  rank?: number;
  title?: string;
  vertical?: string;
  value_exchange?: string;
  revenue_mechanism?: string;
  partner_motivation?: string;
  led_by?: string;
}

function OptionsScreen({ deal, output }: { deal: Deal; output: StageOutput | null }) {
  const router = useRouter();
  const actorDefault = deal.owner_name ?? "";
  const { run, busy, message } = useAiCall(deal.id, actorDefault);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number | null>(null);
  const [rm, setRm] = useState(deal.value_hypothesis_rm != null ? String(deal.value_hypothesis_rm) : "");
  const [basis, setBasis] = useState(deal.value_hypothesis_basis ?? "");
  const [confidence, setConfidence] = useState<"High" | "Med" | "Low">(deal.confidence ?? "Med");
  const [deposit, setDeposit] = useState<"Positive" | "Neutral" | "None">(deal.deposit_impact ?? "Neutral");
  const [confirmedBy, setConfirmedBy] = useState(actorDefault);
  const [error, setError] = useState<string | null>(null);

  const ai = output?.ai_output as
    | { options?: OptionRecord[]; warning?: string | null; selected_option_index?: number }
    | null
    | undefined;
  const isQueued = output?.ai_output_source === "queued";
  const confirmed = output?.confirmed_at != null;
  const humanEdited = output?.human_edited_output as { selected_option_index?: number } | null;
  const confirmedIndex = humanEdited?.selected_option_index;

  const options = ai?.options ?? [];

  const submit = () => {
    if (!output) return;
    if (selected == null) {
      setError("Select one of the three options first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmOptionSelection({
        dealId: deal.id,
        stageOutputId: output.id,
        confirmedBy,
        selectedIndex: selected,
        valueRm: rm,
        valueBasis: basis,
        confidence,
        depositImpact: deposit,
      });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <SectionCard title="Stage 2 · Options">
      {!output || isQueued ? (
        <>
          <p className="text-sm text-neutral-600">
            The copilot proposes exactly three collaboration options, ranked, each mapped to a
            vertical with the value exchange and revenue mechanism, flagged ecosystem-led or
            bank-led.
          </p>
          {isQueued && (
            <ErrorNote text="AI was unavailable on the last attempt — your inputs were saved. Try again." />
          )}
          <ErrorNote text={message} />
          <button
            disabled={busy}
            onClick={() => run("options", "")}
            className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {busy ? "Generating… (≤30s)" : "Generate three options"}
          </button>
        </>
      ) : (
        <>
          <LessonsApplied output={output} />
          {ai?.warning && <ErrorNote text={ai.warning} />}
          <div className="space-y-3">
            {options.map((opt, i) => {
              const isChosen = confirmed ? confirmedIndex === i : selected === i;
              return (
                <label
                  key={i}
                  className={`block cursor-pointer rounded-lg border p-3 ${
                    isChosen ? "border-violet-500 bg-violet-50" : "border-neutral-200 hover:border-violet-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!confirmed && (
                      <input
                        type="radio"
                        name="option"
                        checked={selected === i}
                        onChange={() => setSelected(i)}
                        className="mt-1"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        #{opt.rank ?? i + 1} {opt.title}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            opt.led_by === "ecosystem"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-neutral-200 text-neutral-600"
                          }`}
                        >
                          {opt.led_by === "ecosystem" ? "Ecosystem-led" : "Bank-led"}
                        </span>
                        {confirmed && confirmedIndex === i && (
                          <span className="ml-2 rounded bg-violet-700 px-1.5 py-0.5 text-[11px] font-medium text-white">
                            Selected
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">{opt.vertical}</p>
                      <dl className="mt-2 space-y-1 text-sm text-neutral-700">
                        <div>
                          <dt className="inline font-medium">Value exchange: </dt>
                          <dd className="inline">{opt.value_exchange}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium">Revenue mechanism: </dt>
                          <dd className="inline">{opt.revenue_mechanism}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium">Partner motivation: </dt>
                          <dd className="inline">{opt.partner_motivation}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {confirmed ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Option confirmed by {output.confirmed_by} on{" "}
              {new Date(output.confirmed_at!).toLocaleString("en-GB")}. Value hypothesis saved to
              the deal record.
            </p>
          ) : (
            <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm font-semibold text-neutral-700">
                Mandatory before advance: value hypothesis for the selected option
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">
                    Value hypothesis (RM/year)
                  </label>
                  <input value={rm} onChange={(e) => setRm(e.target.value)} placeholder="500000" className={inputCls()} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">
                    One-line basis
                  </label>
                  <input
                    value={basis}
                    onChange={(e) => setBasis(e.target.value)}
                    placeholder="e.g. 120 outlets × RM2.8M × 0.6% MDR"
                    className={inputCls()}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Confidence</label>
                  <select value={confidence} onChange={(e) => setConfidence(e.target.value as typeof confidence)} className={inputCls()}>
                    <option>High</option>
                    <option>Med</option>
                    <option>Low</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">
                    Deposit impact
                  </label>
                  <select value={deposit} onChange={(e) => setDeposit(e.target.value as typeof deposit)} className={inputCls()}>
                    <option>Positive</option>
                    <option>Neutral</option>
                    <option>None</option>
                  </select>
                </div>
              </div>
              <ErrorNote text={error} />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={confirmedBy}
                  onChange={(e) => setConfirmedBy(e.target.value)}
                  placeholder="Confirmed by (name)"
                  className="w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                />
                <button
                  disabled={pending}
                  onClick={submit}
                  className="rounded-md bg-violet-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Confirm selection + value hypothesis"}
                </button>
              </div>
            </div>
          )}
          <ErrorNote text={message} />
          {!confirmed && (
            <button disabled={busy} onClick={() => run("options", "")} className="text-xs text-violet-700 hover:underline">
              Re-generate options
            </button>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ── Stage 3: Proposal ────────────────────────────────────────────────────────

function ProposalScreen({
  deal,
  output,
  claimedBlockers,
}: {
  deal: Deal;
  output: StageOutput | null;
  claimedBlockers: number;
}) {
  const router = useRouter();
  const actorDefault = deal.owner_name ?? "";
  const { run, busy, message } = useAiCall(deal.id, actorDefault);
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [confirmedBy, setConfirmedBy] = useState(actorDefault);
  const [error, setError] = useState<string | null>(null);

  const ai = output?.ai_output as
    | { proposal_text?: string; shariah_structure?: string }
    | null
    | undefined;
  const human = output?.human_edited_output as { proposal_text?: string } | null;
  const isQueued = output?.ai_output_source === "queued";
  const confirmed = output?.confirmed_at != null;
  const displayText = text ?? human?.proposal_text ?? ai?.proposal_text ?? "";

  const approve = () => {
    if (!output) return;
    setError(null);
    startTransition(async () => {
      const edited =
        text != null && ai ? { ...ai, proposal_text: text } : undefined;
      const res = await confirmStageOutput({
        dealId: deal.id,
        stageOutputId: output.id,
        confirmedBy,
        editedOutput: edited,
      });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <SectionCard title="Stage 3 · Proposal">
      {claimedBlockers > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-semibold">
            {claimedBlockers} material Claimed evidence item{claimedBlockers > 1 ? "s" : ""} block
            {claimedBlockers > 1 ? "" : "s"} proposal generation.
          </span>{" "}
          Upgrade the item in the Evidence panel or have the Head waive it with a logged reason.
        </div>
      )}
      {!output || isQueued ? (
        <>
          <p className="text-sm text-neutral-600">
            One-page draft (under 400 words) in the partner&apos;s language with the Shariah
            structure named. The approved version is the artefact of record.
          </p>
          {isQueued && (
            <ErrorNote text="AI was unavailable on the last attempt — try again." />
          )}
          <ErrorNote text={message} />
          <button
            disabled={busy || claimedBlockers > 0}
            onClick={() => run("proposal", "")}
            className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {busy ? "Drafting… (≤30s)" : "Generate proposal draft"}
          </button>
        </>
      ) : (
        <>
          {ai?.shariah_structure && (
            <p className="text-sm">
              <span className="font-medium">Shariah structure:</span>{" "}
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
                {ai.shariah_structure}
              </span>
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Proposal draft (edit before approving — the approved version is the artefact of
              record, edits are logged)
            </label>
            <textarea
              value={displayText}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              className={inputCls()}
              disabled={confirmed}
            />
            <p className="mt-1 text-xs text-neutral-400">
              {displayText.trim().split(/\s+/).filter(Boolean).length} words (target &lt; 400)
            </p>
          </div>
          {confirmed ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Approved by {output.confirmed_by} on{" "}
              {new Date(output.confirmed_at!).toLocaleString("en-GB")}.
            </p>
          ) : (
            <>
              <ErrorNote text={error} />
              <ErrorNote text={message} />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={confirmedBy}
                  onChange={(e) => setConfirmedBy(e.target.value)}
                  placeholder="Approved by (name)"
                  className="w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                />
                <button
                  disabled={pending}
                  onClick={approve}
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Approve proposal"}
                </button>
                <button
                  disabled={busy || claimedBlockers > 0}
                  onClick={() => run("proposal", "")}
                  className="text-xs text-violet-700 hover:underline"
                >
                  Re-generate
                </button>
              </div>
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ── Stage 4: Meeting Prep ────────────────────────────────────────────────────

function MeetingPrepScreen({ deal, output }: { deal: Deal; output: StageOutput | null }) {
  const router = useRouter();
  const actorDefault = deal.owner_name ?? "";
  const { run, busy, message } = useAiCall(deal.id, actorDefault);
  const [pending, startTransition] = useTransition();
  const [confirmedBy, setConfirmedBy] = useState(actorDefault);
  const [error, setError] = useState<string | null>(null);

  const ai = output?.ai_output as
    | {
        objective?: string;
        opening_angle?: string;
        objections?: { objection?: string; response?: string }[];
        who_to_bring?: string;
        one_thing_not_to_do?: string;
      }
    | null
    | undefined;
  const isQueued = output?.ai_output_source === "queued";
  const confirmed = output?.confirmed_at != null;

  return (
    <SectionCard title="Stage 4 · Meeting Prep">
      {!output || isQueued ? (
        <>
          <p className="text-sm text-neutral-600">
            A prep sheet, not a script: objective, opening angle, five ranked objections with
            responses, who to bring, and one thing not to do.
          </p>
          {isQueued && <ErrorNote text="AI was unavailable on the last attempt — try again." />}
          <ErrorNote text={message} />
          <button
            disabled={busy}
            onClick={() => run("meeting_prep", "")}
            className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {busy ? "Preparing… (≤30s)" : "Generate prep sheet"}
          </button>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-200 p-3">
              <p className="text-xs font-semibold uppercase text-neutral-400">Objective</p>
              <p className="mt-1 text-sm">{ai?.objective}</p>
            </div>
            <div className="rounded-md border border-neutral-200 p-3">
              <p className="text-xs font-semibold uppercase text-neutral-400">Opening angle</p>
              <p className="mt-1 text-sm">{ai?.opening_angle}</p>
            </div>
          </div>
          {ai?.objections && (
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-400">
                Likely objections, ranked
              </p>
              <ol className="mt-1 list-decimal space-y-2 pl-5">
                {ai.objections.map((o, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{o.objection}</span>
                    <p className="text-neutral-600">{o.response}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase text-emerald-700">Who to bring</p>
              <p className="mt-1 text-sm text-emerald-900">{ai?.who_to_bring}</p>
            </div>
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase text-red-700">One thing not to do</p>
              <p className="mt-1 text-sm text-red-900">{ai?.one_thing_not_to_do}</p>
            </div>
          </div>
          {confirmed ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Approved by {output.confirmed_by} on{" "}
              {new Date(output.confirmed_at!).toLocaleString("en-GB")}.
            </p>
          ) : (
            <>
              <ErrorNote text={error} />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={confirmedBy}
                  onChange={(e) => setConfirmedBy(e.target.value)}
                  placeholder="Approved by (name)"
                  className="w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                />
                <button
                  disabled={pending}
                  onClick={() => {
                    if (!output) return;
                    setError(null);
                    startTransition(async () => {
                      const res = await confirmStageOutput({
                        dealId: deal.id,
                        stageOutputId: output.id,
                        confirmedBy,
                      });
                      if (res.error) setError(res.error);
                      else router.refresh();
                    });
                  }}
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Approve prep sheet
                </button>
                <button disabled={busy} onClick={() => run("meeting_prep", "")} className="text-xs text-violet-700 hover:underline">
                  Re-generate
                </button>
              </div>
              <ErrorNote text={message} />
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ── Stage 5: Contact Analysis (In Dialogue) ──────────────────────────────────

function DialogueScreen({
  deal,
  outputs,
  contactReports,
}: {
  deal: Deal;
  outputs: StageOutput[];
  contactReports: ContactReport[];
}) {
  const router = useRouter();
  const actorDefault = deal.owner_name ?? "";
  const { run, busy, message } = useAiCall(deal.id, actorDefault);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const [contactDate, setContactDate] = useState(new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState("Meeting");
  const [notes, setNotes] = useState("");

  const latest = latestOutput(outputs, "contact_analysis");
  const draft = latest && latest.confirmed_at == null && latest.ai_output_source === "llm" ? latest : null;
  const ai = draft?.ai_output as
    | {
        challenge?: string;
        ask_type?: string;
        ask_domain?: string;
        next_step?: string;
        risk_level?: string;
        recommended_followup_interval?: number;
        two_line_summary?: string;
      }
    | null
    | undefined;

  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const effective = fields ?? {
    challenge: ai?.challenge ?? "",
    askType: ai?.ask_type ?? "Information",
    askDomain: ai?.ask_domain ?? "Business",
    nextStep: ai?.next_step ?? "",
    riskLevel: ai?.risk_level ?? "M",
    interval: ai?.recommended_followup_interval != null ? String(ai.recommended_followup_interval) : "7",
    confirmedBy: actorDefault,
  };

  const defaultFollowup = (() => {
    const days = parseInt(effective.interval || "7", 10);
    const base = new Date(contactDate + "T00:00:00");
    base.setDate(base.getDate() + (Number.isFinite(days) ? days : 7));
    return base.toISOString().slice(0, 10);
  })();
  const [followupDate, setFollowupDate] = useState<string | null>(null);

  const set = (key: string, value: string) => setFields({ ...effective, [key]: value });

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await createContactReport({
        dealId: deal.id,
        stageOutputId: draft?.id ?? null,
        contactDate,
        channel,
        rawNotes: notes,
        challenge: effective.challenge,
        askType: effective.askType,
        askDomain: effective.askDomain,
        nextStep: effective.nextStep,
        riskLevel: effective.riskLevel,
        followupInterval: effective.interval,
        nextFollowupDate: followupDate ?? defaultFollowup,
        confirmedBy: effective.confirmedBy,
      });
      if (res.error) setError(res.error);
      else {
        setNotes("");
        setFields(null);
        setFollowupDate(null);
        setSavedNote(
          res.escalationCreated
            ? "Contact report saved. Management support ask detected — an escalation was created and routed to the Approver."
            : "Contact report saved.",
        );
        router.refresh();
      }
    });
  };

  return (
    <SectionCard title="Stage 5 · Contact Analysis (In Dialogue)">
      <p className="text-sm text-neutral-600">
        Paste raw meeting or call notes. The copilot structures the report; you confirm or edit
        every field before it is saved. A Management support ask auto-creates an escalation.
      </p>

      {savedNote && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {savedNote}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Contact date</label>
          <input type="date" value={contactDate} onChange={(e) => setContactDate(e.target.value)} className={inputCls()} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls()}>
            <option>Call</option>
            <option>Email</option>
            <option>Meeting</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        placeholder="Paste raw notes here…"
        className={inputCls()}
      />
      <ErrorNote text={message} />
      <button
        disabled={busy || !notes.trim()}
        onClick={() => run("contact_analysis", notes)}
        className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {busy ? "Structuring… (≤30s)" : "Analyse notes"}
      </button>

      {(draft || fields) && (
        <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-sm font-semibold text-neutral-700">
            Confirm the structured report before saving
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Partner&apos;s core challenge
            </label>
            <input value={effective.challenge} onChange={(e) => set("challenge", e.target.value)} className={inputCls()} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Ask type</label>
              <select value={effective.askType} onChange={(e) => set("askType", e.target.value)} className={inputCls()}>
                <option>Time</option>
                <option>Information</option>
                <option>Management support</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Ask domain</label>
              <select value={effective.askDomain} onChange={(e) => set("askDomain", e.target.value)} className={inputCls()}>
                <option>Business</option>
                <option>Tech</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Risk</label>
              <select value={effective.riskLevel} onChange={(e) => set("riskLevel", e.target.value)} className={inputCls()}>
                <option>L</option>
                <option>M</option>
                <option>H</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Next step</label>
            <input value={effective.nextStep} onChange={(e) => set("nextStep", e.target.value)} className={inputCls()} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Follow-up interval (days)
              </label>
              <input value={effective.interval} onChange={(e) => set("interval", e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Next follow-up date
              </label>
              <input
                type="date"
                value={followupDate ?? defaultFollowup}
                onChange={(e) => setFollowupDate(e.target.value)}
                className={inputCls()}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Confirmed by</label>
              <input value={effective.confirmedBy} onChange={(e) => set("confirmedBy", e.target.value)} className={inputCls()} />
            </div>
          </div>
          {effective.askType === "Management support" && (
            <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
              Saving will auto-create an escalation routed to the Approver with a two-line summary.
            </p>
          )}
          <ErrorNote text={error} />
          <button
            disabled={pending}
            onClick={save}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Confirm and save contact report"}
          </button>
        </div>
      )}

      {!draft && !fields && (
        <button onClick={() => setFields({ ...effective })} className="text-xs text-violet-700 hover:underline">
          AI unavailable? File the report manually
        </button>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Contact history ({contactReports.length})
        </p>
        <ul className="mt-2 space-y-2">
          {contactReports.length === 0 && (
            <li className="rounded-md bg-neutral-50 px-3 py-3 text-center text-xs text-neutral-400">
              No contact reports yet.
            </li>
          )}
          {contactReports.map((r) => (
            <li key={r.id} className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.contact_date}</span>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{r.channel}</span>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                  Ask: {r.ask_type ?? "—"}
                </span>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                  Risk {r.risk_level ?? "—"}
                </span>
                <span className="ml-auto text-xs text-neutral-400">by {r.confirmed_by}</span>
              </div>
              {r.ai_challenge && <p className="mt-1 text-neutral-700">{r.ai_challenge}</p>}
              {r.next_step && (
                <p className="mt-0.5 text-xs text-neutral-500">Next: {r.next_step}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

// ── Legal & Shariah gate ─────────────────────────────────────────────────────

function LegalShariahScreen({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approver, setApprover] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const approved = deal.gate === "Legal & Shariah approved";

  return (
    <SectionCard title="Legal & Shariah gate">
      <p className="text-sm text-neutral-600">
        A named Approver (CEO office / CFO delegate / Shariah secretariat) must sign off before
        the deal can enter Tech Integration. The approval is written to the audit log.
      </p>
      {approved ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Legal &amp; Shariah gate approved. The deal can advance to Tech Integration.
        </p>
      ) : (
        <>
          <ErrorNote text={error} />
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              placeholder="Approver name (required)"
              className="w-56 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-72 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
            <button
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await approveLegalShariahGate({
                    dealId: deal.id,
                    approvedBy: approver,
                    notes,
                  });
                  if (res.error) setError(res.error);
                  else router.refresh();
                });
              }}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve gate
            </button>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── Stage 6: Closeout ────────────────────────────────────────────────────────

function CloseoutScreen({ deal, lessons }: { deal: Deal; lessons: Lesson[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState("Won");
  const [whatWorked, setWhatWorked] = useState("");
  const [whatStalled, setWhatStalled] = useState("");
  const [dealShape, setDealShape] = useState("");
  const [lesson, setLesson] = useState("");
  const [tags, setTags] = useState("");
  const [revisitDate, setRevisitDate] = useState("");
  const [submittedBy, setSubmittedBy] = useState(deal.owner_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const filed = lessons.length > 0;
  const lessonMissing = !lesson.trim();

  if (filed) {
    const l = lessons[0];
    return (
      <SectionCard title="Stage 6 · Closeout">
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Closeout complete — outcome <span className="font-semibold">{l.outcome}</span>, lesson
          filed to the knowledge base.
        </p>
        <div className="rounded-md border border-neutral-200 p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-neutral-400">Transferable lesson</p>
          <p className="mt-1">{l.transferable_lesson}</p>
          {l.what_worked && (
            <p className="mt-2 text-neutral-600">
              <span className="font-medium">What worked:</span> {l.what_worked}
            </p>
          )}
          {l.what_stalled && (
            <p className="mt-1 text-neutral-600">
              <span className="font-medium">What stalled it:</span> {l.what_stalled}
            </p>
          )}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Stage 6 · Closeout">
      <p className="text-sm text-neutral-600">
        Filing one transferable lesson is mandatory to complete closeout — it compounds into the
        knowledge base for every future deal in this vertical.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Outcome</label>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputCls()}>
            <option>Won</option>
            <option>Lost</option>
            <option>Parked</option>
          </select>
        </div>
        {outcome === "Parked" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Revisit date (mandatory for Parked)
            </label>
            <input type="date" value={revisitDate} onChange={(e) => setRevisitDate(e.target.value)} className={inputCls()} />
          </div>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">What worked</label>
        <textarea value={whatWorked} onChange={(e) => setWhatWorked(e.target.value)} rows={2} className={inputCls()} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">What stalled it</label>
        <textarea value={whatStalled} onChange={(e) => setWhatStalled(e.target.value)} rows={2} className={inputCls()} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Deal shape (if won)
        </label>
        <input value={dealShape} onChange={(e) => setDealShape(e.target.value)} className={inputCls()} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          One transferable lesson <span className="text-red-600">*</span>
        </label>
        <textarea
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          onBlur={() => setTouched(true)}
          rows={3}
          placeholder="The one thing the next deal in this vertical should know…"
          className={inputCls(touched && lessonMissing ? "required" : undefined)}
        />
        {touched && lessonMissing && (
          <p className="mt-1 text-xs text-red-600">
            The transferable lesson is required — closeout cannot be submitted without it.
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Tags (comma-separated)
          </label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="acquiring, pilot, mdr" className={inputCls()} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Submitted by</label>
          <input value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)} className={inputCls()} />
        </div>
      </div>
      <ErrorNote text={error} />
      <button
        disabled={pending || lessonMissing}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await submitCloseout({
              dealId: deal.id,
              outcome,
              whatWorked,
              whatStalled,
              dealShape,
              transferableLesson: lesson,
              tags,
              revisitDate: revisitDate || undefined,
              submittedBy,
            });
            if (res.error) setError(res.error);
            else router.refresh();
          });
        }}
        className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {pending ? "Filing…" : "Complete closeout"}
      </button>
    </SectionCard>
  );
}

// ── Workflow root ────────────────────────────────────────────────────────────

export function StageWorkflow({
  deal,
  evidence,
  outputs,
  contactReports,
  lessons,
}: {
  deal: Deal;
  evidence: EvidenceItem[];
  outputs: StageOutput[];
  contactReports: ContactReport[];
  lessons: Lesson[];
}) {
  const stage = deal.stage;
  const claimedBlockers = evidence.filter(
    (e) => e.evidence_type === "Claimed" && e.is_material && !e.waived_by,
  ).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <Stepper deal={deal} />
      </div>

      {deal.status !== "Active" && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            deal.status === "Live"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : deal.status === "Parked"
                ? "border-sky-200 bg-sky-50 text-sky-900"
                : "border-neutral-300 bg-neutral-100 text-neutral-700"
          }`}
        >
          This deal is <span className="font-semibold">{deal.status}</span>
          {deal.status === "Parked" && deal.revisit_date ? ` — revisit on ${deal.revisit_date}` : ""}
          {deal.status === "Live"
            ? ". Run Closeout to file the lesson if you have not already."
            : ". Update the status in the deal record to resume the workflow."}
        </div>
      )}

      {stage === "Triage" && <TriageScreen deal={deal} output={latestOutput(outputs, "triage")} />}
      {stage === "Research" && (
        <ResearchScreen
          deal={deal}
          output={latestOutput(outputs, "research")}
          evidenceCount={evidence.length}
        />
      )}
      {stage === "Options" && <OptionsScreen deal={deal} output={latestOutput(outputs, "options")} />}
      {stage === "Proposal" && (
        <ProposalScreen
          deal={deal}
          output={latestOutput(outputs, "proposal")}
          claimedBlockers={claimedBlockers}
        />
      )}
      {stage === "Meeting Prep" && (
        <MeetingPrepScreen deal={deal} output={latestOutput(outputs, "meeting_prep")} />
      )}
      {stage === "In Dialogue" && (
        <DialogueScreen deal={deal} outputs={outputs} contactReports={contactReports} />
      )}
      {stage === "Legal & Shariah" && <LegalShariahScreen deal={deal} />}
      {stage === "Tech Integration" && (
        <SectionCard title="Tech Integration">
          <p className="text-sm text-neutral-600">
            Integration work happens outside this tool. Log progress with contact reports if
            useful, and advance to Live when the partnership goes into production.
          </p>
        </SectionCard>
      )}
      {(stage === "Live" || stage === "Closeout") && (
        <CloseoutScreen deal={deal} lessons={lessons} />
      )}

      <AdvanceBar deal={deal} />
    </div>
  );
}

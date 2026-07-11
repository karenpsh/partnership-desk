"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  advanceStage,
  confirmOptionSelection,
  confirmTriage,
  setConflictCheck,
} from "@/app/actions/stage";
import { STAGES, nextStage } from "@/lib/stages";
import type { Deal, EvidenceItem, StageOutput } from "@/lib/types";
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
        setMessage(payload.error ?? "AI request failed.");
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
  const isQueued = output?.ai_output_source === "queued";
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

// ── Workflow root ────────────────────────────────────────────────────────────

export function StageWorkflow({
  deal,
  evidence,
  outputs,
}: {
  deal: Deal;
  evidence: EvidenceItem[];
  outputs: StageOutput[];
}) {
  const stage = deal.stage;

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
          . Update the status in the deal record to resume the workflow.
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

      {["Proposal", "Meeting Prep", "In Dialogue", "Legal & Shariah", "Tech Integration", "Live", "Closeout"].includes(
        stage,
      ) && (
        <SectionCard title={`${stage} stage`}>
          <p className="text-sm text-neutral-500">
            The {stage} copilot screen arrives in the next sprint. Stage advancing with gate
            enforcement already works below.
          </p>
        </SectionCard>
      )}

      <AdvanceBar deal={deal} />
    </div>
  );
}

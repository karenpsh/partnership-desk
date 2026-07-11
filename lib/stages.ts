import type { Confidence, Deal, EvidenceItem, Stage, Vertical } from "./types";

export const VERTICALS: Vertical[] = [
  "Merchant & Acquiring",
  "Supply Chain Financing",
  "Consumer & Co-lending",
  "Bancatakaful & Wealth",
  "Remittance & FX",
  "Retail Media",
  "Payroll & Deposits",
];

// Board order. Triage applies to inbound deals only; outbound deals start at Research.
export const STAGES: Stage[] = [
  "Triage",
  "Research",
  "Options",
  "Proposal",
  "Meeting Prep",
  "In Dialogue",
  "Legal & Shariah",
  "Tech Integration",
  "Live",
  "Closeout",
];

// Stage number (PRD stage machine) for AI copilot screens.
export const AI_STAGE_FOR: Partial<Record<Stage, { n: number; key: string; label: string }>> = {
  Triage: { n: 0, key: "triage", label: "Stage 0 — Inbound Triage" },
  Research: { n: 1, key: "research", label: "Stage 1 — Research" },
  Options: { n: 2, key: "options", label: "Stage 2 — Options" },
  Proposal: { n: 3, key: "proposal", label: "Stage 3 — Proposal" },
  "Meeting Prep": { n: 4, key: "meeting_prep", label: "Stage 4 — Meeting Prep" },
  "In Dialogue": { n: 5, key: "contact_analysis", label: "Stage 5 — Contact Analysis" },
  Closeout: { n: 6, key: "closeout", label: "Stage 6 — Closeout" },
};

export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  if (i < 0 || i === STAGES.length - 1) return null;
  return STAGES[i + 1];
}

export const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  High: 1.0,
  Med: 0.6,
  Low: 0.3,
};

export function weightedValue(deal: Deal): number {
  if (deal.value_hypothesis_rm == null) return 0;
  return Number(deal.value_hypothesis_rm) * (CONFIDENCE_MULTIPLIER[deal.confidence] ?? 0.3);
}

export function formatRM(n: number | null | undefined): string {
  if (n == null) return "—";
  return "RM " + Number(n).toLocaleString("en-MY", { maximumFractionDigits: 0 });
}

const MS_PER_DAY = 86_400_000;

export function daysUntilFollowup(deal: Deal, now = new Date()): number | null {
  if (!deal.next_followup_date) return null;
  const due = new Date(deal.next_followup_date + "T00:00:00");
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
}

export function daysSinceStageChange(deal: Deal, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(deal.last_stage_change_at).getTime()) / MS_PER_DAY);
}

export interface DealChips {
  overdue: boolean;
  dueSoon: boolean;
  stalled: boolean;
  needsManagement: boolean;
}

export function computeChips(deal: Deal, openEscalationDealIds: Set<string>, now = new Date()): DealChips {
  const d = daysUntilFollowup(deal, now);
  const active = deal.status === "Active";
  return {
    overdue: active && d != null && d < 0,
    dueSoon: active && d != null && d >= 0 && d <= 2,
    stalled: active && daysSinceStageChange(deal, now) > 60,
    needsManagement: openEscalationDealIds.has(deal.id),
  };
}

export function needsAttention(chips: DealChips): boolean {
  return chips.overdue || chips.stalled || chips.needsManagement;
}

// ── Gate enforcement ─────────────────────────────────────────────────────────
// Server-side checks that must pass before a deal's `stage` column may change.

export interface GateCheckInput {
  deal: Deal;
  evidence: EvidenceItem[];
  confirmedStageKeys: Set<string>; // stage_outputs.stage values with confirmed_at set
}

export function materialClaimedItems(evidence: EvidenceItem[]): EvidenceItem[] {
  return evidence.filter(
    (e) => e.evidence_type === "Claimed" && e.is_material && !e.waived_by,
  );
}

/** Returns a list of human-readable blockers preventing advance from deal.stage to `to`. */
export function gateBlockers(input: GateCheckInput, to: Stage): string[] {
  const { deal, evidence, confirmedStageKeys } = input;
  const from = deal.stage;
  const blockers: string[] = [];

  if (nextStage(from) !== to) {
    blockers.push(`Cannot move from ${from} to ${to}: stages advance one at a time.`);
    return blockers;
  }

  if (from === "Triage" && !confirmedStageKeys.has("triage")) {
    blockers.push("Stage 0 Triage output must be confirmed before advancing to Research.");
  }

  if (from === "Research") {
    if (deal.conflict_check_status !== "Cleared") {
      blockers.push(
        "Group conflict check must be Cleared (with a named confirmer) before advancing to Options.",
      );
    }
  }

  if (from === "Options") {
    if (!confirmedStageKeys.has("options")) {
      blockers.push("A Stage 2 option must be selected and confirmed before advancing to Proposal.");
    }
    if (deal.value_hypothesis_rm == null || !deal.value_hypothesis_basis) {
      blockers.push("Value hypothesis (RM amount and one-line basis) is required before Proposal.");
    }
    if (!deal.confidence) {
      blockers.push("Confidence rating is required before Proposal.");
    }
    if (!deal.deposit_impact) {
      blockers.push("Deposit impact score is required before Proposal.");
    }
    if (deal.conflict_check_status !== "Cleared") {
      blockers.push("Conflict check must be Cleared before a deal may enter Proposal.");
    }
  }

  if (from === "Proposal") {
    if (!confirmedStageKeys.has("proposal")) {
      blockers.push("The proposal must be approved (confirmed) before advancing to Meeting Prep.");
    }
    const claimed = materialClaimedItems(evidence);
    if (claimed.length > 0) {
      blockers.push(
        `Material Claimed evidence must be upgraded or waived before leaving Proposal: ${claimed
          .map((c) => `“${c.claim}”`)
          .join(", ")}.`,
      );
    }
  }

  if (from === "Legal & Shariah") {
    if (deal.gate !== "Legal & Shariah approved") {
      blockers.push("Legal & Shariah gate requires Approver sign-off before Tech Integration.");
    }
  }

  return blockers;
}

/** Blockers preventing Stage 3 proposal *generation* (not stage advance). */
export function proposalGenerationBlockers(evidence: EvidenceItem[]): string[] {
  const claimed = materialClaimedItems(evidence);
  if (claimed.length === 0) return [];
  return claimed.map(
    (c) =>
      `Material evidence still Claimed: “${c.claim}”. Upgrade to Verified/Inferred or have the Head waive it with a reason.`,
  );
}

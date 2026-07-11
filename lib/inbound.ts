import { VERTICALS } from "@/lib/stages";

// Parsing helpers for inbound partnership inquiries forwarded to the desk.
// Deliberately tolerant of the shapes common email providers post (Resend
// inbound, SendGrid inbound parse, or a plain forward).

export interface ParsedInbound {
  from: string;
  subject: string;
  body: string;
  company: string;
  vertical: string;
}

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

// Very small keyword map so an obviously-matching inquiry lands in a sensible
// vertical; the Head corrects it on confirmation regardless.
// Word-boundaried so short tokens don't match inside other words
// (e.g. "pos" must not match "deposit").
const VERTICAL_HINTS: [RegExp, string][] = [
  [/\bpayroll\b|\bdeposit|\bsalary\b|\bfloat\b/i, "Payroll & Deposits"],
  [/\bacquir|\bmerchant\b|\bpayment|\bpos\b|\bcard\b|\bmdr\b/i, "Merchant & Acquiring"],
  [/supply chain|receivable|invoice|trade financ/i, "Supply Chain Financing"],
  [/co-?lend|consumer loan|\bbnpl\b|installment/i, "Consumer & Co-lending"],
  [/takaful|insurance|wealth|bancatakaful/i, "Bancatakaful & Wealth"],
  [/remittance|forex|\bfx\b|cross-border/i, "Remittance & FX"],
  [/\bmedia\b|advertis|sponsor|in-store/i, "Retail Media"],
];

function guessVertical(text: string): string {
  for (const [re, v] of VERTICAL_HINTS) if (re.test(text)) return v;
  return "Merchant & Acquiring";
}

function companyFromEmail(from: string, subject: string): string {
  // Prefer a display name before <...>, else the sender domain, else subject.
  const nameMatch = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (nameMatch && nameMatch[1].trim()) return nameMatch[1].trim();
  const domain = from.match(/@([^>\s]+)/)?.[1];
  if (domain) {
    const base = domain.split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return subject.slice(0, 60) || "Inbound partner";
}

export function parseInbound(payload: Record<string, unknown>): ParsedInbound {
  const from = pick(payload, ["from", "sender", "From", "envelope_from"]);
  const subject = pick(payload, ["subject", "Subject"]);
  const body = pick(payload, ["text", "body", "plain", "stripped-text", "html", "Body"]);
  const explicitCompany = pick(payload, ["company", "companyName"]);
  const explicitVertical = pick(payload, ["vertical"]);

  const company = explicitCompany || companyFromEmail(from, subject);
  const vertical = VERTICALS.includes(explicitVertical as (typeof VERTICALS)[number])
    ? explicitVertical
    : guessVertical(`${subject}\n${body}`);

  return { from, subject, body, company, vertical };
}

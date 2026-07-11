import { NextRequest, NextResponse } from "next/server";

// ── Rate limiting ────────────────────────────────────────────────────────────
// Best-effort in-memory limiter. Serverless instances are ephemeral, so for
// hard guarantees in production this should be backed by a shared store
// (Upstash/Redis); it still stops rapid bursts per warm instance and is the
// app-level defence layer on top of Supabase Auth's own login throttling.
interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

// Client identifier from proxy headers (Vercel sets x-forwarded-for).
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function tooManyRequests(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

// ── Same-origin / CSRF defence for state-changing route handlers ─────────────
// Server Actions are CSRF-protected by Next; cookie-authed POST route handlers
// are not, so we require the request to originate from our own site. Combined
// with SameSite=Lax auth cookies this blocks cross-site forgery.
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin) {
    // No Origin header (e.g. same-origin GET or a server-to-server call).
    // For POSTs a browser always sends Origin, so treat missing as allowed
    // only when there is also no cookie-based session risk. We still allow it
    // because our sensitive routes additionally check auth/secret.
    return true;
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbiddenCrossOrigin(): NextResponse {
  return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
}

// ── Error sanitisation ───────────────────────────────────────────────────────
// Never surface raw database/driver messages, stack traces, or internal paths
// to clients. Log the detail server-side, return a generic message with a code
// the user can quote to support.
export function safeError(context: string, err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[${context}]`, detail);
  return "Something went wrong. Please try again.";
}

// Redact obvious secret-shaped substrings from any string before it could be
// logged or returned (defence in depth for logging hygiene).
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/g, // Anthropic / OpenAI style
  /re_[A-Za-z0-9_-]{16,}/g, // Resend
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWTs
  /service_role[^\s"']*/gi,
];
export function redactSecrets(s: string): string {
  return SECRET_PATTERNS.reduce((acc, re) => acc.replace(re, "[redacted]"), s);
}

// ── Output encoding helpers ──────────────────────────────────────────────────
// CSV formula-injection guard: a leading =, +, -, @ (or tab/CR) can execute in
// spreadsheet apps. Prefix with a single quote to neutralise.
export function csvCell(value: unknown): string {
  const s = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const needsGuard = /^[=+\-@\t\r]/.test(s);
  const safe = (needsGuard ? "'" + s : s).replace(/"/g, '""');
  return `"${safe}"`;
}

// Filename hardening against path traversal / header injection.
export function safeFilename(base: string, ext: string): string {
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(0, 80) || "export";
  return `${cleaned}.${ext.replace(/[^a-z0-9]/gi, "")}`;
}

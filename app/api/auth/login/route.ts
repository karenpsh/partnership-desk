import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimit,
  clientIp,
  tooManyRequests,
  isSameOrigin,
  forbiddenCrossOrigin,
} from "@/lib/security";

// Server-side sign-in so we can enforce brute-force protection and establish
// the session (httpOnly cookies) server-side. Supabase Auth enforces its own
// authoritative rate limits too; this is the app-level defence layer.
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // Two limiters: per-IP (broad) and per-email (targeted account defence).
  const ip = clientIp(req);
  const perIp = rateLimit(`login:ip:${ip}`, 15, 15 * 60_000);
  if (!perIp.ok) return tooManyRequests(perIp.retryAfter);
  const perEmail = rateLimit(`login:email:${email}`, 5, 15 * 60_000);
  if (!perEmail.ok) {
    console.warn("[login:lockout]", { email, ip });
    return NextResponse.json(
      { error: "Too many attempts. This account is temporarily locked. Try again later." },
      { status: 429, headers: { "Retry-After": String(perEmail.retryAfter) } },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    // Generic message — never reveal whether the email exists.
    console.warn("[login:failed]", { email, ip });
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

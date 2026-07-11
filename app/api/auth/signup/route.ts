import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimit,
  clientIp,
  tooManyRequests,
  isSameOrigin,
  forbiddenCrossOrigin,
} from "@/lib/security";

// Server-side sign-up so the session is established with hardened httpOnly
// cookies (no client-JS session handling anywhere in the app).
//
// Roles are NOT self-assigned: the database trigger (handle_new_user) decides
// the role authoritatively — first user is Admin, everyone else is Manager —
// and ignores any client-supplied role. So we do not accept or forward a role.
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  const ip = clientIp(req);
  const rl = rateLimit(`signup:${ip}`, 10, 15 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: { email?: string; password?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.fullName ?? "").trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (!fullName || fullName.length > 120) {
    return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error || !data.user) {
    console.warn("[signup:failed]", { email, ip });
    // Generic — do not reveal whether the email already exists.
    return NextResponse.json({ error: "Could not create the account." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

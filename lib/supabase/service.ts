import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for privileged server-only work that runs without a
// user session (the daily cron job). Bypasses RLS, so it must NEVER be
// imported into client code or exposed to the browser. Returns null when the
// service key is not configured, so callers can degrade gracefully.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

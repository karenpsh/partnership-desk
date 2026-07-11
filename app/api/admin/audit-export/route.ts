import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth";
import type { AuditEvent } from "@/lib/types";

// Admin-only, timestamped export of the immutable audit log (CSV). Returns
// 403 for every other role.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!isAdmin(user.role)) {
    return NextResponse.json(
      { error: "Audit export is restricted to the Admin role." },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as AuditEvent[];
  const cols = [
    "id",
    "created_at",
    "deal_id",
    "event_type",
    "actor",
    "prompt_template_version",
    "metadata",
  ] as const;
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(",")),
  ].join("\n");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${stamp}.csv"`,
    },
  });
}

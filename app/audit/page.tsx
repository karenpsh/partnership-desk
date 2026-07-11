import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AuditEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const supabase = await createClient();
  const [eventsRes, dealsRes] = await Promise.all([
    supabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("deals").select("id,company"),
  ]);

  if (eventsRes.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
        Could not load audit log: {eventsRes.error.message}
      </div>
    );
  }

  const events = (eventsRes.data ?? []) as AuditEvent[];
  const companyById = new Map(
    ((dealsRes.data ?? []) as { id: string; company: string }[]).map((d) => [d.id, d.company]),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Immutable record of every AI generation, human edit, gate approval and stage
          transition. Most recent first (last 200 events).
        </p>
      </div>
      {events.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center text-sm text-neutral-500">
          No audit events yet. Work a deal and every action will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Deal</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Prompt ver.</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-500">
                    {new Date(e.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">
                      {e.event_type}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {e.deal_id ? (
                      <Link href={`/deals/${e.deal_id}`} className="text-violet-700 hover:underline">
                        {companyById.get(e.deal_id) ?? e.deal_id.slice(0, 8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{e.actor ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-500">{e.prompt_template_version ?? "—"}</td>
                  <td className="max-w-md px-3 py-2 text-xs text-neutral-500">
                    <code className="line-clamp-2 break-all">
                      {e.metadata ? JSON.stringify(e.metadata) : ""}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

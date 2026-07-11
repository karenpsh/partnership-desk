import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth";
import type { PromptTemplate } from "@/lib/types";
import { PromptTemplateEditor } from "./prompt-editor";
import { RoleAssigner } from "./role-assigner";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-12 text-center">
        <h1 className="text-lg font-semibold text-red-800">Admin only</h1>
        <p className="mt-1 text-sm text-red-600">
          This area is restricted to the Admin role. You are signed in as {user?.role ?? "a guest"}.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-violet-700 hover:underline">
          Back to Board
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [templatesRes, profilesRes] = await Promise.all([
    supabase.from("prompt_templates").select("*").eq("is_active", true).order("stage"),
    supabase.from("profiles").select("id, email, full_name, role").order("created_at"),
  ]);
  const templates = (templatesRes.data ?? []) as PromptTemplate[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Prompt template versioning, user roles, and audit export.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Audit log export
          </h2>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">
            Download the full immutable audit trail as a timestamped CSV.
          </p>
          <a
            href="/api/admin/audit-export"
            className="mt-3 inline-flex items-center rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
          >
            Export audit log (CSV)
          </a>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Prompt templates ({templates.length} active)
        </h2>
        <div className="space-y-3">
          {templates.map((t) => (
            <PromptTemplateEditor key={t.id} template={t} />
          ))}
          {templates.length === 0 && (
            <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-400">
              No prompt templates yet.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Users &amp; roles ({profiles.length})
        </h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-3 py-2 font-medium">{p.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-600">{p.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <RoleAssigner userId={p.id} current={p.role} isSelf={p.id === user.id} />
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-neutral-400">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

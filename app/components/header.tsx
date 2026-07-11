import Link from "next/link";
import { canEditDeals, isAdmin, isHead, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

const ROLE_BADGE: Record<string, string> = {
  Manager: "bg-sky-100 text-sky-800",
  Head: "bg-violet-100 text-violet-800",
  Approver: "bg-emerald-100 text-emerald-800",
  Reviewer: "bg-amber-100 text-amber-800",
  Admin: "bg-neutral-200 text-neutral-700",
};

export async function Header() {
  // One client for auth + queries: getUser() establishes the session on this
  // exact client, so the follow-up query runs with the user's identity (a
  // second client instance in the layout can fall back to anon).
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let user: { role: Role; fullName: string } | null = null;
  let inboundCount = 0;
  if (authUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", authUser.id)
      .single();
    const role = (profile?.role as Role) ?? "Manager";
    user = {
      role,
      fullName:
        (profile?.full_name as string) ??
        (authUser.user_metadata?.full_name as string) ??
        authUser.email ??
        "User",
    };
    if (isHead(role)) {
      const { data } = await supabase.from("deals").select("id").eq("status", "PendingInbound");
      inboundCount = data?.length ?? 0;
    }
  }

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-violet-700 text-white text-xs font-bold">
            PD
          </span>
          <span className="font-semibold tracking-tight">Partnership Desk</span>
          <span className="hidden sm:inline text-xs text-neutral-400">AEON Bank</span>
        </Link>

        {user && (
          <nav className="flex items-center gap-4 text-sm text-neutral-600">
            <Link href="/" className="hover:text-neutral-900">
              Pipeline
            </Link>
            <Link href="/dashboard" className="hover:text-neutral-900">
              Dashboard
            </Link>
            <Link href="/knowledge" className="hover:text-neutral-900">
              Knowledge
            </Link>
            {isHead(user.role) && (
              <Link href="/inbound" className="hover:text-neutral-900">
                Inbound{inboundCount > 0 ? ` (${inboundCount})` : ""}
              </Link>
            )}
            <Link href="/notifications" className="hover:text-neutral-900">
              Notifications
            </Link>
            <Link href="/audit" className="hover:text-neutral-900">
              Audit log
            </Link>
            {isAdmin(user.role) && (
              <Link href="/admin" className="hover:text-neutral-900">
                Admin
              </Link>
            )}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              {canEditDeals(user.role) && (
                <Link
                  href="/deals/new"
                  className="inline-flex items-center rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800"
                >
                  New Deal
                </Link>
              )}
              <span className="hidden items-center gap-1.5 text-sm sm:flex">
                <span className="text-neutral-600">{user.fullName}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    ROLE_BADGE[user.role] ?? "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {user.role}
                </span>
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

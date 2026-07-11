import Link from "next/link";
import { getSessionUser, canEditDeals, isAdmin } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

const ROLE_BADGE: Record<string, string> = {
  Manager: "bg-sky-100 text-sky-800",
  Head: "bg-violet-100 text-violet-800",
  Approver: "bg-emerald-100 text-emerald-800",
  Reviewer: "bg-amber-100 text-amber-800",
  Admin: "bg-neutral-200 text-neutral-700",
};

export async function Header() {
  const user = await getSessionUser();

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

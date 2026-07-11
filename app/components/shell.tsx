"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
  badge?: number;
}

export interface ShellUser {
  fullName: string;
  role: string;
}

const ROLE_BADGE: Record<string, string> = {
  Manager: "bg-sky-100 text-sky-800",
  Head: "bg-violet-100 text-violet-800",
  Approver: "bg-emerald-100 text-emerald-800",
  Reviewer: "bg-amber-100 text-amber-800",
  Admin: "bg-neutral-200 text-neutral-700",
};

type IconKey =
  | "pipeline"
  | "dashboard"
  | "knowledge"
  | "inbound"
  | "notifications"
  | "audit"
  | "admin"
  | "plus";

const ICONS: Record<IconKey, React.ReactNode> = {
  pipeline: (
    <path d="M4 5h5v14H4zM10 5h5v9h-5zM16 5h4v6h-4z" strokeLinejoin="round" />
  ),
  dashboard: (
    <>
      <path d="M4 13v6h4v-6zM10 8v11h4V8zM16 3v16h4V3z" strokeLinejoin="round" />
    </>
  ),
  knowledge: (
    <path
      d="M5 4h11a2 2 0 0 1 2 2v14l-4-2-4 2-3-1.5V4zM7 4v13"
      strokeLinejoin="round"
    />
  ),
  inbound: (
    <path
      d="M4 13h4l1.5 2.5h5L16 13h4M4 13l2-8h12l2 8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
      strokeLinejoin="round"
    />
  ),
  notifications: (
    <path
      d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0"
      strokeLinejoin="round"
    />
  ),
  audit: (
    <path
      d="M8 4h8a1 1 0 0 1 1 1v15l-5-2-5 2V5a1 1 0 0 1 1-1zM9 8h6M9 11h6M9 14h4"
      strokeLinejoin="round"
    />
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
};

function Icon({ name }: { name: IconKey }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/deals");
  return pathname === href || pathname.startsWith(href + "/");
}

export function Shell({
  user,
  canEdit,
  navItems,
  children,
}: {
  user: ShellUser;
  canEdit: boolean;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on navigation, and lock body scroll while it's open.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-violet-50 text-violet-800"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            <span className={active ? "text-violet-700" : "text-neutral-400"}>
              <Icon name={item.icon} />
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-700 px-1.5 text-[11px] font-semibold text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-5 py-4">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-violet-700 text-xs font-bold text-white">
        PD
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight">Partnership Desk</span>
        <span className="block text-[11px] text-neutral-400">Anon</span>
      </span>
    </Link>
  );

  const cta = canEdit && (
    <div className="px-3 pb-2">
      <Link
        href="/deals/new"
        onClick={() => setOpen(false)}
        className="flex items-center justify-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800"
      >
        <Icon name="plus" />
        New Deal
      </Link>
    </div>
  );

  const footer = (
    <div className="border-t border-neutral-200 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600">
          {user.fullName.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium text-neutral-800">
            {user.fullName}
          </span>
          <span
            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
              ROLE_BADGE[user.role] ?? "bg-neutral-100 text-neutral-600"
            }`}
          >
            {user.role}
          </span>
        </span>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Sign out
        </button>
      </form>
    </div>
  );

  const sidebarInner = (
    <>
      {brand}
      {cta}
      {nav}
      {footer}
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
        {sidebarInner}
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-violet-700 text-[11px] font-bold text-white">
          PD
        </span>
        <span className="text-sm font-semibold">Partnership Desk</span>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            {sidebarInner}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-[1600px] px-4 py-6 pt-20 sm:px-6 md:pt-6">{children}</main>
      </div>
    </div>
  );
}

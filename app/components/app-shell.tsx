import { canEditDeals, isAdmin, isHead, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Shell, type NavItem } from "./shell";

// Server shell: resolves the session + role + inbound count, then hands a
// serialisable nav model to the client Shell (which owns active-link state and
// the mobile drawer). When there is no session (the /login page), it renders
// the children full-width with no navigation.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", authUser.id)
    .single();
  const role = (profile?.role as Role) ?? "Manager";
  const fullName =
    (profile?.full_name as string) ??
    (authUser.user_metadata?.full_name as string) ??
    authUser.email ??
    "User";

  let inboundCount = 0;
  if (isHead(role)) {
    const { data } = await supabase.from("deals").select("id").eq("status", "PendingInbound");
    inboundCount = data?.length ?? 0;
  }

  const navItems: NavItem[] = [
    { href: "/", label: "Pipeline", icon: "pipeline" },
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/knowledge", label: "Knowledge", icon: "knowledge" },
    ...(isHead(role)
      ? [{ href: "/inbound", label: "Inbound", icon: "inbound" as const, badge: inboundCount }]
      : []),
    { href: "/notifications", label: "Notifications", icon: "notifications" },
    { href: "/audit", label: "Audit log", icon: "audit" },
    ...(isAdmin(role) ? [{ href: "/admin", label: "Admin", icon: "admin" as const }] : []),
  ];

  return (
    <Shell user={{ fullName, role }} canEdit={canEditDeals(role)} navItems={navItems}>
      {children}
    </Shell>
  );
}

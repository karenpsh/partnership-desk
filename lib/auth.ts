import { createClient } from "@/lib/supabase/server";

export type Role = "Manager" | "Head" | "Approver" | "Reviewer" | "Admin";

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string;
  role: Role;
}

/**
 * The authenticated user plus their role from `profiles`, or null when no
 * one is signed in. Uses getUser() (validates the token server-side) rather
 * than getSession() (which only decodes the cookie).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as Role) ?? "Manager";
  const fullName =
    (profile?.full_name as string) ??
    (user.user_metadata?.full_name as string) ??
    user.email ??
    "User";

  return { id: user.id, email: user.email ?? null, fullName, role };
}

export const canEditDeals = (role: Role) => role === "Manager" || role === "Head";
export const canReadAll = (role: Role) =>
  role === "Head" || role === "Approver" || role === "Reviewer" || role === "Admin";
export const canRunAi = (role: Role) => role === "Manager" || role === "Head";
export const isHead = (role: Role) => role === "Head";
export const isApprover = (role: Role) => role === "Approver";
export const isAdmin = (role: Role) => role === "Admin";
// Legal & Shariah gate approval: Approver (or Head as the desk owner).
export const canApproveGate = (role: Role) => role === "Approver" || role === "Head";

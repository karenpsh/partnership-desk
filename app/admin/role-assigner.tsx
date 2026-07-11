"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignRole } from "@/app/actions/admin";

const ROLES = ["Manager", "Head", "Approver", "Reviewer", "Admin"];

export function RoleAssigner({
  userId,
  current,
  isSelf,
}: {
  userId: string;
  current: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(current);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => {
          const next = e.target.value;
          setRole(next);
          setError(null);
          startTransition(async () => {
            const res = await assignRole({ userId, role: next });
            if (res.error) {
              setError(res.error);
              setRole(current);
            } else {
              router.refresh();
            }
          });
        }}
        disabled={pending || isSelf}
        className="rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-60"
        title={isSelf ? "You cannot change your own role" : undefined}
      >
        {ROLES.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      {isSelf && <span className="text-xs text-neutral-400">you</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

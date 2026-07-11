"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

const ROLES = ["Manager", "Head", "Approver", "Reviewer", "Admin"] as const;

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("Manager");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        // Server-side sign-in (rate-limited, brute-force protected).
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          setError(payload.error ?? "Sign in failed.");
          return;
        }
      } else {
        if (!fullName.trim()) {
          setError("Your name is required.");
          return;
        }
        // Server-side sign-up (hardened httpOnly session cookies).
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName: fullName.trim(), role }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          setError(payload.error ?? "Could not create the account.");
          return;
        }
      }
      // Full navigation so the server re-reads the session cookie.
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex rounded-md border border-neutral-200 p-0.5 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded px-3 py-1.5 font-medium ${
              mode === m ? "bg-violet-700 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {mode === "signup" && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Full name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} required />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
          autoComplete="email"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
        />
      </label>

      {mode === "signup" && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Role (demo)</span>
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={input}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-neutral-400">
            In production this comes from the bank directory / Admin, not self-selected.
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}

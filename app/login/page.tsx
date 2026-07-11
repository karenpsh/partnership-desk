import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-violet-700 text-sm font-bold text-white">
          PD
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Partnership Desk</h1>
        <p className="mt-1 text-sm text-neutral-500">AEON Bank · sign in to continue</p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-4 text-center text-xs text-neutral-400">
        In production, access is via the bank single sign-on. This email form is the
        demo/fallback path.
      </p>
    </div>
  );
}

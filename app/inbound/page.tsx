import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, isHead } from "@/lib/auth";
import type { Deal, StageOutput } from "@/lib/types";
import { InboundCard } from "./inbound-card";

export const dynamic = "force-dynamic";

interface ProfileOption {
  id: string;
  full_name: string | null;
  role: string;
}

export default async function InboundPage() {
  const user = await getSessionUser();
  if (!user || !isHead(user.role)) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-12 text-center">
        <h1 className="text-lg font-semibold text-red-800">Head only</h1>
        <p className="mt-1 text-sm text-red-600">
          The inbound review queue is for the Head of Partnerships. You are signed in as{" "}
          {user?.role ?? "a guest"}.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-violet-700 hover:underline">
          Back to Board
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("deals")
    .select("*")
    .eq("status", "PendingInbound")
    .order("created_at", { ascending: false });
  const deals = (pending ?? []) as Deal[];

  // Raw inbound emails (queued triage rows) and assignable owners.
  const [outputsRes, profilesRes] = await Promise.all([
    deals.length
      ? supabase.from("stage_outputs").select("*").in("deal_id", deals.map((d) => d.id))
      : Promise.resolve({ data: [] as StageOutput[] }),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["Manager", "Head"]),
  ]);
  const triageByDeal = new Map<string, StageOutput>();
  for (const o of (outputsRes.data ?? []) as StageOutput[]) {
    if (o.stage === "triage") triageByDeal.set(o.deal_id, o);
  }
  const owners = ((profilesRes.data ?? []) as ProfileOption[]).map((p) => ({
    id: p.id,
    name: p.full_name ?? "Unnamed",
    role: p.role,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Inbound queue</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Partnership inquiries forwarded to the desk are auto-created here at Stage 0. Confirm to
          activate a deal and assign an owner, or decline. Nothing enters the pipeline until you
          confirm it.
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center text-sm text-neutral-400">
          No inbound inquiries awaiting review.
        </div>
      ) : (
        deals.map((deal) => (
          <InboundCard
            key={deal.id}
            deal={deal}
            email={
              (triageByDeal.get(deal.id)?.ai_output as { saved_input?: string } | undefined)
                ?.saved_input ?? ""
            }
            owners={owners}
            headId={user.id}
          />
        ))
      )}
    </div>
  );
}

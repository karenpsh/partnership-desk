import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeChips, weightedValue, type DealChips } from "@/lib/stages";
import type { Deal } from "@/lib/types";
import { BoardView, type BoardDeal } from "./board-view";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createClient();

  const [dealsRes, escRes] = await Promise.all([
    supabase.from("deals").select("*"),
    supabase.from("escalations").select("id,deal_id,status").eq("status", "Open"),
  ]);

  if (dealsRes.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
        <p className="font-medium text-red-800">
          Could not load pipeline — refresh to try again.
        </p>
        <p className="mt-1 text-sm text-red-600">{dealsRes.error.message}</p>
      </div>
    );
  }

  const deals = (dealsRes.data ?? []) as Deal[];
  const openEscalationDealIds = new Set(
    (escRes.data ?? []).map((e) => e.deal_id as string),
  );

  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-2xl">
          📋
        </div>
        <h2 className="text-lg font-semibold">No deals in the pipeline yet</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Create your first deal to start working the desk.
        </p>
        <Link
          href="/deals/new"
          className="mt-4 inline-flex items-center rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
        >
          Create your first deal
        </Link>
      </div>
    );
  }

  const now = new Date();
  const boardDeals: BoardDeal[] = deals.map((deal) => ({
    deal,
    chips: computeChips(deal, openEscalationDealIds, now) as DealChips,
    weighted: weightedValue(deal),
  }));

  return <BoardView deals={boardDeals} escalationCount={openEscalationDealIds.size} />;
}

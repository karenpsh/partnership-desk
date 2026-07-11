import { createClient } from "@/lib/supabase/server";
import type { Lesson } from "@/lib/types";
import { KnowledgeBrowser, type LessonWithCompany } from "./knowledge-browser";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const supabase = await createClient();
  const [lessonsRes, dealsRes] = await Promise.all([
    supabase.from("lessons").select("*").order("created_at", { ascending: false }),
    supabase.from("deals").select("id, company"),
  ]);

  if (lessonsRes.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
        Could not load knowledge base: {lessonsRes.error.message}
      </div>
    );
  }

  const companyById = new Map(
    ((dealsRes.data ?? []) as { id: string; company: string }[]).map((d) => [d.id, d.company]),
  );
  const lessons: LessonWithCompany[] = ((lessonsRes.data ?? []) as Lesson[]).map((l) => ({
    ...l,
    company: companyById.get(l.deal_id) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Knowledge base</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every closed deal files a lesson. Search by vertical, outcome or keyword — these feed
          Stage 1 and Stage 2 generations automatically for matching verticals.
        </p>
      </div>
      <KnowledgeBrowser lessons={lessons} />
    </div>
  );
}

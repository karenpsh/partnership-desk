import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import type { Deal } from "@/lib/types";

// Calendar integration (Phase 2): an .ics event for a deal's next follow-up,
// so owners can add the reminder to any calendar app. RLS scopes the read, so
// a user can only export a deal they can see.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase.from("deals").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  const deal = data as Deal;
  if (!deal.next_followup_date) {
    return NextResponse.json({ error: "This deal has no follow-up date set." }, { status: 400 });
  }

  const date = deal.next_followup_date.replace(/-/g, ""); // YYYYMMDD (all-day)
  const dtEnd = (() => {
    const d = new Date(deal.next_followup_date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10).replace(/-/g, "");
  })();
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const uid = `deal-${deal.id}-followup@partnership-desk`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AEON Bank//Partnership Desk//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${esc(`Follow up: ${deal.company}`)}`,
    `DESCRIPTION:${esc(
      `Partnership Desk follow-up.\nStage: ${deal.stage}\nOwner: ${deal.owner_name ?? "unassigned"}\nVertical: ${deal.vertical}`,
    )}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`Follow up tomorrow: ${deal.company}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="followup-${deal.company.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics"`,
    },
  });
}

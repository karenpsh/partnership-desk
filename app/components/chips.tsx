import type { DealChips } from "@/lib/stages";

const CHIP_STYLES: Record<string, string> = {
  Overdue: "bg-red-100 text-red-800 border-red-200",
  "Due Soon": "bg-amber-100 text-amber-800 border-amber-200",
  Stalled: "bg-orange-100 text-orange-800 border-orange-200",
  "Needs Management": "bg-violet-100 text-violet-800 border-violet-200",
  Parked: "bg-sky-100 text-sky-800 border-sky-200",
  Killed: "bg-neutral-200 text-neutral-600 border-neutral-300",
  Live: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function Chip({ label }: { label: string }) {
  const style = CHIP_STYLES[label] ?? "bg-neutral-100 text-neutral-700 border-neutral-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${style}`}
    >
      {label}
    </span>
  );
}

export function StatusChips({
  chips,
  status,
}: {
  chips: DealChips;
  status: string;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {chips.overdue && <Chip label="Overdue" />}
      {chips.dueSoon && <Chip label="Due Soon" />}
      {chips.stalled && <Chip label="Stalled" />}
      {chips.needsManagement && <Chip label="Needs Management" />}
      {status !== "Active" && <Chip label={status} />}
    </span>
  );
}

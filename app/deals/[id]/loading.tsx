export default function DealLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading deal">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-neutral-200" />
        <div className="h-8 w-64 rounded bg-neutral-200" />
        <div className="h-4 w-96 rounded bg-neutral-100" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="h-96 rounded-lg border border-neutral-200 bg-white" />
        <div className="h-96 rounded-lg border border-neutral-200 bg-white" />
      </div>
    </div>
  );
}

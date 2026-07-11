export default function BoardLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-label="Loading pipeline">
      <div className="flex gap-3">
        <div className="h-8 w-32 rounded bg-neutral-200" />
        <div className="h-8 w-40 rounded bg-neutral-200" />
        <div className="h-8 w-32 rounded bg-neutral-200" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-64 shrink-0 space-y-2 rounded-lg bg-neutral-100 p-2">
            <div className="h-4 w-24 rounded bg-neutral-200" />
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="h-28 rounded-lg bg-white border border-neutral-200 p-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-neutral-200" />
                <div className="h-3 w-1/2 rounded bg-neutral-100" />
                <div className="h-4 w-2/3 rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

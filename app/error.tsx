"use client";

export default function BoardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center">
      <p className="font-medium text-red-800">Could not load pipeline — refresh to try again.</p>
      <button
        onClick={reset}
        className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Retry
      </button>
    </div>
  );
}

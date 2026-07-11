import { NewDealForm } from "./new-deal-form";

export default function NewDealPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold tracking-tight">New Deal</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Inbound deals start at Stage 0 Triage; outbound deals start at Stage 1 Research.
      </p>
      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-5">
        <NewDealForm />
      </div>
    </div>
  );
}

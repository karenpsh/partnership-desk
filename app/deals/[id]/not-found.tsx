import Link from "next/link";

export default function DealNotFound() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Deal not found</h1>
      <p className="mt-1 text-sm text-neutral-500">
        This deal does not exist or the link is wrong.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
      >
        Back to Board
      </Link>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partnership Desk · AEON Bank",
  description:
    "AI-guided partnership operating system for AEON Bank's partnerships team",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-neutral-50 text-neutral-900 min-h-screen">
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-violet-700 text-white text-xs font-bold">
                PD
              </span>
              <span className="font-semibold tracking-tight">
                Partnership Desk
              </span>
              <span className="hidden sm:inline text-xs text-neutral-400">
                AEON Bank
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-600">
              <Link href="/" className="hover:text-neutral-900">
                Pipeline
              </Link>
              <Link href="/notifications" className="hover:text-neutral-900">
                Notifications
              </Link>
              <Link href="/audit" className="hover:text-neutral-900">
                Audit log
              </Link>
            </nav>
            <div className="ml-auto">
              <Link
                href="/deals/new"
                className="inline-flex items-center rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800"
              >
                New Deal
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./components/app-shell";

export const metadata: Metadata = {
  title: "Partnership Desk · Anon",
  description:
    "AI-guided partnership operating system for Anon's partnerships team",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-neutral-50 text-neutral-900 min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

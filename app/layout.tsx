import type { Metadata } from "next";
import "./globals.css";
import { Header } from "./components/header";

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
        <Header />
        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}

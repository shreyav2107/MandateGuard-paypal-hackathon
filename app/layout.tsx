import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MandateGuard",
  description: "An AI checkpoint that stops you from authorizing recurring payments you don’t understand.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-slate-200 bg-white">
          <nav
            aria-label="Main navigation"
            className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-x-6 gap-y-2 px-4 py-3 text-sm font-medium text-slate-700 sm:px-6"
          >
            <Link className="transition hover:text-indigo-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" href="/">
              Store
            </Link>
            <Link className="transition hover:text-indigo-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" href="/audit">
              Audit
            </Link>
            <Link className="transition hover:text-indigo-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" href="/upi-sim">
              UPI Simulator
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

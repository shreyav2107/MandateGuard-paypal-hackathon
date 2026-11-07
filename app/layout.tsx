import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MandateGuard — Subscription clarity",
  description: "Understand subscription terms before you commit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

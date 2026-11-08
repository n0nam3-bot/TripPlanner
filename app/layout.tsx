import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tripfinder — Make room for somewhere new",
  description:
    "A more thoughtful way to discover destinations, compare complete trip ideas, and plan a vacation around your real budget.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { VercelTelemetry } from "./analytics";

const siteBaseUrl = process.env.SITE_URL
  ? new URL(process.env.SITE_URL.startsWith("http") ? process.env.SITE_URL : `https://${process.env.SITE_URL}`)
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    : undefined;

export const metadata: Metadata = {
  metadataBase: siteBaseUrl,
  title: "Tripfinder — Make room for somewhere new",
  description:
    "A more thoughtful way to discover destinations, compare complete trip ideas, and plan a vacation around your real budget.",
  alternates: siteBaseUrl ? { canonical: "/" } : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<VercelTelemetry /></body>
    </html>
  );
}

import type { Metadata } from "next";
import AdminDashboard from "./admin-dashboard";

export const metadata: Metadata = { title: "Tripfinder Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <AdminDashboard />;
}

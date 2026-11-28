import type { Metadata } from "next";
import { STATE_LABELS } from "@/lib/account/account";
import { requireAdmin } from "@/lib/auth/current-account";
import { Dashboard } from "./dashboard-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminDashboardPage() {
  // Guarded here as well as in the layout: a layout is not re-run on every client navigation, a page is.
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return (
    <>
      <h1 className="page-title">Administration</h1>
      <p data-testid="admin-state">Administrator account state: {STATE_LABELS[result.admin.state] ?? result.admin.state}</p>
      <Dashboard />
    </>
  );
}

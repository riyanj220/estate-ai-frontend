import type { Metadata } from "next";
import Link from "next/link";
import { STATE_LABELS, displayName, typeLabel } from "@/lib/account";
import { requireAccount } from "@/lib/current-account";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { account } = result;
  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p>
        Signed in as <strong data-testid="dashboard-name">{displayName(account)}</strong>.
      </p>
      <p className="muted" data-testid="dashboard-type">
        Account type: {typeLabel(account.account_type)}
      </p>
      <p className="muted" data-testid="dashboard-state">
        Account state: {STATE_LABELS[account.state]}
      </p>
      {account.account_type === "individual" && (
        <p>
          <Link href="/account/profile" className="text-link">
            Profile
          </Link>
        </p>
      )}
      <p>
        <Link href="/account/password" className="text-link">
          Change password
        </Link>
      </p>
    </>
  );
}

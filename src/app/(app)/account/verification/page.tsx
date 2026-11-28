import type { Metadata } from "next";
import { requireAccount } from "@/lib/auth/current-account";
import { VerificationClient } from "./verification-client";

export const metadata: Metadata = { title: "Agency verification | EstateAI", robots: { index: false, follow: false } };

export default async function VerificationPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { account } = result;
  return (
    <>
      <h1 className="page-title">Agency verification</h1>
      {account.account_type === "agency" ? (
        <VerificationClient agencyName={account.agency_name} />
      ) : (
        <p className="card" data-testid="verification-forbidden">
          Verification is available for agency accounts.
        </p>
      )}
    </>
  );
}

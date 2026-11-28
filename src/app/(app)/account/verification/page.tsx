import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccount } from "@/lib/auth/current-account";
import { VerificationClient } from "./verification-client";

export const metadata: Metadata = { title: "Agency verification | EstateAI", robots: { index: false, follow: false } };

export default async function VerificationPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { account } = result;
  return (
    <>
      <PageHeader title="Agency verification" eyebrow="Your agency">
        Get the Verified mark beside your agency name.
      </PageHeader>
      {account.account_type === "agency" ? (
        <div className="app-wide grid items-start gap-6 lg:grid-cols-2 [&>.card]:mb-0">
          <VerificationClient agencyName={account.agency_name} />
        </div>
      ) : (
        <p className="card" data-testid="verification-forbidden">
          Verification is available for agency accounts.
        </p>
      )}
    </>
  );
}

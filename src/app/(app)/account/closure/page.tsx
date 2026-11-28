import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccount } from "@/lib/auth/current-account";
import { ClosureClient } from "./closure-client";

export const metadata: Metadata = { title: "Close account | EstateAI", robots: { index: false, follow: false } };

export default async function ClosurePage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const type = result.account.account_type;
  return (
    <>
      <PageHeader title="Close account" eyebrow="Your account">
        Ask for your account to be closed, and follow your request.
      </PageHeader>
      {type === "individual" || type === "agency" ? (
        <div className="app-wide grid items-start gap-6 lg:grid-cols-2 [&>.card]:mb-0">
          <ClosureClient />
        </div>
      ) : (
        <p className="card" data-testid="closure-forbidden">
          Closure requests are available for individual and agency accounts.
        </p>
      )}
    </>
  );
}

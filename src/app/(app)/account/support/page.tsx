import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccount } from "@/lib/auth/current-account";
import { SupportClient } from "./support-client";

export const metadata: Metadata = { title: "Support | EstateAI", robots: { index: false, follow: false } };

export default async function SupportPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const type = result.account.account_type;
  return (
    <>
      <PageHeader title="Support" eyebrow="Help">
        Ask a question or contest a decision. We reply to your request here.
      </PageHeader>
      {type === "individual" || type === "agency" ? (
        <div className="app-wide grid items-start gap-6 lg:grid-cols-2 [&>.card]:mb-0">
          <SupportClient />
        </div>
      ) : (
        <p className="card" data-testid="support-forbidden">
          Support requests are available for individual and agency accounts.
        </p>
      )}
    </>
  );
}

import type { Metadata } from "next";
import { requireAccount } from "@/lib/auth/current-account";
import { SupportClient } from "./support-client";

export const metadata: Metadata = { title: "Support | EstateAI", robots: { index: false, follow: false } };

export default async function SupportPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const type = result.account.account_type;
  return (
    <>
      <h1 className="page-title">Support</h1>
      {type === "individual" || type === "agency" ? (
        <SupportClient />
      ) : (
        <p className="card" data-testid="support-forbidden">
          Support requests are available for individual and agency accounts.
        </p>
      )}
    </>
  );
}

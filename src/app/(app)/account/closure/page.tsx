import type { Metadata } from "next";
import { requireAccount } from "@/lib/auth/current-account";
import { ClosureClient } from "./closure-client";

export const metadata: Metadata = { title: "Close account | EstateAI", robots: { index: false, follow: false } };

export default async function ClosurePage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const type = result.account.account_type;
  return (
    <>
      <h1 className="page-title">Close account</h1>
      {type === "individual" || type === "agency" ? (
        <ClosureClient />
      ) : (
        <p className="card" data-testid="closure-forbidden">
          Closure requests are available for individual and agency accounts.
        </p>
      )}
    </>
  );
}

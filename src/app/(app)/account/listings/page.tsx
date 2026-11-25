import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAccount } from "@/lib/current-account";
import { ListingsClient } from "./listings-client";

// The title never carries a count or any listing content.
export const metadata: Metadata = { title: "My listings | EstateAI", robots: { index: false, follow: false } };

export default async function ListingsPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  // An administrator opens the same page and gets the server's 403 as a polite message.
  return (
    <Suspense fallback={null}>
      <ListingsClient admin={result.account.account_type === "admin"} />
    </Suspense>
  );
}

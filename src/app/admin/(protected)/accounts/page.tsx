import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/current-account";
import { Accounts } from "./accounts-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountsPage() {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return <Accounts />;
}

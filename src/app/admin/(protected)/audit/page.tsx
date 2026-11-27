import type { Metadata } from "next";
import { requireAdmin } from "@/lib/current-account";
import { AuditTrail } from "./audit-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AuditPage() {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return <AuditTrail />;
}

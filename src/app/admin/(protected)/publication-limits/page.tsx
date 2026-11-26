import type { Metadata } from "next";
import { requireAdmin } from "@/lib/current-account";
import { PublicationLimits } from "./publication-limits-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PublicationLimitsPage() {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return <PublicationLimits />;
}

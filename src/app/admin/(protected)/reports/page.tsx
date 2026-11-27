import type { Metadata } from "next";
import { requireAdmin } from "@/lib/current-account";
import { ReportsReview } from "./reports-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { reason } = await searchParams;
  return <ReportsReview initialReason={reason === "ai_generated_content" ? reason : ""} />;
}

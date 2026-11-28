import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/current-account";
import { AccountReview } from "./review-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { id } = await params;
  return <AccountReview accountId={id} />;
}

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/current-account";
import { VerificationQueue } from "./verification-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function VerificationReviewPage() {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return <VerificationQueue />;
}

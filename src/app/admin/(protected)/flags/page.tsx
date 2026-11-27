import type { Metadata } from "next";
import { requireAdmin } from "@/lib/current-account";
import { FlagsReview } from "./flags-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function FlagsPage() {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return <FlagsReview />;
}

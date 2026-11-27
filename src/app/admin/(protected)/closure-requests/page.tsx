import type { Metadata } from "next";
import { requireAdmin } from "@/lib/current-account";
import { ClosureQueue } from "./closure-queue-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ClosureRequestsPage() {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return <ClosureQueue />;
}

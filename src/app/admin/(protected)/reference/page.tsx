import type { Metadata } from "next";
import { requireAdmin } from "@/lib/current-account";
import { ReferenceData } from "./reference-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ReferencePage() {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return <ReferenceData />;
}

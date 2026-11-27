import type { Metadata } from "next";
import { requireAccount } from "@/lib/current-account";
import { ReviewClient } from "./review-client";

export const metadata: Metadata = { title: "Review your listing | EstateAI", robots: { index: false, follow: false } };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { id } = await params;
  // Confirming works with AI off too (values may already be there); only writing a description is an AI feature.
  return <ReviewClient key={id} id={id} admin={result.account.account_type === "admin"} ai={process.env.AI_FEATURES === "1"} />;
}

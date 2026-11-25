import type { Metadata } from "next";
import { requireAccount } from "@/lib/current-account";
import { PreviewClient } from "./preview-client";

// The title never carries the id or any listing content.
export const metadata: Metadata = { title: "Preview | EstateAI", robots: { index: false, follow: false } };

// Dynamic route parameters are a promise in this version of Next.js.
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { id } = await params;
  return <PreviewClient key={id} id={id} admin={result.account.account_type === "admin"} />;
}

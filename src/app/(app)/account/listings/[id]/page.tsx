import type { Metadata } from "next";
import { requireAccount } from "@/lib/current-account";
import { DraftClient } from "./draft-client";

// The title never carries the id or any listing content; it is neutral until the page knows the status (a draft then says "Draft").
export const metadata: Metadata = { title: "Listing | EstateAI", robots: { index: false, follow: false } };

// Dynamic route parameters are a promise in this version of Next.js.
export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { id } = await params;
  return <DraftClient key={id} id={id} admin={result.account.account_type === "admin"} />;
}

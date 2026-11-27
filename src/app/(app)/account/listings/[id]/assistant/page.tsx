import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/current-account";
import { AssistantClient } from "./assistant-client";

export const metadata: Metadata = { title: "Listing assistant | EstateAI", robots: { index: false, follow: false } };

export default async function AssistantPage({ params }: { params: Promise<{ id: string }> }) {
  // Off by default, like every AI entry point.
  if (process.env.AI_FEATURES !== "1") notFound();
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { id } = await params;
  return <AssistantClient key={id} id={id} admin={result.account.account_type === "admin"} />;
}

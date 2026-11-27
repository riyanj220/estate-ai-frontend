import type { Metadata } from "next";
import { ConversationClient } from "./conversation-client";

export const metadata: Metadata = { title: "Conversation | EstateAI", robots: { index: false, follow: false } };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationClient key={id} id={id} />;
}

import type { Metadata } from "next";
import { InboxClient } from "./inbox-client";

export const metadata: Metadata = { title: "Messages | EstateAI", robots: { index: false, follow: false } };

export default function InboxPage() {
  return <InboxClient />;
}

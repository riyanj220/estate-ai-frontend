import type { Metadata } from "next";
import { AdminShell } from "@/app/admin/(protected)/admin-shell";
import { requireAccount } from "@/lib/auth/current-account";
import { NotificationsClient } from "./notifications-client";

// The title never carries a count or any notification content.
export const metadata: Metadata = { title: "Notifications | EstateAI", robots: { index: false, follow: false } };

/** Available to every signed-in account type; an administrator sees it inside the admin chrome (like the password page). */
export default async function NotificationsPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const admin = result.account.account_type === "admin";
  const content = <NotificationsClient admin={admin} />;
  return admin ? <AdminShell embedded>{content}</AdminShell> : content;
}

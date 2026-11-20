import type { Metadata } from "next";
import { requireAdmin } from "@/lib/current-account";
import { AdminShell, AdminUnavailable } from "./admin-shell";

// A neutral default title (no admin wording: the redirect body sent to non-administrators carries it) and noindex.
export const metadata: Metadata = { title: "EstateAI", robots: { index: false, follow: false } };

/**
 * The administrator guard for the whole group: nothing below renders (or fetches) unless the backend confirms an
 * administrator. Layouts are not re-run on client navigation, so every page here calls `requireAdmin()` itself too.
 */
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return <AdminUnavailable />;
  return <AdminShell>{children}</AdminShell>;
}

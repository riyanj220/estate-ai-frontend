import type { Metadata } from "next";
import { requireAccount } from "@/lib/current-account";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPage() {
  // Guarded here as well as in the layout: a layout is not re-run on every client navigation, a page is.
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return (
    <>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p>Admin area placeholder.</p>
    </>
  );
}

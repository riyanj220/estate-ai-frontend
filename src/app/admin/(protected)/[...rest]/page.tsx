import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/current-account";

/**
 * Every unknown path under /admin goes through the same guard: a non-administrator is redirected to the admin sign-in
 * (never shown a 404 that would confirm or deny anything), and an administrator gets the ordinary "not found".
 */
export default async function AdminUnknownPage() {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  notFound();
}

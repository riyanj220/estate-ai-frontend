import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/current-account";
import { ListingReview } from "./listing-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ draft?: string }> }) {
  const result = await requireAdmin();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <ListingReview key={id} listingId={id} draft={query.draft === "1"} />;
}

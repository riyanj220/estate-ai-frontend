import type { Metadata } from "next";
import { canOwnListings } from "@/lib/account";
import { requireAccount } from "@/lib/current-account";
import { FavouritesClient } from "./favourites-client";

export const metadata: Metadata = { title: "Favourites | EstateAI", robots: { index: false, follow: false } };

export default async function FavouritesPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  if (!canOwnListings(result.account.account_type)) {
    return (
      <>
        <h1 className="page-title">Favourites</h1>
        <p className="card" data-testid="favourites-forbidden">
          Favourites are not available for this account.
        </p>
      </>
    );
  }
  return <FavouritesClient />;
}

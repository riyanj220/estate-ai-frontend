import type { Metadata } from "next";
import { canOwnListings } from "@/lib/account";
import { requireAccount } from "@/lib/current-account";
import { LISTINGS_UNAVAILABLE } from "@/lib/listing-messages";
import { CreateListingForm } from "./create-listing-form";
import { CreateWithAi } from "./create-with-ai";

export const metadata: Metadata = { title: "Create listing | EstateAI", robots: { index: false, follow: false } };

export default async function CreateListingPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  // An administrator never owns Listings: the server refuses them, so no form is offered.
  if (!canOwnListings(result.account.account_type)) {
    return (
      <>
        <h1 className="page-title">Create listing</h1>
        <p className="card" data-testid="listings-unavailable">
          {LISTINGS_UNAVAILABLE}
        </p>
      </>
    );
  }
  return (
    <>
      <CreateListingForm />
      {/* Off by default until the assistant exists; read per request (the page is already dynamic). */}
      {process.env.AI_FEATURES === "1" && <CreateWithAi />}
    </>
  );
}

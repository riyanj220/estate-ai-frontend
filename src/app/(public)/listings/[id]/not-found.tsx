import Link from "next/link";
import { LISTING_NOT_FOUND } from "@/lib/listing-messages";

/** One answer for a hidden and an unknown Listing. */
export default function ListingNotFound() {
  return (
    <>
      <h1 className="page-title">Listing not found</h1>
      <p className="card" data-testid="listing-not-found">
        {LISTING_NOT_FOUND}
      </p>
      <p>
        <Link href="/listings" className="text-link">
          Back to browse
        </Link>
      </p>
    </>
  );
}

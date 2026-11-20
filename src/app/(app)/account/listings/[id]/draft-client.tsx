"use client";

import Link from "next/link";
import { getApi } from "@/lib/api";
import { rateLimitMessage, withTimeout } from "@/lib/forms";
import { isListingId, label, readListing, type ListingView } from "@/lib/listing-labels";
import { LISTINGS_PATH, LISTING_NOT_FOUND, signInPathFor } from "@/lib/listing-messages";
import { usePageshowRecheck } from "@/lib/use-pageshow-recheck";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";

const HEADING_ID = "draft-title";
/** What the read answers: the Draft, or "could not find it" (one answer for every cause). */
type Draft = { found: true; listing: ListingView } | { found: false };

/**
 * Loads one of the signed-in account's own Listings and shows what exists so far (read-only: editing arrives with Story
 * 2.2). A 404 is one answer for an unknown id, someone else's Listing, a malformed id and an administrator. Nothing about
 * the Listing is stored or logged.
 */
export function DraftClient({ id, admin }: { id: string; admin: boolean }) {
  const signInPath = signInPathFor(`${LISTINGS_PATH}/${id}`, admin);
  const { load, read, retry } = useResourceLoad<Draft>(
    async (): Promise<ProfileFetch<Draft>> => {
      // Only a canonical id can name a Draft: anything else is "not found" without asking the server.
      if (!isListingId(id)) return { kind: "ready", profile: { found: false } };
      try {
        const api = await getApi();
        const { data, response } = await withTimeout((signal) =>
          api.GET("/api/v1/listings/{listing_id}", { params: { path: { listing_id: id } }, cache: "no-store", signal }),
        );
        if (response.ok) {
          const listing = readListing(data);
          return listing ? { kind: "ready", profile: { found: true, listing } } : { kind: "error" };
        }
        if (response.status === 401) return "gone";
        // One answer for every cause: unknown, someone else's, a malformed id, an administrator, a refusal.
        if ([400, 403, 404, 422].includes(response.status)) return { kind: "ready", profile: { found: false } };
        if (response.status === 429) return { kind: "error", message: rateLimitMessage(response.headers.get("Retry-After")) };
        return { kind: "error" };
      } catch {
        return { kind: "error" };
      }
    },
    HEADING_ID,
    { signInPath, refreshOnFocus: false },
  );
  usePageshowRecheck(signInPath, () => void read(false));

  const heading = (
    <h1 id={HEADING_ID} tabIndex={-1} className="page-title">
      Draft
    </h1>
  );
  const back = (
    <p>
      <Link href={LISTINGS_PATH} className="text-link">
        Back to My listings
      </Link>
    </p>
  );

  if (load.kind !== "ready") {
    return (
      <>
        {heading}
        <ProfileLoadState load={load} onRetry={retry} noun="draft" />
      </>
    );
  }
  if (!load.profile.found) {
    return (
      <>
        {heading}
        <p className="card" data-testid="draft-not-found">
          {LISTING_NOT_FOUND}
        </p>
        {back}
      </>
    );
  }
  const { listing } = load.profile;
  return (
    <>
      {heading}
      <section className="card" aria-labelledby="draft-details-title" style={{ marginBottom: "var(--space)" }}>
        <h2 id="draft-details-title" className="section-title">
          What exists so far
        </h2>
        <dl className="detail-list" data-testid="draft-details">
          <div>
            <dt>Status</dt>
            <dd data-testid="draft-status">{label(listing.status)}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd data-testid="draft-revision">{listing.revision ?? "Not set"}</dd>
          </div>
          <div>
            <dt>Registry version</dt>
            <dd data-testid="draft-registry-version">{listing.registryVersion ?? "Not set"}</dd>
          </div>
          <div>
            <dt>Purpose</dt>
            <dd data-testid="draft-purpose">{label(listing.fields.purpose)}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd data-testid="draft-category">{label(listing.fields.category)}</dd>
          </div>
          <div>
            <dt>Subtype</dt>
            <dd data-testid="draft-subtype">{label(listing.fields.subtype)}</dd>
          </div>
        </dl>
        <p className="muted" data-testid="draft-note">
          The remaining details can be added in later steps. Nothing on this page can be edited yet.
        </p>
      </section>
      {back}
    </>
  );
}

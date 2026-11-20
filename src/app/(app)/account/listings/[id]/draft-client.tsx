"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { rateLimitMessage, withTimeout } from "@/lib/forms";
import { isListingId, readListing, type ListingView } from "@/lib/listing-labels";
import { LISTINGS_PATH, LISTING_NOT_FOUND, signInPathFor } from "@/lib/listing-messages";
import { usePageshowRecheck } from "@/lib/use-pageshow-recheck";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";
import { DraftEditor, type Latest } from "./draft-editor";

const HEADING_ID = "draft-title";
/** What the read answers: the Draft, or "could not find it" (one answer for every cause). */
type Draft = { found: true; listing: ListingView; load: number } | { found: false };

/** Reads one of the signed-in account's own Drafts. Used for the page load and for a conflict answer that carries no data. */
async function fetchDraft(id: string): Promise<ProfileFetch<Draft>> {
  // Only a canonical id can name a Draft: anything else is "not found" without asking the server.
  if (!isListingId(id)) return { kind: "ready", profile: { found: false } };
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) =>
      api.GET("/api/v1/listings/{listing_id}", { params: { path: { listing_id: id } }, cache: "no-store", signal }),
    );
    if (response.ok) {
      const listing = readListing(data);
      return listing ? { kind: "ready", profile: { found: true, listing, load: 0 } } : { kind: "error" };
    }
    if (response.status === 401) return "gone";
    // One answer for every cause: unknown, someone else's, a malformed id, an administrator, a refusal.
    if ([400, 403, 404, 422].includes(response.status)) return { kind: "ready", profile: { found: false } };
    if (response.status === 429) return { kind: "error", message: rateLimitMessage(response.headers.get("Retry-After")) };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Loads one of the signed-in account's own Listings and hands it to the editor (`DraftEditor`). A 404 (also from a save) is
 * one answer for an unknown id, someone else's Listing, a malformed id and an administrator. Nothing about the Listing is
 * stored or logged.
 */
export function DraftClient({ id, admin }: { id: string; admin: boolean }) {
  const signInPath = signInPathFor(`${LISTINGS_PATH}/${id}`, admin);
  const [missing, setMissing] = useState(false);
  // Every read of the Draft numbers itself, so the editor (keyed by it) starts again from what the server says now whenever the
  // page is read again, for example after a restore from the back-forward cache. Nothing typed is kept.
  const reads = useRef(0);
  const { load, read, retry, sessionGone } = useResourceLoad<Draft>(
    async () => {
      const answer = await fetchDraft(id);
      if (answer === "gone" || answer.kind !== "ready" || !answer.profile.found) return answer;
      return { kind: "ready", profile: { ...answer.profile, load: ++reads.current } };
    },
    HEADING_ID,
    { signInPath, refreshOnFocus: false },
  );
  usePageshowRecheck(signInPath, () => {
    setMissing(false);
    void read(false);
  });

  async function fetchLatest(): Promise<Latest> {
    const answer = await fetchDraft(id);
    if (answer === "gone") return { kind: "gone" };
    if (answer.kind !== "ready") return { kind: "error" };
    return answer.profile.found ? { kind: "found", listing: answer.profile.listing } : { kind: "missing" };
  }

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
  if (missing || !load.profile.found) {
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
  return (
    <>
      {heading}
      <DraftEditor
        key={`${load.profile.listing.id}-${load.profile.load}`}
        initial={load.profile.listing}
        signInPath={signInPath}
        onSessionGone={sessionGone}
        onNotFound={() => setMissing(true)}
        fetchLatest={fetchLatest}
      />
      {back}
    </>
  );
}

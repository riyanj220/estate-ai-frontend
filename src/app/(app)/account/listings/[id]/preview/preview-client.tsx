"use client";

import Link from "next/link";
import { EstimateFigure } from "@/components/listing/estimate-figure";
import { FloorPlanView } from "@/components/listing/floor-plan-view";
import { ListingFacts } from "@/components/listing/listing-facts";
import { RetryImage } from "@/components/ui/retry-image";
import { getApi } from "@/lib/http/api";
import { readValue } from "@/lib/listing/estimate";
import { rateLimitMessage, withTimeout } from "@/lib/forms/forms";
import { isListingId, summaryOf, type ListingView } from "@/lib/listing/listing-labels";
import { readPreview } from "@/lib/listing/listing-preview";
import {
  ESTIMATE_NOT_AVAILABLE,
  ESTIMATE_TITLE,
  LISTINGS_PATH,
  LISTING_NOT_FOUND,
  PREVIEW_BANNER,
  PREVIEW_DETAILS_FAILED,
  PREVIEW_NO_IMAGES,
  signInPathFor,
} from "@/lib/listing/listing-messages";
import { usePageshowRecheck } from "@/lib/auth/use-pageshow-recheck";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/account/use-profile-load";
import { useAmenityCatalogue, useLocationLists } from "@/lib/reference/use-reference";
import { useRegistry } from "@/lib/listing/use-registry";

const HEADING_ID = "preview-title";
type Preview = { found: true; listing: ListingView; estimate: string | null } | { found: false };

/** Reads the owner's preview of a Listing. One "not found" answer for every cause, like the Draft page. */
async function fetchPreview(id: string): Promise<ProfileFetch<Preview>> {
  if (!isListingId(id)) return { kind: "ready", profile: { found: false } };
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) =>
      api.GET("/api/v1/listings/{listing_id}/preview", { params: { path: { listing_id: id } }, cache: "no-store", signal }),
    );
    if (response.ok) {
      const listing = readPreview(data, id);
      return listing ? { kind: "ready", profile: { found: true, listing, estimate: readValue(data?.estimate) } } : { kind: "error" };
    }
    if (response.status === 401) return "gone";
    if ([400, 403, 404, 422].includes(response.status)) return { kind: "ready", profile: { found: false } };
    if (response.status === 429) return { kind: "error", message: rateLimitMessage(response.headers.get("Retry-After")) };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** The page of a Listing's public projection as its owner sees it before anyone else can. Nothing about it is stored or logged. */
export function PreviewClient({ id, admin }: { id: string; admin: boolean }) {
  const draftPath = `${LISTINGS_PATH}/${encodeURIComponent(id)}`;
  const signInPath = signInPathFor(`${draftPath}/preview`, admin);
  const { load, read, retry } = useResourceLoad<Preview>(() => fetchPreview(id), HEADING_ID, { signInPath, refreshOnFocus: false });
  usePageshowRecheck(signInPath, () => void read(false));

  const heading = (
    <h1 id={HEADING_ID} tabIndex={-1} className="page-title">
      Preview
    </h1>
  );
  const links = (
    <p>
      <Link href={isListingId(id) ? draftPath : LISTINGS_PATH} className="text-link" data-testid="preview-back">
        {isListingId(id) ? "Back to the draft" : "Back to My listings"}
      </Link>
    </p>
  );
  if (load.kind !== "ready") {
    return (
      <>
        {heading}
        <ProfileLoadState load={load} onRetry={retry} noun="preview" />
        {links}
      </>
    );
  }
  if (!load.profile.found) {
    return (
      <>
        {heading}
        <p className="card" data-testid="preview-not-found">
          {LISTING_NOT_FOUND}
        </p>
        <p>
          <Link href={LISTINGS_PATH} className="text-link">
            Back to My listings
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      {heading}
      <PreviewBody listing={load.profile.listing} estimate={load.profile.estimate} signInPath={signInPath} />
      {links}
    </>
  );
}

function PreviewBody({ listing, estimate, signInPath }: { listing: ListingView; estimate: string | null; signInPath: string }) {
  const { status, registry, retry, retrying } = useRegistry(signInPath);
  const cityId = listing.details.city ?? "";
  const lists = useLocationLists(cityId, cityId !== "");
  const amenityText = listing.details.amenities ?? "";
  const catalogue = useAmenityCatalogue(amenityText !== "");
  const { fields } = listing;
  const cityName = cityId ? lists.nameOf("city", cityId) : null;
  const localityId = listing.details.locality ?? "";
  const localityName = localityId ? lists.nameOf("locality", localityId) : null;

  return (
    <>
      <p className="notice preview-banner font-bold" data-testid="preview-banner">
        {PREVIEW_BANNER}
      </p>
      <article className="card" aria-labelledby="preview-listing-title" style={{ marginBottom: "var(--space)" }} data-testid="preview-listing">
        <h2 id="preview-listing-title" className="section-title" data-testid="preview-title-text">
          {fields.title ?? "Untitled listing"}
        </h2>
        <p className="muted" data-testid="preview-summary">
          {summaryOf(fields)}
        </p>
        {listing.media.length === 0 ? (
          <p className="muted" data-testid="preview-no-images">
            {PREVIEW_NO_IMAGES}
          </p>
        ) : (
          <ul className="list-none p-0 mt-0 mx-0 mb-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-4" aria-label="Images" data-testid="preview-images">
            {listing.media.map((item, index) => (
              <li key={item.id}>
                <RetryImage
                  url={item.url}
                  alt={`Image ${index + 1} of ${listing.media.length}${item.isCover ? ", cover image" : ""}`}
                  label={`image ${index + 1}`}
                  className="image-thumb"
                  failedClassName="image-thumb image-failed"
                />
              </li>
            ))}
          </ul>
        )}
        {listing.floorPlan && <FloorPlanView url={listing.floorPlan.url} testId="preview-floor-plan" />}
        <ListingFacts
          listing={listing}
          registry={registry}
          catalogue={catalogue}
          cityName={cityName}
          localityName={localityName}
          testId="preview"
        />
        {status === "error" && (
          <p className="state-note" data-testid="preview-details-failed">
            {PREVIEW_DETAILS_FAILED}{" "}
            <button type="button" className="secondary-button" aria-disabled={retrying ? true : undefined} onClick={retry}>
              Retry
            </button>
          </p>
        )}
        {fields.description !== null && (
          <section aria-labelledby="preview-description-title">
            <h3 id="preview-description-title" className="section-title">
              Description
            </h3>
            <p style={{ whiteSpace: "pre-line" }} data-testid="preview-description">
              {fields.description}
            </p>
          </section>
        )}
        <section aria-labelledby="preview-estimate-title">
          <h3 id="preview-estimate-title" className="section-title">
            Estimate
          </h3>
          {estimate === null ? (
            <p data-testid="preview-estimate">{ESTIMATE_NOT_AVAILABLE}</p>
          ) : (
            <>
              <p className="muted">{ESTIMATE_TITLE}</p>
              <EstimateFigure value={estimate} testId="preview-estimate" />
            </>
          )}
        </section>
      </article>
    </>
  );
}

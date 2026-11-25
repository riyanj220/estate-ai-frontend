"use client";

import Link from "next/link";
import { RetryImage } from "@/components/retry-image";
import { KIND_ORDER, KIND_TITLES, STATE_TEXT, amenityLabel, answeredOfKind, decodeAmenities, otherCodes } from "@/lib/amenities";
import { getApi } from "@/lib/api";
import { rateLimitMessage, withTimeout } from "@/lib/forms";
import { SELLER_DECLARED, answeredDetails, shownDetails } from "@/lib/listing-details";
import { NOT_SET, areaSummary, derivedText, formatPrice, isListingId, label, summaryOf, type ListingView } from "@/lib/listing-labels";
import { PUBLIC_LOCATION_TEXT, readPreview } from "@/lib/listing-preview";
import {
  ESTIMATE_NOT_AVAILABLE,
  LISTINGS_PATH,
  LISTING_NOT_FOUND,
  PREVIEW_BANNER,
  PREVIEW_DETAILS_FAILED,
  PREVIEW_NO_IMAGES,
  signInPathFor,
} from "@/lib/listing-messages";
import { usePageshowRecheck } from "@/lib/use-pageshow-recheck";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";
import { useAmenityCatalogue, useLocationLists } from "@/lib/use-reference";
import { useRegistry } from "@/lib/use-registry";

const HEADING_ID = "preview-title";
type Preview = { found: true; listing: ListingView } | { found: false };

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
      return listing ? { kind: "ready", profile: { found: true, listing } } : { kind: "error" };
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
      <PreviewBody listing={load.profile.listing} signInPath={signInPath} />
      {links}
    </>
  );
}

function PreviewBody({ listing, signInPath }: { listing: ListingView; signInPath: string }) {
  const { status, registry, retry, retrying } = useRegistry(signInPath);
  const cityId = listing.details.city ?? "";
  const lists = useLocationLists(cityId, cityId !== "");
  const amenityText = listing.details.amenities ?? "";
  const catalogue = useAmenityCatalogue(amenityText !== "");
  const { fields } = listing;
  const price = fields.asking_price === null ? NOT_SET : `PKR ${formatPrice(fields.asking_price)}`;
  const priceExtra = [fields.price_basis, fields.rental_period].filter((value): value is string => value !== null).map(label).join(" · ");
  const derived = derivedText(fields);
  const details = registry ? answeredDetails(shownDetails(registry, listing), listing) : [];
  const cityName = cityId ? lists.nameOf("city", cityId) : null;
  const localityId = listing.details.locality ?? "";
  const localityName = localityId ? lists.nameOf("locality", localityId) : null;
  const location: { id: string; label: string; text: string }[] = [
    ...(cityName ? [{ id: "city", label: "City", text: cityName }] : []),
    ...(localityName ? [{ id: "locality", label: "Locality", text: localityName }] : []),
    ...PUBLIC_LOCATION_TEXT.filter((key) => listing.details[key]).map((key) => ({ id: key, label: label(key), text: listing.details[key] })),
  ];
  const states = (codes: string[], map: Record<string, string>) =>
    (["present", "none"] as const)
      .map((state) => {
        const names = codes.filter((code) => map[code] === state).map((code) => amenityLabel(code, catalogue.items));
        return names.length > 0 ? `${STATE_TEXT[state]}: ${names.join(", ")}.` : "";
      })
      .filter(Boolean)
      .join(" ");

  return (
    <>
      <p className="notice preview-banner" data-testid="preview-banner">
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
          <ul className="preview-gallery" aria-label="Images" data-testid="preview-images">
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
        <dl className="detail-list" data-testid="preview-facts">
          <div>
            <dt>Asking price</dt>
            <dd data-testid="preview-price">
              {price}
              {priceExtra && ` (${priceExtra})`}
            </dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd data-testid="preview-area">
              {areaSummary(fields)}
              {derived && ` — ${derived}`}
            </dd>
          </div>
          {location.map((item) => (
            <div key={item.id}>
              <dt>{item.label}</dt>
              <dd data-testid={`preview-location-${item.id}`}>{item.text}</dd>
            </div>
          ))}
          {details.map((item) => (
            <div key={item.id}>
              <dt>{item.label}</dt>
              <dd data-testid={`preview-detail-${item.id}`}>
                {item.text}
                {item.sellerDeclared && (
                  <>
                    <span className="sr-only">. </span>
                    <span className="declared-tag declared-tag-inline">{SELLER_DECLARED}</span>
                  </>
                )}
              </dd>
            </div>
          ))}
          {amenityText !== "" &&
            (catalogue.status === "ready" ? (
              <>
                {KIND_ORDER.map((kind) => {
                  const codes = answeredOfKind(amenityText, catalogue.items, kind).map((item) => item.code);
                  if (codes.length === 0) return null;
                  return (
                    <div key={kind}>
                      <dt>{KIND_TITLES[kind]}</dt>
                      <dd data-testid={`preview-amenities-${kind}`}>
                        {states(codes, decodeAmenities(amenityText))}
                        {kind === "nearby" && (
                          <>
                            <span className="sr-only">. </span>
                            <span className="declared-tag declared-tag-inline">{SELLER_DECLARED}</span>
                          </>
                        )}
                      </dd>
                    </div>
                  );
                })}
                {otherCodes(amenityText, catalogue.items).length > 0 && (
                  <div>
                    <dt>Other amenities</dt>
                    <dd data-testid="preview-amenities-other">{states(otherCodes(amenityText, catalogue.items), decodeAmenities(amenityText))}</dd>
                  </div>
                )}
              </>
            ) : (
              <div>
                <dt>Amenities</dt>
                <dd>{catalogue.status === "loading" || catalogue.status === "idle" ? "Loading the amenities…" : "The amenities are not available right now."}</dd>
              </div>
            ))}
        </dl>
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
          <p data-testid="preview-estimate">{ESTIMATE_NOT_AVAILABLE}</p>
        </section>
      </article>
    </>
  );
}

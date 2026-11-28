import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdvertiserLine } from "@/components/advertiser-line";
import { ListingEstimatePanel } from "@/components/listing-estimate";
import { FloorPlanView } from "@/components/floor-plan-view";
import { ListingFacts, priceText } from "@/components/listing-facts";
import { MessageSeller } from "@/components/message-seller";
import { ReportListing } from "@/components/report-listing";
import { RetryImage } from "@/components/retry-image";
import { SaveButton } from "@/components/save-button";
import { ViewBeacon } from "@/components/view-beacon";
import type { AmenityCatalogueList } from "@/lib/amenities";
import { FavouritesProvider } from "@/lib/favourites";
import { summaryOf } from "@/lib/listing-labels";
import { PREVIEW_DETAILS_FAILED, PREVIEW_NO_IMAGES } from "@/lib/listing-messages";
import { BROWSE_PATH, fetchDetail, fetchListingEstimate, fetchPublicAmenities, fetchPublicRegistry, publishedText } from "@/lib/public-listings";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await fetchDetail((await params).id);
  const title = result.kind === "ok" ? (result.listing.fields.title ?? "Untitled listing") : "Listing";
  return { title: `${title} | EstateAI` };
}

/** One public Listing (Story 3.1), rendered on the server from the public projection only. */
export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const result = await fetchDetail(id);
  if (result.kind === "not_found") notFound();
  const back = (
    <p>
      <Link href={BROWSE_PATH} className="text-link">
        Back to browse
      </Link>
    </p>
  );
  if (result.kind === "error") {
    return (
      <>
        <h1 className="page-title">Listing</h1>
        <div className="card" data-testid="listing-error">
          <p>We could not load this listing right now.</p>
          <p>
            <a href={`${BROWSE_PATH}/${encodeURIComponent(id)}`} className="text-link">
              Try again
            </a>
          </p>
        </div>
        {back}
      </>
    );
  }
  const { listing, publishedOn } = result;
  const { fields, media } = listing;
  const place = [result.localityName, result.cityName].filter(Boolean).join(", ");
  const [insight, registry, catalogue] = await Promise.all([
    fetchListingEstimate(listing.id),
    fetchPublicRegistry(),
    listing.details.amenities ? fetchPublicAmenities() : ({ status: "idle", items: [] } satisfies AmenityCatalogueList),
  ]);
  return (
    <>
      {back}
      <ViewBeacon listingId={listing.id} />
      <article className="detail">
        <header className="detail-head">
          <h1 className="page-title">{fields.title ?? "Untitled listing"}</h1>
          {place && <p className="detail-place">{place}</p>}
          <p className="muted" data-testid="listing-summary">
            {summaryOf(fields)}
            {publishedOn && (
              <>
                {" · Published "}
                <time dateTime={publishedOn}>{publishedText(publishedOn)}</time>
              </>
            )}
          </p>
        </header>
        {media.length === 0 ? (
          <p className="detail-no-images">{PREVIEW_NO_IMAGES}</p>
        ) : (
          <ul className="preview-gallery detail-gallery" aria-label="Images" data-testid="listing-images">
            {media.map((item, index) => (
              <li key={item.id}>
                <RetryImage
                  url={item.url}
                  alt={`Image ${index + 1} of ${media.length}${item.isCover ? ", cover image" : ""}`}
                  label={`image ${index + 1}`}
                  className="image-thumb"
                  failedClassName="image-thumb image-failed"
                />
              </li>
            ))}
          </ul>
        )}
        <div className="detail-columns">
          {/* First in the document so a phone shows the price and the actions before the long details. */}
          <div className="detail-side">
            <div className="card">
              <p className="detail-price" data-testid="listing-headline-price">
                {priceText(fields)}
              </p>
              {result.advertiser && <AdvertiserLine advertiser={result.advertiser} testId="listing-advertiser" />}
              <div className="detail-actions">
                <MessageSeller listingId={listing.id} />
                <FavouritesProvider>
                  <SaveButton listingId={listing.id} title={fields.title ?? "Untitled listing"} />
                </FavouritesProvider>
                <ReportListing listingId={listing.id} />
              </div>
            </div>
          </div>
          <div className="detail-main">
            {fields.description !== null && (
              <section className="card" aria-labelledby="listing-description-title">
                <h2 id="listing-description-title" className="section-title">
                  Description
                </h2>
                <p style={{ whiteSpace: "pre-line" }} data-testid="listing-description">
                  {fields.description}
                </p>
              </section>
            )}
            <section className="card" aria-labelledby="listing-details-title">
              <h2 id="listing-details-title" className="section-title">
                Property details
              </h2>
              <ListingFacts listing={listing} registry={registry} catalogue={catalogue} cityName={result.cityName} localityName={result.localityName} testId="listing" />
              {registry === null && <p className="state-note">{PREVIEW_DETAILS_FAILED}</p>}
            </section>
            <div className="card">
              <ListingEstimatePanel listingId={listing.id} initial={insight} />
            </div>
            {listing.floorPlan && (
              <div className="card">
                <FloorPlanView url={listing.floorPlan.url} testId="listing-floor-plan" />
              </div>
            )}
          </div>
        </div>
      </article>
    </>
  );
}

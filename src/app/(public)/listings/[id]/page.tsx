import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdvertiserLine } from "@/components/advertiser-line";
import { ListingEstimatePanel } from "@/components/listing-estimate";
import { ListingFacts } from "@/components/listing-facts";
import { MessageSeller } from "@/components/message-seller";
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
  const [insight, registry, catalogue] = await Promise.all([
    fetchListingEstimate(listing.id),
    fetchPublicRegistry(),
    listing.details.amenities ? fetchPublicAmenities() : ({ status: "idle", items: [] } satisfies AmenityCatalogueList),
  ]);
  return (
    <>
      {back}
      <ViewBeacon listingId={listing.id} />
      <article className="card">
        <h1 className="page-title">{fields.title ?? "Untitled listing"}</h1>
        <p className="muted" data-testid="listing-summary">
          {summaryOf(fields)}
          {publishedOn && (
            <>
              {" · Published "}
              <time dateTime={publishedOn}>{publishedText(publishedOn)}</time>
            </>
          )}
        </p>
        {result.advertiser && <AdvertiserLine advertiser={result.advertiser} testId="listing-advertiser" />}
        <FavouritesProvider>
          <SaveButton listingId={listing.id} title={fields.title ?? "Untitled listing"} />
        </FavouritesProvider>
        <MessageSeller listingId={listing.id} />
        {media.length === 0 ? (
          <p className="muted">{PREVIEW_NO_IMAGES}</p>
        ) : (
          <ul className="preview-gallery" aria-label="Images" data-testid="listing-images">
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
        <ListingEstimatePanel listingId={listing.id} initial={insight} />
        <ListingFacts listing={listing} registry={registry} catalogue={catalogue} cityName={result.cityName} localityName={result.localityName} testId="listing" />
        {registry === null && <p className="state-note">{PREVIEW_DETAILS_FAILED}</p>}
        {fields.description !== null && (
          <section aria-labelledby="listing-description-title">
            <h2 id="listing-description-title" className="section-title">
              Description
            </h2>
            <p style={{ whiteSpace: "pre-line" }} data-testid="listing-description">
              {fields.description}
            </p>
          </section>
        )}
      </article>
    </>
  );
}

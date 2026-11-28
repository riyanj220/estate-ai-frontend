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

/** The photo mosaic: the first photo is large, and the others fill the grid so that few photos leave no holes. */
function galleryCell(index: number, count: number): string {
  if (count === 1) return "col-span-full";
  if (count === 2) return "col-span-2";
  if (index === 0) return "col-span-2 row-span-2";
  return count === 3 || (count === 4 && index === 3) ? "col-span-2" : "";
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
        <header className="mb-6">
          <h1 className="page-title mb-1 text-[clamp(1.875rem,4vw,2.875rem)] tracking-[-0.02em]">{fields.title ?? "Untitled listing"}</h1>
          {place && <p className="text-muted text-[1.0625rem]">{place}</p>}
          <p className="muted m-0 text-[0.875rem]" data-testid="listing-summary">
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
          <p className="bg-sand rounded-2xl py-12 px-6 text-center text-muted mb-8">{PREVIEW_NO_IMAGES}</p>
        ) : (
          <ul className="mx-0 mt-0 mb-8 grid list-none grid-cols-4 gap-2.5 p-0 max-[641px]:grid-cols-2" aria-label="Images" data-testid="listing-images">
            {media.map((item, index) => (
              <li key={item.id} className={`overflow-hidden rounded-[0.875rem] ${galleryCell(index, media.length)}`}>
                <RetryImage
                  url={item.url}
                  alt={`Image ${index + 1} of ${media.length}${item.isCover ? ", cover image" : ""}`}
                  label={`image ${index + 1}`}
                  className={`image-thumb h-full w-full rounded-none ${media.length === 1 ? "aspect-[21/9]" : "aspect-4/3"}`}
                  failedClassName="image-thumb image-failed h-full w-full rounded-none"
                />
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_21rem] gap-x-8 gap-y-6 items-start max-[901px]:grid-cols-[minmax(0,1fr)]">
          {/* First in the document so a phone shows the price and the actions before the long details. */}
          <div className="[grid-column:2] [grid-row:1] sticky top-24 min-w-0 max-[901px]:[grid-column:1] max-[901px]:static">
            <div className="card">
              <p className="font-serif text-[1.625rem] font-semibold text-accent wrap-anywhere mb-3" data-testid="listing-headline-price">
                {priceText(fields)}
              </p>
              {result.advertiser && <AdvertiserLine advertiser={result.advertiser} testId="listing-advertiser" />}
              <div className="mt-4 grid gap-2.5 [&_.save-control]:m-0 [&_.save-control>button]:w-full">
                <MessageSeller listingId={listing.id} />
                <FavouritesProvider>
                  <SaveButton listingId={listing.id} title={fields.title ?? "Untitled listing"} />
                </FavouritesProvider>
                <ReportListing listingId={listing.id} />
              </div>
            </div>
          </div>
          <div className="[grid-column:1] [grid-row:1] grid gap-6 min-w-0 max-[901px]:[grid-row:2]">
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

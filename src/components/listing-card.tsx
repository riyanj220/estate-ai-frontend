import Link from "next/link";
import { AdvertiserLine } from "@/components/advertiser-line";
import { priceParts } from "@/components/listing-facts";
import { RetryImage } from "@/components/retry-image";
import { NOT_SET, areaSummary, summaryOf } from "@/lib/listing-labels";
import { BROWSE_PATH, publishedText, type PublicCard } from "@/lib/public-listings";

const COVER = "block aspect-4/3 w-full rounded-none object-cover";
// Every part of a card has a fixed height, so the same facts sit level across a row.
const DETAIL = "min-h-[1.4em] text-[0.8125rem] leading-[1.4] text-muted";

/** One public Listing as a card (browse and favourites). `children` are the card's actions. */
export function ListingCard({ card, children, testId = "browse-card" }: { card: PublicCard; children?: React.ReactNode; testId?: string }) {
  const { listing, coverUrl, publishedOn } = card;
  const { fields, details } = listing;
  const title = fields.title ?? "Untitled listing";
  const place = [card.localityName, card.cityName].filter(Boolean).join(", ");
  const rooms = [details.bedrooms && `Bedrooms: ${details.bedrooms}`, details.bathrooms && `Bathrooms: ${details.bathrooms}`].filter(Boolean).join(" · ");
  const area = areaSummary(fields);
  const price = priceParts(fields);
  return (
    <li className="card" data-testid={testId}>
      <div className="relative order-0 mx-0 mt-0 mb-4">
        {coverUrl ? (
          <RetryImage url={coverUrl} alt={`Cover image of ${title}`} label={`the cover of ${title}`} className={`image-thumb ${COVER}`} failedClassName={`image-thumb image-failed ${COVER}`} />
        ) : (
          <div className={`image-thumb flex items-center justify-center bg-sand text-muted ${COVER}`}>No image</div>
        )}
        {(fields.purpose === "sale" || fields.purpose === "rent") && (
          <span className="absolute top-3.5 left-3.5 rounded-full bg-white/94 px-3 py-1 text-[0.75rem] font-bold" aria-hidden="true">
            For {fields.purpose}
          </span>
        )}
      </div>
      <h2 className="order-2 mt-2 mb-1 line-clamp-2 h-12 text-[1rem] leading-6 font-semibold text-wrap">
        <Link href={`${BROWSE_PATH}/${listing.id}`} className="text-link text-text no-underline hover:underline focus-visible:-outline-offset-2">
          {title}
        </Link>
      </h2>
      <p className="order-1 min-h-13 font-serif text-[1.3125rem] leading-[1.3] font-semibold text-accent">
        {price.amount} <span className="block font-sans text-[0.8125rem] font-medium text-muted">{price.basis}</span>
      </p>
      <p className={DETAIL}>{summaryOf(fields)}</p>
      {/* Always present, empty or not, so the cards of a row line up. */}
      <p className={`mt-1 ${DETAIL}`}>{area !== NOT_SET ? area : ""}</p>
      <p className="order-4 mt-3.5 min-h-9 border-t border-line pt-3.5 text-[0.875rem] font-semibold">{rooms}</p>
      <p className="order-3 min-h-[1.4rem] truncate text-[0.875rem] leading-[1.4rem] text-muted">{place}</p>
      {card.advertiser && <AdvertiserLine advertiser={card.advertiser} testId="browse-advertiser" />}
      {publishedOn && (
        <p className="hint">
          Published <time dateTime={publishedOn}>{publishedText(publishedOn)}</time>
        </p>
      )}
      {children}
    </li>
  );
}

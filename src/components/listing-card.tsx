import Link from "next/link";
import { AdvertiserLine } from "@/components/advertiser-line";
import { priceText } from "@/components/listing-facts";
import { RetryImage } from "@/components/retry-image";
import { NOT_SET, areaSummary, summaryOf } from "@/lib/listing-labels";
import { BROWSE_PATH, publishedText, type PublicCard } from "@/lib/public-listings";

/** One public Listing as a card (browse and favourites). `children` are the card's actions. */
export function ListingCard({ card, children, testId = "browse-card" }: { card: PublicCard; children?: React.ReactNode; testId?: string }) {
  const { listing, coverUrl, publishedOn } = card;
  const { fields, details } = listing;
  const title = fields.title ?? "Untitled listing";
  const place = [card.localityName, card.cityName].filter(Boolean).join(", ");
  const rooms = [details.bedrooms && `Bedrooms: ${details.bedrooms}`, details.bathrooms && `Bathrooms: ${details.bathrooms}`].filter(Boolean).join(" · ");
  const area = areaSummary(fields);
  return (
    <li className="card" data-testid={testId}>
      <div className="card-media">
        {coverUrl ? (
          <RetryImage url={coverUrl} alt={`Cover image of ${title}`} label={`the cover of ${title}`} className="image-thumb" failedClassName="image-thumb image-failed" />
        ) : (
          <div className="image-thumb browse-no-image">No image</div>
        )}
        {(fields.purpose === "sale" || fields.purpose === "rent") && (
          <span className="card-badge" aria-hidden="true">
            For {fields.purpose}
          </span>
        )}
      </div>
      <h2 className="browse-title">
        <Link href={`${BROWSE_PATH}/${listing.id}`} className="text-link">
          {title}
        </Link>
      </h2>
      <p className="browse-price">{priceText(fields)}</p>
      <p className="card-summary">{summaryOf(fields)}</p>
      {area !== NOT_SET && <p className="card-area">{area}</p>}
      {rooms && <p className="card-rooms">{rooms}</p>}
      {place && <p className="card-place">{place}</p>}
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

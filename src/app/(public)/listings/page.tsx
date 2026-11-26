import type { Metadata } from "next";
import Link from "next/link";
import { priceText } from "@/components/listing-facts";
import { RetryImage } from "@/components/retry-image";
import { NOT_SET, areaSummary, summaryOf } from "@/lib/listing-labels";
import { BROWSE_PATH, fetchBrowse, publishedText, type PublicCard } from "@/lib/public-listings";

export const metadata: Metadata = { title: "Browse listings | EstateAI" };

const one = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);

/** The public marketplace (Story 3.1), rendered on the server; paging is plain links, so it works without JavaScript. */
export default async function BrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = Object.fromEntries(
    (["sort", "limit", "cursor"] as const).flatMap((key) => {
      const value = one(params[key]);
      return value ? [[key, value]] : [];
    }),
  );
  const result = await fetchBrowse(query);
  const href = (changes: Record<string, string>) => {
    const search = new URLSearchParams({ ...query, ...changes }).toString();
    return search ? `${BROWSE_PATH}?${search}` : BROWSE_PATH;
  };

  return (
    <>
      <h1 className="page-title">Browse listings</h1>
      {result.kind === "error" && (
        <div className="card" data-testid="browse-error">
          <p>We could not load the listings right now.</p>
          {/* A full navigation, so the server reads again. */}
          <p>
            <a href={href({})} className="text-link">
              Try again
            </a>
          </p>
        </div>
      )}
      {result.kind === "bad_request" && (
        <div className="card" data-testid="browse-bad-page">
          <p>That page link is not valid.</p>
          <p>
            <Link href={BROWSE_PATH} className="text-link">
              Go to the newest listings
            </Link>
          </p>
        </div>
      )}
      {result.kind === "ok" && (
        <>
          {result.cards.length === 0 ? (
            <p className="card" data-testid="browse-empty">
              There are no listings to show yet.
            </p>
          ) : (
            <ul className="browse-grid" aria-label="Listings">
              {result.cards.map((card) => (
                <Card key={card.listing.id} card={card} />
              ))}
            </ul>
          )}
          <p className="browse-pages">
            {query.cursor && (
              <Link href={BROWSE_PATH} className="text-link">
                Back to the newest
              </Link>
            )}
            {result.nextCursor && (
              <Link href={href({ cursor: result.nextCursor })} className="text-link" data-testid="browse-next">
                Next page
              </Link>
            )}
          </p>
        </>
      )}
    </>
  );
}

function Card({ card }: { card: PublicCard }) {
  const { listing, coverUrl, publishedOn } = card;
  const { fields, details } = listing;
  const title = fields.title ?? "Untitled listing";
  const place = [card.localityName, card.cityName].filter(Boolean).join(", ");
  const rooms = [details.bedrooms && `Bedrooms: ${details.bedrooms}`, details.bathrooms && `Bathrooms: ${details.bathrooms}`].filter(Boolean).join(" · ");
  const area = areaSummary(fields);
  return (
    <li className="card" data-testid="browse-card">
      {coverUrl ? (
        <RetryImage url={coverUrl} alt={`Cover image of ${title}`} label={`the cover of ${title}`} className="image-thumb" failedClassName="image-thumb image-failed" />
      ) : (
        <div className="image-thumb browse-no-image">No image</div>
      )}
      <h2 className="browse-title">
        <Link href={`${BROWSE_PATH}/${listing.id}`} className="text-link">
          {title}
        </Link>
      </h2>
      <p className="browse-price">{priceText(fields)}</p>
      <p>{summaryOf(fields)}</p>
      {area !== NOT_SET && <p>{area}</p>}
      {rooms && <p>{rooms}</p>}
      {place && <p>{place}</p>}
      {publishedOn && (
        <p className="hint">
          Published <time dateTime={publishedOn}>{publishedText(publishedOn)}</time>
        </p>
      )}
    </li>
  );
}

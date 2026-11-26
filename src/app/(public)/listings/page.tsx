import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilterPanel } from "@/components/filter-panel";
import { ListingCard } from "@/components/listing-card";
import { SaveButton } from "@/components/save-button";
import { FavouritesProvider } from "@/lib/favourites";
import { browseHref, canonicalQuery, parameterTitle, valuesOf, without } from "@/lib/listing-filters";
import { BROWSE_PATH, fetchBrowse, fetchFilterSchema, fetchPlaces } from "@/lib/public-listings";

export const metadata: Metadata = { title: "Browse listings | EstateAI" };

/**
 * The public marketplace (Stories 3.1 and 3.5), rendered on the server: filtering, sorting and paging are a GET form and plain links, so
 * they work without JavaScript.
 */
export default async function BrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { query, changed } = canonicalQuery(await searchParams);
  if (changed) redirect(browseHref(BROWSE_PATH, query));
  const [result, schema, places] = await Promise.all([fetchBrowse(query), fetchFilterSchema(), fetchPlaces(valuesOf(query, "city"))]);
  const href = (search: URLSearchParams) => browseHref(BROWSE_PATH, search);
  const firstPage = without(query, "cursor");
  const narrowed = [...firstPage.keys()].some((name) => name !== "sort" && name !== "limit");
  const problems = result.kind === "bad_request" ? result.problems : {};
  // A refused cursor alone is a bad page link; any other refused parameter is a bad filter.
  const refused = Object.keys(problems).filter((name) => name !== "cursor");

  return (
    <>
      <h1 className="page-title">Browse listings</h1>
      {schema ? (
        <FilterPanel path={BROWSE_PATH} schema={schema} places={places} query={firstPage} problems={problems} />
      ) : (
        <p className="card filter-form" data-testid="filters-unavailable">
          The filters are not available right now.{" "}
          <a href={href(query)} className="text-link">
            Reload
          </a>
          {narrowed && (
            <>
              {" "}
              <Link href={BROWSE_PATH} className="text-link">
                Clear all filters
              </Link>
            </>
          )}
        </p>
      )}
      {result.kind === "error" && (
        <div className="card" data-testid="browse-error">
          <p>We could not load the listings right now.</p>
          {/* A full navigation, so the server reads again. */}
          <p>
            <a href={href(query)} className="text-link">
              Try again
            </a>
          </p>
        </div>
      )}
      {result.kind === "bad_request" &&
        (refused.length > 0 ? (
          <div className="notice" role="alert" data-testid="browse-bad-filters">
            <p>Some filters could not be used.</p>
            <ul>
              {refused.map((name) => (
                <li key={name}>
                  {parameterTitle(name, schema)}: {problems[name]}{" "}
                  <Link href={href(without(query, name))} className="text-link">
                    Remove<span className="sr-only"> {parameterTitle(name, schema)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p>
              <Link href={BROWSE_PATH} className="text-link">
                Show all listings
              </Link>
            </p>
          </div>
        ) : (
          <div className="card" data-testid="browse-bad-page">
            <p>That page link is not valid.</p>
            <p>
              <Link href={href(firstPage)} className="text-link">
                Go to the first page
              </Link>
            </p>
          </div>
        ))}
      {result.kind === "ok" && (
        <>
          {result.cards.length === 0 ? (
            <p className="card" data-testid="browse-empty">
              {narrowed ? (
                <>
                  No listings match these filters.{" "}
                  <Link href={BROWSE_PATH} className="text-link">
                    Show all listings
                  </Link>
                </>
              ) : (
                "There are no listings to show yet."
              )}
            </p>
          ) : (
            <FavouritesProvider>
              <ul className="browse-grid" aria-label="Listings">
                {result.cards.map((card) => (
                  <ListingCard key={card.listing.id} card={card}>
                    <SaveButton listingId={card.listing.id} title={card.listing.fields.title ?? "Untitled listing"} />
                  </ListingCard>
                ))}
              </ul>
            </FavouritesProvider>
          )}
          <p className="browse-pages">
            {query.has("cursor") && (
              <Link href={href(firstPage)} className="text-link">
                Back to the first page
              </Link>
            )}
            {result.nextCursor && (
              <Link href={href(new URLSearchParams([...firstPage, ["cursor", result.nextCursor]]))} className="text-link" data-testid="browse-next">
                Next page
              </Link>
            )}
          </p>
        </>
      )}
    </>
  );
}

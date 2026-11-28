import Link from "next/link";
import { FilterPanel } from "@/components/listing/filter-panel";
import { ListingCard } from "@/components/listing/listing-card";
import { SaveButton } from "@/components/listing/save-button";
import { FavouritesProvider } from "@/lib/listing/favourites";
import { browseHref, parameterTitle, without, type FilterSchema, type Places } from "@/lib/search/listing-filters";
import type { BrowseResult } from "@/lib/listing/public-listings";

type Props = {
  path: string;
  query: URLSearchParams;
  result: Exclude<BrowseResult, { kind: "not_found" }>;
  schema: FilterSchema | null;
  places: Places;
  /** Said when there is nothing to show and no filter is applied. */
  empty: string;
};

/** The filter panel, the cards and the paging of a public list (the marketplace and one Agency's), with all its states. */
export function ListingResults({ path, query, result, schema, places, empty }: Props) {
  const href = (search: URLSearchParams) => browseHref(path, search);
  const firstPage = without(query, "cursor");
  const narrowed = [...firstPage.keys()].some((name) => name !== "sort" && name !== "limit");
  const problems = result.kind === "bad_request" ? result.problems : {};
  // A refused cursor alone is a bad page link; any other refused parameter is a bad filter.
  const refused = Object.keys(problems).filter((name) => name !== "cursor");

  return (
    <>
      {schema ? (
        <FilterPanel path={path} schema={schema} places={places} query={firstPage} problems={problems} />
      ) : (
        <p className="card filter-form" data-testid="filters-unavailable">
          The filters are not available right now.{" "}
          <a href={href(query)} className="text-link">
            Reload
          </a>
          {narrowed && (
            <>
              {" "}
              <Link href={path} className="text-link">
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
              <Link href={path} className="text-link">
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
                  <Link href={path} className="text-link">
                    Show all listings
                  </Link>
                </>
              ) : (
                empty
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
          <p className="flex flex-wrap gap-x-6 gap-y-2 justify-center mt-8">
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

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListingResults } from "@/components/listing-results";
import { SearchBox } from "@/components/search-box";
import { browseHref, canonicalQuery, valuesOf } from "@/lib/listing-filters";
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
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">For sale and rent in Karachi</p>
        <h1 className="page-title">Browse listings</h1>
      </header>
      {/* Story 6.1: an AI entry point, so only where AI features are on. */}
      {process.env.AI_FEATURES === "1" && <SearchBox path={BROWSE_PATH} />}
      <ListingResults path={BROWSE_PATH} query={query} result={result.kind === "not_found" ? { kind: "error" } : result} schema={schema} places={places} empty="There are no listings to show yet." />
    </>
  );
}

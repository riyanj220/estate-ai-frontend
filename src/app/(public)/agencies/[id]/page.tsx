import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListingResults } from "@/components/listing-results";
import { browseHref, canonicalQuery, valuesOf } from "@/lib/listing-filters";
import { BROWSE_PATH, agencyPath, fetchAgency, fetchBrowse, fetchFilterSchema, fetchPlaces } from "@/lib/public-listings";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await fetchAgency((await params).id);
  return { title: `${result.kind === "ok" ? result.agency.name : "Agency"} | EstateAI` };
}

/** An Agency's public profile and Listings (Story 3.8), rendered on the server; the URL query is the filter state, as on /listings. */
export default async function AgencyPage({ params, searchParams }: Props) {
  const { id } = await params;
  const found = await fetchAgency(id);
  if (found.kind === "not_found") notFound();
  const path = agencyPath(encodeURIComponent(id));
  const { query, changed } = canonicalQuery(await searchParams);
  if (changed) redirect(browseHref(path, query));
  const back = (
    <p>
      <Link href={BROWSE_PATH} className="text-link">
        Back to browse
      </Link>
    </p>
  );
  if (found.kind === "error") {
    return (
      <>
        <h1 className="page-title">Agency</h1>
        <div className="card" data-testid="agency-error">
          <p>We could not load this agency right now.</p>
          <p>
            <a href={browseHref(path, query)} className="text-link">
              Try again
            </a>
          </p>
        </div>
        {back}
      </>
    );
  }
  const [result, schema, places] = await Promise.all([fetchBrowse(query, id), fetchFilterSchema(), fetchPlaces(valuesOf(query, "city"))]);
  // The Agency stopped being public between the two reads.
  if (result.kind === "not_found") notFound();
  const { name, logoUrl, description, verified } = found.agency;
  return (
    <>
      {back}
      <div className="card agency-profile" data-testid="agency-profile">
        <div className="advertiser">
          {logoUrl && (
            // Same-origin and public only while the Agency is Active, so never the image optimiser.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`Logo of ${name}`} className="advertiser-logo" />
          )}
          <h1 className="page-title">{name}</h1>
          {verified && <span className="verified-mark">Verified agency</span>}
        </div>
        {!verified && <p className="muted">Not verified</p>}
        {description && <p style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{description}</p>}
      </div>
      <section aria-labelledby="agency-listings-title">
        <h2 id="agency-listings-title" className="section-title">
          Listings
        </h2>
        <ListingResults path={path} query={query} result={result} schema={schema} places={places} empty="This agency has no published listings." />
      </section>
    </>
  );
}

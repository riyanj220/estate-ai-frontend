import { cache } from "react";
import type { components } from "@/api/schema";
import { readAmenityCatalogue, type AmenityCatalogueList } from "./amenities";
import { getApi } from "./api";
import { SENTENCE_CODES } from "./error-sentences";
import { readListingEstimate, type ListingEstimate } from "./estimate";
import { readErrorBody } from "./forms";
import { readFilterSchema, type FilterSchema, type Places } from "./listing-filters";
import { isIsoDate, isListingId, readListing, type ListingView } from "./listing-labels";
import { readPreview } from "./listing-preview";
import { readReferenceItems } from "./reference-items";
import { readRegistry, type Registry } from "./registry";

/** Server-side reads of the public (Story 3.1) endpoints. Only the names read here are ever rendered. */
export const BROWSE_PATH = "/listings";
export const agencyPath = (id: string) => `/agencies/${id}`;

/** Who advertises a Listing (Story 3.6). Id (public, for its page), name, logo and verification are an Agency's only. */
export type Advertiser = { type: "individual" } | { type: "agency"; id: string | null; name: string | null; logoUrl: string | null; verified: boolean };

/** An Agency's public profile (Story 3.8): nothing else is read. */
export type PublicAgency = { name: string; logoUrl: string | null; description: string; verified: boolean };
export type AgencyResult = { kind: "ok"; agency: PublicAgency } | { kind: "not_found" } | { kind: "error" };

export type PublicCard = {
  listing: ListingView;
  cityName: string | null;
  localityName: string | null;
  coverUrl: string | null;
  publishedOn: string | null;
  /** Null when the answer is not readable: nothing is then claimed about the advertiser. */
  advertiser: Advertiser | null;
};
/** `problems`: the parameter names the server refused, each with its sentence. */
export type BrowseResult =
  | { kind: "ok"; cards: PublicCard[]; nextCursor: string | null }
  | { kind: "bad_request"; problems: Record<string, string> }
  | { kind: "not_found" }
  | { kind: "error" };
export type DetailResult = ({ kind: "ok" } & Omit<PublicCard, "coverUrl">) | { kind: "not_found" } | { kind: "error" };

const placeName = (place: unknown): string | null => {
  const name = typeof place === "object" && place !== null ? (place as { name?: unknown }).name : null;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};
const dateText = (value: unknown): string | null => (typeof value === "string" && isIsoDate(value) ? value : null);

const LOGO_PATH = /^\/api\/v1\/agencies\/[0-9a-f-]{36}\/logo$/;
const logoOf = (url: unknown): string | null => (typeof url === "string" && LOGO_PATH.test(url) ? url : null);

/** Only the public logo route is ever used as a logo address, and only a literal `true` reads as verified. */
function advertiserOf(value: unknown): Advertiser | null {
  if (typeof value !== "object" || value === null) return null;
  const { type, agency_id, agency_name, logo_url, verified } = value as Record<string, unknown>;
  if (type === "individual") return { type };
  if (type !== "agency") return null;
  return {
    type,
    id: typeof agency_id === "string" && isListingId(agency_id) ? agency_id : null,
    name: typeof agency_name === "string" && agency_name.trim() ? agency_name.trim() : null,
    logoUrl: logoOf(logo_url),
    verified: verified === true,
  };
}

/** Only the media endpoint of this Listing is ever used as an image address. */
const coverOf = (url: unknown, id: string): string | null =>
  typeof url === "string" && url.startsWith(`/api/v1/listings/${id}/images/`) && /^[0-9a-f-]{36}\/file$/.test(url.slice(`/api/v1/listings/${id}/images/`.length)) ? url : null;

export function readCard(card: components["schemas"]["PublicListingCard"]): PublicCard | null {
  if (!isListingId(card.id)) return null;
  const listing = readListing({
    id: card.id,
    media: [],
    fields: { ...card.fields, purpose: card.purpose, category: card.category, subtype: card.subtype, title: card.title },
  });
  if (!listing) return null;
  return {
    listing,
    cityName: placeName(card.city),
    localityName: placeName(card.locality),
    coverUrl: coverOf(card.cover_url, card.id),
    publishedOn: dateText(card.published_on),
    advertiser: advertiserOf(card.advertiser),
  };
}

/** `next` is an absolute backend URL: only its cursor is kept, so the page link stays on this site. */
function cursorOf(next: unknown): string | null {
  if (typeof next !== "string") return null;
  try {
    return new URL(next, "http://placeholder.invalid").searchParams.get("cursor");
  } catch {
    return null;
  }
}

/** Only a sentence of the backend's own table is shown; anything else reads as the default one. */
function problemsOf(body: unknown): Record<string, string> {
  const fields = readErrorBody(body, true)?.fields ?? {};
  return Object.fromEntries(
    Object.entries(fields).map(([name, [sentence]]) => [name, sentence && Object.hasOwn(SENTENCE_CODES, sentence) ? sentence : "Enter a valid value."]),
  );
}

/** The public list, or one Agency's (the same filters, sorts and cursors). */
export async function fetchBrowse(query: URLSearchParams, agencyId?: string): Promise<BrowseResult> {
  try {
    const api = await getApi();
    // The values go through as typed: the server judges them and answers 400. The filter names come from the registry, not from the types.
    const filters = Object.fromEntries(query) as Record<string, string> as { cursor?: string };
    const { data, error, response } = agencyId
      ? await api.GET("/api/v1/public/agencies/{agency_id}/listings", { params: { path: { agency_id: agencyId }, query: filters } })
      : await api.GET("/api/v1/public/listings", { params: { query: filters } });
    if (agencyId && response.status === 404) return { kind: "not_found" };
    if (response.status === 400) return { kind: "bad_request", problems: problemsOf(error) };
    if (!response.ok || !data || !Array.isArray(data.results)) return { kind: "error" };
    const cards = data.results.map(readCard).filter((card): card is PublicCard => card !== null);
    return { kind: "ok", cards, nextCursor: cursorOf(data.next) };
  } catch {
    return { kind: "error" };
  }
}

/** Memoised for one render pass: the page and its title share one read. */
export const fetchAgency = cache(async (id: string): Promise<AgencyResult> => {
  if (!isListingId(id)) return { kind: "not_found" };
  try {
    const api = await getApi();
    const { data, response } = await api.GET("/api/v1/public/agencies/{agency_id}", { params: { path: { agency_id: id } } });
    if (response.status === 404) return { kind: "not_found" };
    const name = typeof data?.name === "string" ? data.name.trim() : "";
    if (!response.ok || !data || !name) return { kind: "error" };
    const description = typeof data.description === "string" ? data.description.trim() : "";
    return { kind: "ok", agency: { name, description, logoUrl: logoOf(data.logo_url), verified: data.verified === true } };
  } catch {
    return { kind: "error" };
  }
});

export async function fetchFilterSchema(): Promise<FilterSchema | null> {
  try {
    const api = await getApi();
    const { data, response } = await api.GET("/api/v1/public/filters");
    return response.ok ? readFilterSchema(data) : null;
  } catch {
    return null;
  }
}

const MAX_CITIES_WITH_LOCALITIES = 5;

/**
 * The names the panel needs: the cities, and the localities of the chosen ones (of the only city when there is just one). A list that
 * fails is simply empty: a chosen value stays ticked under a neutral name, so it can still be cleared.
 */
export async function fetchPlaces(chosen: string[]): Promise<Places> {
  const api = await getApi();
  const items = async (read: () => Promise<{ data?: unknown; response: Response }>, withKind: boolean) => {
    try {
      const { data, response } = await read();
      return response.ok ? readReferenceItems(data, withKind).items : [];
    } catch {
      return [];
    }
  };
  const cities = await items(() => api.GET("/api/v1/reference/cities"), false);
  const wanted = cities.length === 1 ? cities : cities.filter((city) => chosen.includes(city.id)).slice(0, MAX_CITIES_WITH_LOCALITIES);
  const localities = await Promise.all(
    wanted.map(async (city) => ({
      city,
      items: await items(() => api.GET("/api/v1/reference/cities/{city_id}/localities", { params: { path: { city_id: city.id } } }), true),
    })),
  );
  return { cities, localities: localities.filter((group) => group.items.length > 0) };
}

/** Memoised for one render pass: the page and its title share one read. */
export const fetchDetail = cache(async (id: string): Promise<DetailResult> => {
  if (!isListingId(id)) return { kind: "not_found" };
  try {
    const api = await getApi();
    const { data, response } = await api.GET("/api/v1/public/listings/{listing_id}", { params: { path: { listing_id: id } } });
    if (response.status === 404) return { kind: "not_found" };
    if (!response.ok || !data) return { kind: "error" };
    const listing = readPreview(data, id);
    if (!listing) return { kind: "error" };
    return { kind: "ok", listing, cityName: placeName(data.city), localityName: placeName(data.locality), publishedOn: dateText(data.published_on), advertiser: advertiserOf(data.advertiser) };
  } catch {
    return { kind: "error" };
  }
});

/** The stored estimate (the cookie is forwarded, so a signed-in reader gets a missing one computed). Null when it cannot be read. */
export async function fetchListingEstimate(id: string): Promise<ListingEstimate | null> {
  try {
    const api = await getApi();
    const { data, response } = await api.GET("/api/v1/public/listings/{listing_id}/estimate", { params: { path: { listing_id: id } } });
    return response.ok ? readListingEstimate(data) : null;
  } catch {
    return null;
  }
}

export async function fetchPublicRegistry(): Promise<Registry | null> {
  try {
    const api = await getApi();
    const { data, response } = await api.GET("/api/v1/registry");
    return response.ok ? readRegistry(data) : null;
  } catch {
    return null;
  }
}

export async function fetchPublicAmenities(): Promise<AmenityCatalogueList> {
  try {
    const api = await getApi();
    const { data, response } = await api.GET("/api/v1/reference/amenities");
    return response.ok ? readAmenityCatalogue(data) : { status: "error", items: [] };
  } catch {
    return { status: "error", items: [] };
  }
}

/** "2026-11-26" to "26 Nov 2026". A calendar date, so it is formatted in UTC and never shifted. */
export const publishedText = (date: string): string =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

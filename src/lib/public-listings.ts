import { cache } from "react";
import type { components } from "@/api/schema";
import { readAmenityCatalogue, type AmenityCatalogueList } from "./amenities";
import { getApi } from "./api";
import { isIsoDate, isListingId, readListing, type ListingView } from "./listing-labels";
import { readPreview } from "./listing-preview";
import { readRegistry, type Registry } from "./registry";

/** Server-side reads of the public (Story 3.1) endpoints. Only the names read here are ever rendered. */
export const BROWSE_PATH = "/listings";

export type PublicCard = {
  listing: ListingView;
  cityName: string | null;
  localityName: string | null;
  coverUrl: string | null;
  publishedOn: string | null;
};
export type BrowseResult = { kind: "ok"; cards: PublicCard[]; nextCursor: string | null } | { kind: "bad_request" } | { kind: "error" };
export type DetailResult = ({ kind: "ok" } & Omit<PublicCard, "coverUrl">) | { kind: "not_found" } | { kind: "error" };

const placeName = (place: unknown): string | null => {
  const name = typeof place === "object" && place !== null ? (place as { name?: unknown }).name : null;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};
const dateText = (value: unknown): string | null => (typeof value === "string" && isIsoDate(value) ? value : null);

/** Only the media endpoint of this Listing is ever used as an image address. */
const coverOf = (url: unknown, id: string): string | null =>
  typeof url === "string" && url.startsWith(`/api/v1/listings/${id}/images/`) && /^[0-9a-f-]{36}\/file$/.test(url.slice(`/api/v1/listings/${id}/images/`.length)) ? url : null;

function readCard(card: components["schemas"]["PublicListingCard"]): PublicCard | null {
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

export async function fetchBrowse(query: { sort?: string; limit?: string; cursor?: string }): Promise<BrowseResult> {
  try {
    const api = await getApi();
    // The values go through as typed: the server judges them and answers 400.
    const { data, response } = await api.GET("/api/v1/public/listings", { params: { query: query as { cursor?: string; limit?: number; sort?: "newest" } } });
    if (response.status === 400) return { kind: "bad_request" };
    if (!response.ok || !data || !Array.isArray(data.results)) return { kind: "error" };
    const cards = data.results.map(readCard).filter((card): card is PublicCard => card !== null);
    return { kind: "ok", cards, nextCursor: cursorOf(data.next) };
  } catch {
    return { kind: "error" };
  }
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
    return { kind: "ok", listing, cityName: placeName(data.city), localityName: placeName(data.locality), publishedOn: dateText(data.published_on) };
  } catch {
    return { kind: "error" };
  }
});

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

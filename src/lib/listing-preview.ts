import { readListing, type ListingView } from "./listing-labels";

/** The location texts of the public projection, by registry id (names of the city and locality come from the reference lists). */
export const PUBLIC_LOCATION_TEXT = ["society", "phase", "sector", "block"] as const;

/**
 * The owner's preview (Story 2.13) as the page shows it: the public projection of a Listing, read defensively and only by the names this
 * page renders (so a stray private key would never be shown). It reuses `readListing` (status, revision and registry details are not part
 * of the projection and stay unknown). Null when the body cannot be trusted: not an object, another id, or images that fail the media
 * check. The estimate is read apart, by `readValue`.
 */
export function readPreview(data: unknown, id: string): ListingView | null {
  if (typeof data !== "object" || data === null) return null;
  const body = data as Record<string, unknown>;
  if (body.id !== id) return null;
  const fields = typeof body.fields === "object" && body.fields !== null && !Array.isArray(body.fields) ? (body.fields as Record<string, unknown>) : {};
  return readListing({
    id,
    registry_version: body.registry_version,
    media: body.media,
    floor_plan: body.floor_plan,
    fields: { ...fields, purpose: body.purpose, category: body.category, subtype: body.subtype, title: body.title, description: body.description },
  });
}

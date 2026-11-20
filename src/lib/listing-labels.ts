/**
 * Human text for Listing values. The registry carries ids only, so every label is derived from the id by one function:
 * `label("plot_file")` is "Plot file". Nothing here knows which purposes, Categories or Subtypes exist.
 */
export const NOT_SET = "Not set";

/** snake_case id to "Sentence case". Anything that is not a non-empty string reads as "Not set". */
export function label(id: unknown): string {
  if (typeof id !== "string") return NOT_SET;
  const words = id.trim().replace(/[_\s]+/g, " ").trim();
  if (!words) return NOT_SET;
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/** The three registry fields of a Listing as the server sent them (an unknown value is null). */
export type ListingFieldValues = { purpose: string | null; category: string | null; subtype: string | null };

/** "Sale · House · House": the Draft's summary line, built from its fields. */
export function summaryOf(fields: ListingFieldValues): string {
  return [fields.purpose, fields.category, fields.subtype].map(label).join(" · ");
}

/** A Listing as the pages read it, after defensive parsing (`status` is shown through `label`). */
export type ListingView = {
  id: string;
  status: string | null;
  revision: number | null;
  registryVersion: number | null;
  fields: ListingFieldValues;
};

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const count = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Reads one Listing from a response body; null when it has no usable id. A missing or odd field is "unknown", never a crash. */
export function readListing(value: unknown): ListingView | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, status, revision, registry_version, fields } = value as Record<string, unknown>;
  if (typeof id !== "string" || !id) return null;
  const known = typeof fields === "object" && fields !== null ? (fields as Record<string, unknown>) : {};
  return {
    id,
    status: text(status),
    revision: count(revision),
    registryVersion: count(registry_version),
    fields: { purpose: text(known.purpose), category: text(known.category), subtype: text(known.subtype) },
  };
}

/** A canonical lowercase hyphenated UUID, the only id form the backend accepts; anything else is "not found" without a request. */
export function isListingId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}

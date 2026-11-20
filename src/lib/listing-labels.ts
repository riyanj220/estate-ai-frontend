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

/** The editable fields of a Listing (Story 2.2) as the server sent them; an unknown value is null and money stays text. */
export type ListingEditableValues = {
  title: string | null;
  description: string | null;
  asking_price: string | null;
  price_basis: string | null;
  rental_period: string | null;
};

/** A Listing as the pages read it, after defensive parsing (`status` is shown through `label`). */
export type ListingView = {
  id: string;
  status: string | null;
  revision: number | null;
  registryVersion: number | null;
  fields: ListingFieldValues & ListingEditableValues;
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
    fields: {
      purpose: text(known.purpose),
      category: text(known.category),
      subtype: text(known.subtype),
      title: text(known.title),
      description: text(known.description),
      // Money is a decimal string: it is never turned into a number here.
      asking_price: typeof known.asking_price === "string" && /^\d+(\.\d+)?$/.test(known.asking_price) ? known.asking_price : null,
      price_basis: text(known.price_basis),
      rental_period: text(known.rental_period),
    },
  };
}

/**
 * "1500000.00" to "1,500,000.00": groups the whole part by hand and keeps the decimals as sent. Pure string work, never
 * `parseFloat` or `Number`, so no rounding can alter a price. Text that is not a plain decimal is returned as it is.
 */
export function formatPrice(value: string | null): string {
  if (value === null) return NOT_SET;
  const match = /^(\d+)(\.\d+)?$/.exec(value);
  if (!match) return value;
  const whole = match[1].replace(/^0+(?=\d)/, "");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (match[2] ?? "");
}

/**
 * A comparison key for price text, by string work only: surrounding spaces are dropped, leading zeros removed and the decimals
 * padded to two, so "1500000" and "1500000.00" are the same amount. Commas are NOT stripped (the server refuses them), so
 * "1,500,000" is its own, different text. Anything that is not plain digits is its own key.
 */
export function priceKey(value: string): string {
  const plain = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(plain);
  if (!match) return plain;
  return `${match[1].replace(/^0+(?=\d)/, "")}.${(match[2] ?? "").padEnd(2, "0")}`;
}

/**
 * Free text as the server normalises it before comparing or counting: NFC, whitespace collapsed (a description keeps single
 * paragraph breaks) and trimmed. Only used to compare and to count; what is sent is the trimmed text as typed.
 */
export function normalizeText(value: string, paragraphs: boolean): string {
  const lines = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  return paragraphs
    ? lines.replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n")
    : lines.replace(/\s+/g, " ");
}

/** The length of free text as the server counts it, in code points. It only drives the live counter. */
export function plainLength(value: string, paragraphs: boolean): number {
  return Array.from(normalizeText(value, paragraphs)).length;
}

/** A canonical lowercase hyphenated UUID, the only id form the backend accepts; anything else is "not found" without a request. */
export function isListingId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}

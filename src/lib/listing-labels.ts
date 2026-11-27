import { encodeAmenities, readAmenityMap } from "./amenities";

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
  /** Story 2.3: the area as decimal text, its unit, the marla basis (an enum text) and the server's derived square feet (decimal text). */
  area_value: string | null;
  area_unit: string | null;
  marla_basis: string | null;
  area_sqft: string | null;
};

/** A Listing as the pages read it, after defensive parsing (`status` is shown through `label`). */
export type ListingView = {
  id: string;
  status: string | null;
  revision: number | null;
  registryVersion: number | null;
  fields: ListingFieldValues & ListingEditableValues;
  /**
   * The registry details of the Listing beyond the hand-built fields (Story 2.4 on), as form text keyed by registry id: an integer
   * as its digits, a yes/no answer as "true" or "false", everything else as the text the server sent. A detail that is not
   * answered (null) is absent. Whether an id has a control is the registry's decision, never this list's.
   */
  details: Record<string, string>;
  /** The images in position order (Story 2.10). Always checked: see `readMedia`. */
  media: MediaItem[];
  /** Set by moderation (Story 2.17): a restricted Listing is view only for its owner, who may still archive it. */
  restricted: boolean;
  /** A short plain-text reason for a restricted or removed Listing, shown to the owner only; null otherwise. */
  restrictionReason: string | null;
  /** Derived by the server from a report being reviewed (Story 9.2): information only, it changes nothing the owner may do. */
  underReview: boolean;
};

/** One image of a Draft as the page needs it. The `url` is the relative path of the media endpoint, never anything else. */
export type MediaItem = { id: string; position: number; isCover: boolean; url: string };

/**
 * The images of the Listing `listingId`, or null when the list cannot be trusted (not a list, an item that is not an image of THIS
 * Listing, a position that is not a non-negative integer or does not strictly increase, a repeated id, or more than one cover).
 * Fails closed. Positions need not be 0..n-1 and a list may have no cover: the backend repairs ghost links lazily, so a list in
 * that state is still shown and usable (a reorder sends only the ids). The url must be exactly the media endpoint of this image.
 */
export function readMedia(value: unknown, listingId: string): MediaItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: MediaItem[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { id, position, is_cover, url } = entry as Record<string, unknown>;
    if (typeof id !== "string" || !isListingId(id) || items.some((item) => item.id === id)) return null;
    if (typeof position !== "number" || !Number.isSafeInteger(position) || position < 0) return null;
    if (items.length > 0 && position <= items[items.length - 1].position) return null;
    if (typeof is_cover !== "boolean" || url !== `/api/v1/listings/${listingId}/images/${id}/file`) return null;
    items.push({ id, position, isCover: is_cover, url });
  }
  if (items.filter((item) => item.isCover).length > 1) return null;
  return items;
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const decimalString = (value: unknown): string | null => (typeof value === "string" && /^\d+(\.\d+)?$/.test(value) ? value : null);
const count = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** The keys of `fields` the editor builds by hand (and the listing-details and stub lists must agree with: a test checks it). */
export const HAND_BUILT_KEYS = new Set(["purpose", "category", "subtype", "title", "description", "asking_price", "price_basis", "rental_period", "area_value", "area_unit", "marla_basis", "area_sqft"]);

/**
 * The answered details of a Listing as text (see `ListingView.details`). A key is kept only when it is a plain registry token and
 * not an Object prototype name; a value is kept as the text of a finite JSON number, a boolean or a non-empty string. An object, an
 * array or a null is "not answered".
 */
function readDetails(known: Record<string, unknown>): Record<string, string> {
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(known)) {
    if (HAND_BUILT_KEYS.has(key) || key === "amenities" || !/^[a-z0-9_]+$/.test(key) || key in Object.prototype) continue;
    // A JSON number the form cannot call an integer (a float, an unsafe one, a decimal or money sent as a number) keeps its text, so
    // the control shows what the server holds and the summary agrees; saving it unchanged sends nothing.
    if (typeof value === "number" && Number.isFinite(value)) details[key] = String(value);
    else if (typeof value === "boolean") details[key] = value ? "true" : "false";
    else if (typeof value === "string" && value.trim()) details[key] = value;
  }
  return details;
}

/** Reads one Listing from a response body; null when it has no usable id. A missing or odd field is "unknown", never a crash. */
export function readListing(value: unknown): ListingView | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, status, revision, registry_version, fields } = value as Record<string, unknown>;
  if (typeof id !== "string" || !id) return null;
  const known = typeof fields === "object" && fields !== null ? (fields as Record<string, unknown>) : {};
  const media = readMedia((value as Record<string, unknown>).media, id);
  if (media === null) return null;
  // The amenity map (Story 2.8) fails closed: a map that cannot be trusted is no Listing to build on (a save would replace it whole).
  const amenities = readAmenityMap(known.amenities);
  if (amenities === undefined) return null;
  const details = readDetails(known);
  if (amenities !== null) details.amenities = encodeAmenities(amenities);
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
      // Areas are decimal strings too: never turned into numbers.
      area_value: decimalString(known.area_value),
      area_unit: text(known.area_unit),
      marla_basis: text(known.marla_basis),
      area_sqft: decimalString(known.area_sqft),
    },
    details,
    media,
    restricted: (value as Record<string, unknown>).restricted === true,
    restrictionReason: text((value as Record<string, unknown>).restriction_reason),
    underReview: (value as Record<string, unknown>).under_review === true,
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

/** The units that need the marla basis: a kanal is 20 marla. Code-defined like the backend's rule, not a registry value. */
export const MARLA_UNITS = ["marla", "kanal"];
export const isMarlaUnit = (unit: string | null | undefined): boolean => typeof unit === "string" && MARLA_UNITS.includes(unit);

const UNIT_LABELS: Record<string, string> = { sqft: "Square feet", sqyd: "Square yards", marla: "Marla", kanal: "Kanal", acre: "Acre" };

/** Readable option texts of enum details, by field id then value; a value without an entry reads as the humanised id. */
const CHOICE_LABELS: Record<string, Record<string, string>> = {
  approval_authority: {
    lda: "Lahore Development Authority (LDA)",
    cda: "Capital Development Authority (CDA)",
    kda: "Karachi Development Authority (KDA)",
    rda: "Rawalpindi Development Authority (RDA)",
    fda: "Faisalabad Development Authority (FDA)",
    mda: "Multan Development Authority (MDA)",
    gda: "Gujranwala Development Authority (GDA)",
    bda: "Bahawalpur Development Authority (BDA)",
    peshawar_development_authority: "Peshawar Development Authority",
    private_society: "Private society",
    none: "None",
    other: "Other",
  },
  orientation: {
    north: "North",
    south: "South",
    east: "East",
    west: "West",
    north_east: "North-east",
    north_west: "North-west",
    south_east: "South-east",
    south_west: "South-west",
  },
  balloting_status: { not_applicable: "Not applicable", balloting_pending: "Balloting pending", balloted: "Balloted" },
  possession_availability: {
    available_now: "Available now",
    within_one_month: "Within one month",
    within_three_months: "Within three months",
    after_three_months: "After three months",
  },
  occupant_restrictions: { no_restriction: "No restriction", families_only: "Families only", bachelors_only: "Bachelors only" },
  possession_status: { possession_ready: "Possession ready", possession_pending: "Possession pending", file_only: "File only (no possession)" },
};

/** The text of one choice of an enum field: the area units and the marla basis have their own wording, the rest derive from the id. */
export function choiceLabel(field: string, value: string): string {
  if (field === "area_unit") return Object.hasOwn(UNIT_LABELS, value) ? UNIT_LABELS[value] : label(value);
  if (field === "marla_basis") return `${value} sq ft`;
  if (Object.hasOwn(CHOICE_LABELS, field) && Object.hasOwn(CHOICE_LABELS[field], value)) return CHOICE_LABELS[field][value];
  return label(value);
}

/** The whole part grouped in threes, by string work only. */
const group = (whole: string): string => whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** "10.0000" to "10" and "5.2500" to "5.25": groups the whole part and drops trailing zeros of the decimals, never a number. */
export function formatArea(value: string | null): string {
  if (value === null) return NOT_SET;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const decimals = (match[2] ?? "").replace(/0+$/, "");
  return group(match[1]) + (decimals ? `.${decimals}` : "");
}

/** "2722.5000" to "2,722.50": grouped, trailing zeros dropped but never fewer than two decimals, never a number. */
export function formatSqft(value: string | null): string {
  if (value === null) return NOT_SET;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const decimals = (match[2] ?? "").replace(/0+$/, "").padEnd(2, "0");
  return `${group(match[1])}.${decimals}`;
}

/**
 * A comparison key for area text, by string work only. Only text in the real shape (no leading zeros, at most ten whole digits,
 * at most `max(scale, 4)` decimals, the registry's scale or the four the server stores) is compared by amount, so "10" and
 * "10.0000" are the same; any other text (padded, comma, too many decimals) is its own trimmed plain text and is sent for the
 * server to judge, never swallowed as "no change".
 */
export function areaKey(value: string, scale = 4): string {
  const plain = value.trim();
  const match = /^(0|[1-9]\d{0,9})(?:\.(\d+))?$/.exec(plain);
  if (!match) return plain;
  const decimals = match[2] ?? "";
  if (decimals.length > Math.max(scale, 4)) return plain;
  const kept = decimals.replace(/0+$/, "");
  return kept ? `${match[1]}.${kept}` : match[1];
}

export const MARLA_UNKNOWN = "Not available until the marla size is known";

/** The derived line under the Area block, from what is saved: null when there is nothing to say. */
export function derivedText(fields: ListingEditableValues): string | null {
  if (fields.area_sqft !== null) return `About ${formatSqft(fields.area_sqft)} sq ft`;
  if (fields.area_value !== null && isMarlaUnit(fields.area_unit) && fields.marla_basis === null) return MARLA_UNKNOWN;
  return null;
}

/** The Draft summary's area: "5 Marla", with the basis for a marla or kanal ("5 Marla, 225 sq ft per marla"). */
export function areaSummary(fields: ListingEditableValues): string {
  const { area_value: value, area_unit: unit, marla_basis: basis } = fields;
  if (value === null && unit === null) return NOT_SET;
  const unitText = unit === null ? null : choiceLabel("area_unit", unit);
  const head = value !== null && unitText !== null ? `${formatArea(value)} ${unitText}` : value !== null ? `${formatArea(value)} (unit not set)` : `${unitText} (value not set)`;
  return basis !== null && isMarlaUnit(unit) ? `${head}, ${basis} sq ft per marla` : head;
}

/**
 * Whether text is a real calendar date written YYYY-MM-DD, by arithmetic on the digits only (never `Date`, so no time zone and no
 * rounding can touch it). It only decides which input to show: a native date input cannot hold anything else.
 */
export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= days;
}

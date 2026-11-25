import { CATALOGUE_UNAVAILABLE_LINE, sameAmenities, sentAmenities, type AmenityMap } from "@/lib/amenities";
import {
  HAND_BUILT_KEYS,
  choiceLabel,
  formatArea,
  label,
  normalizeText,
  type ListingView,
} from "@/lib/listing-labels";
import type { FieldDef, Registry } from "@/lib/use-registry";

/**
 * The generic "Details" of a Draft: every registry field that applies to it and that the editor does not build by hand. Adding a
 * registry field needs only a label here (a missing label falls back to the humanised id); the control, the hint, the grouping,
 * the comparison, the value sent and the texts of the conflict row all follow from the registry definition.
 */

/** The registry ids the editor builds by hand (Stories 2.2 and 2.3) or that are never input: the Details section skips them. */
const NOT_DETAILS = HAND_BUILT_KEYS;

/** The decimal details shown in their trimmed form (areas); every other decimal is shown padded to its registry scale. */
export const TRIMMED_DECIMALS = ["area_value", "covered_area_sqft"];

/** The registry types the Details section has a control for; a field of another type gets none. */
const DETAIL_TYPES = ["integer", "boolean", "enum", "decimal", "money", "date"];

/**
 * Whether a field has a control in the generic sections. The location section (Story 2.7) also has controls for plain text and for a
 * `reference` (a city or locality chosen from a list); a text field elsewhere has none, and a reference this client does not know has none.
 */
/**
 * The one amenity map field (Story 2.8): the type, the id and the section must ALL say so. A field that claims any one of them without the
 * others gets no control at all (checked before every other rule, so it never falls into a generic control).
 */
export const isAmenitiesField = (def: FieldDef): boolean => def.type === "amenities" && def.id === "amenities" && def.section === "amenities";
const claimsAmenities = (def: FieldDef): boolean => def.type === "amenities" || def.id === "amenities" || def.section === "amenities";
const hasControl = (def: FieldDef): boolean =>
  claimsAmenities(def)
    ? isAmenitiesField(def)
    : DETAIL_TYPES.includes(def.type) || (def.section === "location" && (def.type === "text" || (def.type === "reference" && def.reference !== null)));

/** Labels by registry id. The registry carries ids only; text a person reads lives here. */
const DETAIL_LABELS: Record<string, string> = {
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  construction_year: "Year built",
  condition: "Condition",
  furnishing: "Furnishing",
  parking_spaces: "Parking spaces",
  occupancy_status: "Occupancy status",
  covered_area_sqft: "Covered area (sq ft)",
  total_floors: "Total floors",
  kitchens: "Kitchens",
  construction_status: "Construction status",
  drawing_rooms: "Drawing rooms",
  dining_rooms: "Dining rooms",
  tv_lounges: "TV lounges",
  study_rooms: "Study rooms",
  prayer_rooms: "Prayer rooms",
  store_rooms: "Store rooms",
  laundry_rooms: "Laundry rooms",
  powder_rooms: "Powder rooms",
  servant_quarters: "Servant quarters",
  basement: "Basement",
  floor_number: "Floor number",
  building_floors: "Floors in the building",
  lift: "Lift",
  backup_electricity: "Backup electricity",
  building_security: "Building security",
  balcony_or_terrace: "Balcony or terrace",
  building_lobby: "Building lobby",
  intercom: "Intercom",
  maintenance_charges: "Maintenance charges (PKR per month)",
  electricity: "Electricity",
  water: "Water",
  gas: "Gas",
  plot_width: "Plot width (feet)",
  plot_depth: "Plot depth (feet)",
  possession_status: "Possession status",
  corner_plot: "Corner plot",
  road_width_ft: "Road width (feet)",
  balloting_status: "Balloting status",
  sewerage: "Sewerage",
  development_status: "Development status",
  approval_authority: "Approval authority",
  park_facing: "Park facing",
  main_boulevard: "On a main boulevard",
  boundary_wall: "Boundary wall",
  orientation: "Orientation",
  plot_file_status: "Plot file status",
  business_use: "Business use",
  frontage_ft: "Frontage (feet)",
  road_access: "Road access",
  ceiling_height_ft: "Ceiling height (feet)",
  power_load_kw: "Power load (kW)",
  three_phase_electricity: "Three-phase electricity",
  conference_rooms: "Conference rooms",
  business_centre_facilities: "Business centre facilities",
  price_negotiable: "Price negotiable",
  possession_availability: "Possession availability",
  security_deposit: "Security deposit (PKR)",
  availability_date: "Available from",
  advance_rent: "Advance rent (PKR)",
  minimum_lease_months: "Minimum lease (months)",
  notice_period_days: "Notice period (days)",
  utility_electricity_included: "Electricity included",
  utility_gas_included: "Gas included",
  utility_water_included: "Water included",
  utility_internet_included: "Internet included",
  pets_allowed: "Pets allowed",
  occupant_restrictions: "Occupant restrictions",
  city: "City",
  locality: "Locality",
  society: "Society",
  phase: "Phase",
  sector: "Sector",
  block: "Block",
  street: "Street",
  house_number: "House number",
  latitude: "Latitude",
  longitude: "Longitude",
  amenities: "Amenities",
};

/** Labels that differ by Category (so a new Subtype of the Category inherits them): commercial property is fitted out rather than furnished. */
const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  furnishing: { commercial: "Furnishing or fit-out" },
};

/**
 * The label of a detail: the Category's own text when it has one, else the map's text, else the id humanised ("construction_year"
 * would read "Construction year").
 */
export function detailLabel(id: string, category: string | null = null): string {
  if (category !== null && Object.hasOwn(CATEGORY_LABELS, id) && Object.hasOwn(CATEGORY_LABELS[id], category)) return CATEGORY_LABELS[id][category];
  return Object.hasOwn(DETAIL_LABELS, id) ? DETAIL_LABELS[id] : label(id);
}

/** The visible tag and the helper line of a seller-declared detail (registry `seller_declared`): the owner's claim, never a platform check. */
export const SELLER_DECLARED = "Seller-declared";
export const SELLER_DECLARED_HELP = "You are stating this. EstateAI has not checked it.";

/** The details this Draft's form shows, in registry order: usable type, not derived, applicable to its purpose, Category and Subtype. */
export function shownDetails(registry: Registry, listing: ListingView): FieldDef[] {
  const { purpose, category, subtype } = listing.fields;
  return registry
    .fieldList()
    .filter(
      (def) =>
        !NOT_DETAILS.has(def.id) &&
        !(def.id in Object.prototype) &&
        hasControl(def) &&
        !def.derived &&
        def.appliesTo(purpose, category, subtype),
    );
}

/**
 * The sale and rent terms (registry `section: terms`) and the location (`section: location`, Story 2.7) go in their own blocks, never
 * guessed from applicability; every other detail stays in Details. The location splits by the registry's `class`: the public part and the
 * private address (a field whose class is not exactly `public` is private).
 */
export function splitTerms(defs: FieldDef[]): { terms: FieldDef[]; details: FieldDef[]; publicLocation: FieldDef[]; privateAddress: FieldDef[]; amenities: FieldDef[] } {
  const location = defs.filter((def) => def.section === "location");
  return {
    terms: defs.filter((def) => def.section === "terms"),
    amenities: defs.filter(isAmenitiesField),
    details: defs.filter((def) => def.section !== "terms" && def.section !== "location" && !claimsAmenities(def)),
    publicLocation: location.filter((def) => def.visibility === "public"),
    privateAddress: location.filter((def) => def.visibility !== "public"),
  };
}

export const PUBLIC_LOCATION = "Public location";
export const PUBLIC_LOCATION_HELP = "Shown to everyone on your listing.";
export const PRIVATE_ADDRESS = "Private address (only you can see this)";
export const PRIVATE_ADDRESS_HELP = "Never shown to buyers. Only you can see this.";
/** The Amenities block (Story 2.8). Nearby facilities are the seller's own declaration: no distance, no check by the platform. */
export const AMENITIES_HELP = "Choose Present or None for each item you want to state. Leave an item as Not answered if you do not say: that is not the same as None.";
export const NEARBY_HELP = "Declared by you, not verified. No distance is shown.";
export const OTHER_AMENITIES = "Other";
export const OTHER_AMENITIES_HELP = "Saved earlier and no longer in the list. They are kept as they are and cannot be changed here, only removed.";

/** The title of the Terms fieldset by the Draft's purpose; a purpose this client does not know gets the plain "Terms". */
export function termsTitle(purpose: string | null): string {
  return purpose === "sale" ? "Terms for sale" : purpose === "rent" ? "Terms for rent" : "Terms";
}

export type DetailGroup = { key: "required" | "recommended" | "more"; title: string; fields: FieldDef[] };

/** The groups of the section by the registry's requirement, in a fixed order; an empty group is left out. */
export function groupDetails(defs: FieldDef[]): DetailGroup[] {
  const groups: DetailGroup[] = [
    { key: "required", title: "Required before you publish", fields: defs.filter((def) => def.requirement === "required_for_publication") },
    { key: "recommended", title: "Recommended", fields: defs.filter((def) => def.requirement === "recommended") },
    { key: "more", title: "More details", fields: defs.filter((def) => def.requirement !== "required_for_publication" && def.requirement !== "recommended") },
  ];
  return groups.filter((group) => group.fields.length > 0);
}

/** The only integer text sent as a JSON integer: 0, or ASCII digits without a leading zero, up to nine (so `Number` is exact). The server judges the range. */
const INTEGER_TEXT = /^(0|[1-9]\d{0,8})$/;

/** The group of fields a cross-field code is shown under: an error with this code is on all of them and goes when any of them is edited. */
export const CROSS_FIELD_GROUPS: Record<string, string[]> = { invalid_floor: ["floor_number", "building_floors"] };

/**
 * A comparison key for money text at the registry's scale, by string work only: surrounding spaces dropped, decimals padded to the
 * scale. Text with a leading zero ("007") is its own key, so it counts as a change and is sent for the server to judge.
 */
function moneyKey(value: string, scale: number): string {
  const plain = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,30}))?$/.exec(plain);
  if (!match || (match[2] ?? "").length > scale) return plain;
  return `${match[1]}.${(match[2] ?? "").padEnd(scale, "0")}`;
}

/**
 * A comparison key for a decimal at the registry's scale, by string work only. Only text in the real shape (no leading zeros, at
 * most ten whole digits, at most `scale` decimals) is compared by amount ("35" and "35.00" are the same); any other text (padded,
 * comma, too many decimals) is its own trimmed plain text and is sent for the server to judge, never swallowed as "no change".
 */
function measureKey(value: string, scale: number, signed = false): string {
  const plain = value.trim();
  // A leading minus is part of the shape only for a signed field (the coordinates); "-0" and "0" are the same amount there.
  const match = (signed ? /^(-?)(0|[1-9]\d{0,9})(?:\.(\d+))?$/ : /^()(0|[1-9]\d{0,9})(?:\.(\d+))?$/).exec(plain);
  if (!match) return plain;
  const decimals = match[3] ?? "";
  if (decimals.length > scale) return plain;
  const kept = decimals.replace(/0+$/, "");
  const amount = kept ? `${match[2]}.${kept}` : match[2];
  return match[1] && amount !== "0" ? `-${amount}` : amount;
}

/** The whole part grouped in threes and the decimals padded to the scale ("3000" is "3,000.00" at scale 2), never a number. */
function formatMoney(value: string, scale: number): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const whole = match[1].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${whole}.${(match[2] ?? "").padEnd(scale, "0")}`;
}

/** Text for one detail in the form: whether two texts are the same value (amounts by amount, integers trimmed, choices exactly). */
export function sameDetail(def: FieldDef, a: string, b: string): boolean {
  if (a === b) return true; // the same text is never a change
  if (def.type === "integer") return a.trim() === b.trim();
  if (def.type === "decimal") {
    // `b` is the saved text: a saved value may carry more decimals than the scale (an older rule), and typing it without the trailing
    // zeros is no change. Typed text beyond the larger of the two limits is its own key and is sent for the server to judge.
    const stored = /^\d+\.(\d+)$/.exec(b.trim());
    const limit = Math.max(def.scale ?? 4, stored ? stored[1].length : 0);
    return measureKey(a, limit, def.signed) === measureKey(b, limit, def.signed);
  }
  if (def.type === "money") return moneyKey(a, def.scale ?? 2) === moneyKey(b, def.scale ?? 2);
  if (def.type === "amenities") return sameAmenities(a, b); // the same answers, whatever the order of the text
  if (def.type === "date") return a.trim() === b.trim(); // ISO text compared as text: no Date, no time zone
  if (def.type === "text") return normalizeText(a, false) === normalizeText(b, false); // as the server normalises a line of text
  if (def.type === "reference") return a.trim() === b.trim(); // an id: exact text
  return false;
}

/**
 * The value the form sends for a changed detail. Emptied is null (not answered). Integer text in the exact shape is a JSON
 * integer (`Number` only ever sees text that matched, never arbitrary input); any other text goes as typed (trimmed) for the
 * server to refuse. A yes/no choice is true or false. Decimals and money stay text.
 */
export function sentDetail(def: FieldDef, value: string): string | number | boolean | AmenityMap | null {
  if (def.type === "amenities") return sentAmenities(value); // the whole map; null when nothing is answered
  const text = value.trim();
  if (!text) return null;
  if (def.type === "integer") return INTEGER_TEXT.test(text) ? Number(text) : text;
  if (def.type === "boolean") return text === "true" ? true : text === "false" ? false : null;
  return text; // a line of text, a reference id and a decimal all go as trimmed text: the server judges them
}

export const NOT_ANSWERED = "Not answered";

/** What "Latest saved" shows for a detail, from the server's text. */
export function latestDetail(def: FieldDef, value: string): string {
  if (value === "") return NOT_ANSWERED;
  if (def.type === "boolean") return value === "true" ? "Yes" : value === "false" ? "No" : value;
  if (def.type === "enum") return choiceLabel(def.id, value);
  if (def.type === "amenities") return CATALOGUE_UNAVAILABLE_LINE; // the editor words this itself, from the catalogue; no label is guessed from a bare code
  // Every decimal shows its registry scale ("35.00", "1,200.50") except the area fields, the hand-listed exceptions that keep the trimmed
  // form ("2,400.5"). The payload carries no marker for them, so this list is the rule (documented in the README).
  if (def.type === "decimal") return TRIMMED_DECIMALS.includes(def.id) || def.scale === null ? formatArea(value) : formatMoney(value, def.scale);
  if (def.type === "money") return `${def.currency ?? "PKR"} ${formatMoney(value, def.scale ?? 2)}`;
  return value;
}

/** The hint under a detail: the registry's own explanation, then the limits it states. Never the requirement (the group says it). */
export function detailHint(def: FieldDef): string {
  const parts: string[] = [];
  if (def.description) parts.push(/[.!?]$/.test(def.description) ? def.description : `${def.description}.`);
  const limits = def.min !== null && def.max !== null ? `Between ${def.min} and ${def.max}.` : def.min !== null ? `At least ${def.min}.` : def.max !== null ? `At most ${def.max}.` : "";
  if (def.type === "integer") parts.push(def.min !== null && def.max !== null ? `Whole number from ${def.min} to ${def.max}.` : `Whole number. ${limits}`.trim());
  if (def.type === "decimal") {
    if (def.scale !== null) parts.push(`Digits with an optional decimal point, up to ${def.scale} decimal places.`);
    if (limits) parts.push(limits);
  }
  if (def.type === "money") {
    parts.push(`Amount in ${def.currency ?? "PKR"}.`);
    if (limits) parts.push(limits);
  }
  if (def.type === "date" && limits) parts.push(limits); // the bounds are ISO text; the registry's own description names the format
  if (def.type === "text" && def.maxLength !== null) parts.push(`Up to ${def.maxLength} characters.`);
  return parts.join(" ");
}

/** The summary's answered details, in registry order: "Bedrooms: 3". Unanswered details are left out. */
export function answeredDetails(
  defs: FieldDef[],
  listing: ListingView,
): { id: string; label: string; text: string; sellerDeclared: boolean }[] {
  const { terms, details } = splitTerms(defs); // the summary follows the form: the terms first
  return [...terms, ...details]
    .filter((def) => def.type !== "amenities" && Object.hasOwn(listing.details, def.id))
    .map((def) => ({
      id: def.id,
      label: detailLabel(def.id, listing.fields.category),
      text: latestDetail(def, listing.details[def.id]) + (notOffered(def, listing.details[def.id], listing) ? ` ${NO_LONGER_OFFERED}` : ""),
      sellerDeclared: def.sellerDeclared,
    }));
}

export const NO_LONGER_OFFERED = "(no longer offered)";
export const NOT_OFFERED_HINT = "The saved value is not offered for this type of property.";

/** Whether a saved enum answer is outside what the registry offers this Draft (a changed registry, or a value from before a rule). */
export function notOffered(def: FieldDef, saved: string | undefined, listing: { fields: { purpose: string | null; subtype: string | null } }): boolean {
  return def.type === "enum" && typeof saved === "string" && saved !== "" && !def.valuesFor(listing.fields.purpose, listing.fields.subtype).includes(saved);
}

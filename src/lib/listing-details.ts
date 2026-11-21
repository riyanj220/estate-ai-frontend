import {
  HAND_BUILT_KEYS,
  areaKey,
  choiceLabel,
  formatArea,
  label,
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

/** The registry types the Details section has a control for; a field of another type gets none. */
const DETAIL_TYPES = ["integer", "boolean", "enum", "decimal", "money"];

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
};

/** The label of a detail: the map's text, else the id humanised ("construction_year" would read "Construction year"). */
export const detailLabel = (id: string): string => (Object.hasOwn(DETAIL_LABELS, id) ? DETAIL_LABELS[id] : label(id));

/** The details this Draft's form shows, in registry order: usable type, not derived, applicable to its purpose, Category and Subtype. */
export function shownDetails(registry: Registry, listing: ListingView): FieldDef[] {
  const { purpose, category, subtype } = listing.fields;
  return registry
    .fieldList()
    .filter(
      (def) =>
        !NOT_DETAILS.has(def.id) &&
        !(def.id in Object.prototype) &&
        DETAIL_TYPES.includes(def.type) &&
        !def.derived &&
        def.appliesTo(purpose, category, subtype),
    );
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
  if (def.type === "decimal") return areaKey(a, def.scale ?? 4) === areaKey(b, def.scale ?? 4);
  if (def.type === "money") return moneyKey(a, def.scale ?? 2) === moneyKey(b, def.scale ?? 2);
  return false;
}

/**
 * The value the form sends for a changed detail. Emptied is null (not answered). Integer text in the exact shape is a JSON
 * integer (`Number` only ever sees text that matched, never arbitrary input); any other text goes as typed (trimmed) for the
 * server to refuse. A yes/no choice is true or false. Decimals and money stay text.
 */
export function sentDetail(def: FieldDef, value: string): string | number | boolean | null {
  const text = value.trim();
  if (!text) return null;
  if (def.type === "integer") return INTEGER_TEXT.test(text) ? Number(text) : text;
  if (def.type === "boolean") return text === "true" ? true : text === "false" ? false : null;
  return text;
}

export const NOT_ANSWERED = "Not answered";

/** What "Latest saved" shows for a detail, from the server's text. */
export function latestDetail(def: FieldDef, value: string): string {
  if (value === "") return NOT_ANSWERED;
  if (def.type === "boolean") return value === "true" ? "Yes" : value === "false" ? "No" : value;
  if (def.type === "enum") return choiceLabel(def.id, value);
  if (def.type === "decimal") return formatArea(value);
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
  return parts.join(" ");
}

/** The summary's answered details, in registry order: "Bedrooms: 3". Unanswered details are left out. */
export function answeredDetails(defs: FieldDef[], listing: ListingView): { id: string; label: string; text: string }[] {
  return defs
    .filter((def) => Object.hasOwn(listing.details, def.id))
    .map((def) => ({ id: def.id, label: detailLabel(def.id), text: latestDetail(def, listing.details[def.id]) }));
}

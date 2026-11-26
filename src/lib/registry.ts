import { isIsoDate } from "@/lib/listing-labels";

// The parser of the Field registry, shared by the client hook (use-registry) and server components.

/**
 * The part of the Field registry the Listing forms use: the purposes, the Categories and each Category's Subtypes, as the
 * server serves them (`GET /api/v1/registry`). Nothing about them is hard-coded in the frontend.
 */
export type Registry = {
  version: number;
  purposes: string[];
  categories: string[];
  /** The Subtypes of a Category; empty for an unknown Category. */
  subtypesOf: (category: string) => string[];
  /** The definition of one Listing field (Story 2.2), or undefined when the registry does not define it. */
  field: (id: string) => FieldDef | undefined;
  /** Every usable field definition, in the registry's own order (the Details section of the Draft editor is built from it). */
  fieldList: () => FieldDef[];
};

/**
 * One field definition as the editor uses it: the type, the requirement, the text limits, the money bounds, the allowed
 * values (for an enum, possibly narrowed by purpose) and where it applies. The frontend decides nothing from these beyond
 * which control to show and which hints to print; the server judges every value.
 */
export type FieldDef = {
  id: string;
  type: string;
  /** `required_for_publication`, `recommended` or `optional` (other values are treated as optional). */
  requirement: string;
  minLength: number | null;
  maxLength: number | null;
  /**
   * The bounds as text, never numbers: decimal text for money, decimal and integer fields (the server serves integer bounds as text too),
   * ISO calendar-date text ("2000-01-01") for a date field. Do not assume numeric text for every type; the client only prints them (and
   * uses a date's as the `min` and `max` attributes of the date input).
   */
  min: string | null;
  max: string | null;
  currency: string | null;
  /** The decimal places a decimal field allows (decimal fields only). */
  scale: number | null;
  /**
   * A decimal whose lower bound is negative (the coordinates). The registry serves no `signed` marker yet, so this is read from the bounds
   * (a negative `min` and a present `max`): only such a field accepts a leading minus when texts are compared.
   */
  signed: boolean;
  /** A derived field is computed by the server and is never input (Story 2.3). */
  derived: boolean;
  /**
   * The registry marks the field as part of the Listing's identity (`quota_identity`, Story 2.17): it cannot be changed while the
   * Listing is published. Read from the registry, never from a list in this code.
   */
  identity: boolean;
  /** The registry's short explanation of what a value means, when it documents one. */
  description: string | null;
  allowedValues: string[];
  /** The registry marks the field as the owner's own claim, never checked by EstateAI (Story 2.5): the form says so next to it. */
  sellerDeclared: boolean;
  /** Where a form groups the field (Stories 2.6 and 2.7): `terms` for the sale and rent terms, `location` for the location, `amenities` for the amenity map (Story 2.8), else `details`; a missing or unknown marker is `details`. */
  section: "terms" | "location" | "amenities" | "details";
  /** What a `reference` field points at (Story 2.7): `city` or `locality`; null for every other type and for a reference this client does not know (no control then). */
  reference: "city" | "locality" | null;
  /** `private` fields are only ever shown to their owner. Anything that is not exactly `public` counts as private (fail closed). */
  visibility: "public" | "private";
  /**
   * The values offered for a purpose and Subtype: the Subtype's own list when the registry narrows it (intersected with the
   * purpose's list when both exist; nothing when the Subtype has no entry), else the purpose's list, else every allowed value.
   */
  valuesFor: (purpose: string | null, subtype?: string | null) => string[];
  /** Whether the field applies to a Listing of this purpose, Category and Subtype (an empty list means all). */
  appliesTo: (purpose: string | null, category: string | null, subtype: string | null) => boolean;
};

// Ids become element ids and option values: only simple tokens are accepted.
const isToken = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9_]+$/.test(value);
const tokens = (value: unknown): string[] | null => (Array.isArray(value) ? [...new Set(value.filter(isToken))] : null);
// An enum value is a token or a plain number written as text (the marla basis: "225", "272.25"); it stays text.
const isChoice = (value: unknown): value is string => isToken(value) || (typeof value === "string" && /^\d{1,4}(\.\d{1,2})?$/.test(value));
const choices = (value: unknown): string[] | null => (Array.isArray(value) ? [...new Set(value.filter(isChoice))] : null);

const limit = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null);
// A bound: ISO text for a date, decimal text for every other type; only a decimal bound may be negative (the coordinates: -90 and -180).
const decimalText = (value: unknown, negative: boolean): string | null =>
  typeof value === "string" && (negative ? /^-?\d{1,16}(\.\d{1,8})?$/ : /^\d{1,16}(\.\d{1,8})?$/).test(value) ? value : null;
const dateText = (value: unknown): string | null => (typeof value === "string" && isIsoDate(value) ? value : null);
const bound = (type: string, value: unknown): string | null => (type === "date" ? dateText(value) : decimalText(value, type === "decimal"));
const covers = (list: string[], value: string | null) => list.length === 0 || (value !== null && list.includes(value));

/** Reads the field definitions; an entry that is not usable is skipped, and a missing or odd list is simply no definitions. */
function readFields(value: unknown): Map<string, FieldDef> {
  const fields = new Map<string, FieldDef>();
  if (!Array.isArray(value)) return fields;
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const raw = entry as Record<string, unknown>;
    const { id, type, requirement } = raw;
    if (!isToken(id) || fields.has(id) || typeof type !== "string") continue;
    const allowed = choices(raw.allowed_values) ?? [];
    const narrowed = new Map<string, string[]>();
    const hasPurposeMap = typeof raw.allowed_values_by_purpose === "object" && raw.allowed_values_by_purpose !== null;
    if (typeof raw.allowed_values_by_purpose === "object" && raw.allowed_values_by_purpose !== null) {
      for (const [purpose, list] of Object.entries(raw.allowed_values_by_purpose)) {
        const values = choices(list);
        if (isToken(purpose) && values) narrowed.set(purpose, values);
      }
    }
    const bySubtype = new Map<string, string[]>();
    // A map that is present (even empty or malformed) always filters; only an absent key (the server serves null) means "no narrowing".
    const hasSubtypeMap = raw.allowed_values_by_subtype !== null && raw.allowed_values_by_subtype !== undefined;
    if (hasSubtypeMap && typeof raw.allowed_values_by_subtype === "object" && !Array.isArray(raw.allowed_values_by_subtype)) {
      for (const [subtype, list] of Object.entries(raw.allowed_values_by_subtype as Record<string, unknown>)) {
        const values = choices(list);
        if (isToken(subtype) && values) bySubtype.set(subtype, values);
      }
    }
    let [min, max] = [bound(type, raw.min), bound(type, raw.max)];
    // Fail closed: a date bound must be a real calendar date, and a window with a bad bound or whose start is after its end is no window at
    // all (both dropped); an absent bound simply means no bound on that side.
    const present = (value: unknown) => value !== null && value !== undefined;
    if (type === "date" && ((present(raw.min) && min === null) || (present(raw.max) && max === null) || (min !== null && max !== null && min > max))) {
      [min, max] = [null, null];
    }
    const applicability = typeof raw.applicability === "object" && raw.applicability !== null ? (raw.applicability as Record<string, unknown>) : {};
    const purposes = tokens(applicability.purposes) ?? [];
    const categories = tokens(applicability.categories) ?? [];
    const subtypes = tokens(applicability.subtypes) ?? [];
    fields.set(id, {
      id,
      type,
      requirement: typeof requirement === "string" ? requirement : "optional",
      minLength: limit(raw.min_length),
      maxLength: limit(raw.max_length),
      min,
      max,
      currency: typeof raw.currency === "string" && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : null,
      signed: type === "decimal" && min !== null && max !== null && min.startsWith("-"),
      scale: typeof raw.scale === "number" && Number.isInteger(raw.scale) && raw.scale >= 1 && raw.scale <= 8 ? raw.scale : null,
      derived: raw.derived === true,
      identity: raw.quota_identity === true,
      description: typeof raw.description === "string" && raw.description.trim() ? raw.description : null,
      allowedValues: allowed,
      sellerDeclared: raw.seller_declared === true,
      section: raw.section === "terms" ? "terms" : raw.section === "location" ? "location" : raw.section === "amenities" ? "amenities" : "details",
      reference: type === "reference" && (raw.reference === "city" || raw.reference === "locality") ? raw.reference : null,
      visibility: raw.class === "public" ? "public" : "private",
      valuesFor: (purpose, subtype = null) => {
        const byPurpose = purpose !== null && narrowed.has(purpose) ? (narrowed.get(purpose) ?? allowed) : null;
        if (!hasSubtypeMap) return byPurpose ?? allowed;
        // Fail closed like the backend: with a by-subtype map, a Subtype it does not list offers nothing, and a purpose a present
        // by-purpose map does not list intersects with nothing.
        const own = subtype !== null && bySubtype.has(subtype) ? (bySubtype.get(subtype) ?? []) : [];
        if (byPurpose) return own.filter((value) => byPurpose.includes(value));
        return hasPurposeMap ? [] : own;
      },
      appliesTo: (purpose, category, subtype) => covers(purposes, purpose) && covers(categories, category) && covers(subtypes, subtype),
    });
  }
  return fields;
}

/**
 * Validates the shape defensively: anything unexpected is a failed load, never a crash. Entries whose ids are not simple
 * tokens are skipped, and so is a Category left with no Subtype; no usable purpose or Category is a failed load.
 */
export function readRegistry(data: unknown): Registry | null {
  if (typeof data !== "object" || data === null) return null;
  const { version, taxonomy, fields: fieldList } = data as Record<string, unknown>;
  if (typeof version !== "number" || !Number.isFinite(version)) return null;
  if (typeof taxonomy !== "object" || taxonomy === null) return null;
  const { purposes, categories } = taxonomy as Record<string, unknown>;
  const purposeIds = tokens(purposes);
  if (!purposeIds || purposeIds.length === 0 || !Array.isArray(categories)) return null;
  const subtypes = new Map<string, string[]>();
  for (const entry of categories) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, subtypes: own } = entry as Record<string, unknown>;
    const list = tokens(own);
    if (!isToken(id) || subtypes.has(id) || !list || list.length === 0) continue;
    subtypes.set(id, list);
  }
  if (subtypes.size === 0) return null;
  const fields = readFields(fieldList);
  return {
    version,
    purposes: purposeIds,
    categories: [...subtypes.keys()],
    subtypesOf: (category) => subtypes.get(category) ?? [],
    field: (id) => fields.get(id),
    fieldList: () => [...fields.values()],
  };
}

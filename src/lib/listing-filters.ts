import { amenityLabel, isAmenityCode, readAmenityCatalogue, type CatalogueItem } from "./amenities";
import { label } from "./listing-labels";

/**
 * The public filters (Story 3.5) as the browse page handles them. The URL query is the whole state: the panel is a plain GET form generated
 * from `GET /api/v1/public/filters`, and the server judges every value. Nothing here knows which filters exist.
 */
export type FilterMatch = "choice" | "range" | "boolean" | "amenities";
export type FilterDef = {
  id: string;
  match: FilterMatch;
  params: string[];
  type: string;
  allowedValues: string[];
  options: CatalogueItem[];
  reference: "city" | "locality" | null;
  sellerDeclared: boolean;
  purposes: string[];
  subtypes: string[];
};
export type FilterSchema = { filters: FilterDef[]; sorts: string[]; preferencePrefix: string };

const isToken = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value);
const tokens = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isToken) : []);
const MATCHES: FilterMatch[] = ["choice", "range", "boolean", "amenities"];

/** A filter that cannot be trusted (or of a later kind) is left out; a body without a usable list is a failed load (null). */
export function readFilterSchema(data: unknown): FilterSchema | null {
  const body = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (!Array.isArray(body.filters)) return null;
  const filters: FilterDef[] = [];
  for (const entry of body.filters) {
    const raw = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    const params = tokens(raw.params);
    const match = raw.match as FilterMatch;
    if (!isToken(raw.id) || !MATCHES.includes(match) || params.length !== (match === "range" ? 2 : 1)) continue;
    const reference = raw.reference === "city" || raw.reference === "locality" ? raw.reference : null;
    const options = match === "amenities" ? readAmenityCatalogue({ items: raw.options }).items : [];
    const allowedValues = tokens(raw.allowed_values);
    if (match === "choice" && !reference && allowedValues.length === 0) continue;
    filters.push({
      id: raw.id,
      match,
      params,
      type: typeof raw.type === "string" ? raw.type : "",
      allowedValues,
      options,
      reference,
      sellerDeclared: raw.seller_declared === true,
      purposes: tokens(raw.purposes),
      subtypes: tokens(raw.subtypes),
    });
  }
  if (filters.length === 0) return null;
  return { filters, sorts: tokens(body.sorts), preferencePrefix: isToken(body.preference_prefix) ? body.preference_prefix : "prefer_" };
}

const PREFER = "prefer_";
export const SORT_LABELS: Record<string, string> = {
  relevance: "Best match",
  newest: "Newest first",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};
const hasPreference = (query: URLSearchParams) => [...query.keys()].some((key) => key.startsWith(PREFER));
export const defaultSort = (query: URLSearchParams) => (hasPreference(query) ? "relevance" : "newest");

/**
 * The page's query in its one clean form. A GET form without JavaScript sends every empty input and one pair per ticked box; the backend
 * accepts neither, so empty values are dropped, repeats of a name are joined with commas and the default sort is left out. `changed`
 * says the address should be replaced by the clean one.
 */
export function canonicalQuery(params: Record<string, string | string[] | undefined>): { query: URLSearchParams; changed: boolean } {
  const query = new URLSearchParams();
  let changed = false;
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined) continue;
    const values = [raw].flat().map((value) => value.trim()).filter(Boolean);
    const value = [...new Set(values)].join(",");
    if (!value || value !== raw) changed = true;
    if (value) query.set(key, value);
  }
  if (query.get("sort") === defaultSort(query)) {
    query.delete("sort");
    changed = true;
  }
  return { query, changed };
}

/** A link to the browse page; commas stay readable. */
export function browseHref(path: string, query: URLSearchParams): string {
  const search = query.toString().replaceAll("%2C", ",");
  return search ? `${path}?${search}` : path;
}

export const valuesOf = (query: URLSearchParams, name: string): string[] => query.get(name)?.split(",").filter(Boolean) ?? [];

/** The query without one value (or the whole parameter). Any change of criteria starts again at the first page. */
export function without(query: URLSearchParams, name: string, value?: string): URLSearchParams {
  const next = new URLSearchParams(query);
  next.delete("cursor");
  const rest = value === undefined ? [] : valuesOf(query, name).filter((item) => item !== value);
  if (rest.length > 0) next.set(name, rest.join(","));
  else next.delete(name);
  if (next.get("sort") === "relevance" && !hasPreference(next)) next.delete("sort");
  return next;
}

const TITLES: Record<string, string> = { asking_price: "Price (PKR)", area_sqft: "Area (square feet)", locality: "Area or society" };
export const filterTitle = (id: string): string => TITLES[id] ?? label(id);
const BOUNDS = ["Minimum", "Maximum"] as const;
export const boundLabel = (index: number): string => BOUNDS[index];
/** "Minimum price (PKR)": only the title's first letter is lowered. */
const boundTitle = (index: number, id: string): string => `${BOUNDS[index]} ${filterTitle(id).replace(/^./, (first) => first.toLowerCase())}`;

/** The name of one parameter for a message; a name that is no filter reads as itself. */
export function parameterTitle(name: string, schema: FilterSchema | null): string {
  if (name === "sort") return "Sort";
  if (name === "limit") return "Page size";
  for (const filter of schema?.filters ?? []) {
    const index = filter.params.indexOf(name);
    if (index >= 0) return filter.match === "range" ? boundTitle(index, filter.id) : filterTitle(filter.id);
  }
  return name;
}

export type Chip = { key: string; text: string; query: URLSearchParams };
export type Places = {
  cities: { id: string; name: string }[];
  /** The localities loaded for the panel, by city. */
  localities: { city: { id: string; name: string }; items: { id: string; name: string }[] }[];
};

export const cityName = (places: Places, id: string): string => places.cities.find((city) => city.id === id)?.name ?? "Selected city";
export const localityName = (places: Places, id: string): string =>
  places.localities.flatMap((group) => group.items).find((item) => item.id === id)?.name ?? "Selected area or society";

const DECLARED = " (seller-declared)";

/** One removable entry per criterion in the query, preferences included (they have no controls, so this is where they are removed). */
export function activeChips(query: URLSearchParams, schema: FilterSchema, places: Places): Chip[] {
  const chips: Chip[] = [];
  for (const prefix of ["", schema.preferencePrefix]) {
    const lead = prefix ? "Preferred: " : "";
    for (const filter of schema.filters) {
      const title = filterTitle(filter.id);
      const declared = filter.sellerDeclared ? DECLARED : "";
      filter.params.forEach((param, index) => {
        const name = prefix + param;
        if (filter.match === "range") {
          const value = query.get(name);
          if (value) chips.push({ key: name, text: `${lead}${boundTitle(index, filter.id)}: ${value}${declared}`, query: without(query, name) });
          return;
        }
        for (const value of valuesOf(query, name)) {
          let next = without(query, name, value);
          let text = `${title}: ${filter.match === "boolean" ? (value === "true" ? "Yes" : value === "false" ? "No" : value) : label(value)}${declared}`;
          if (filter.match === "amenities") {
            const nearby = filter.options.some((item) => item.code === value && item.kind === "nearby");
            text = `Amenity: ${isAmenityCode(value) ? amenityLabel(value, filter.options) : value}${nearby ? DECLARED : ""}`;
          }
          if (filter.reference === "locality") text = `${title}: ${localityName(places, value)}`;
          if (filter.reference === "city") {
            text = `${title}: ${cityName(places, value)}`;
            // Its localities go with it, or they would keep narrowing the results to that city.
            for (const item of places.localities.find((group) => group.city.id === value)?.items ?? []) next = without(next, "locality", item.id);
          }
          chips.push({ key: `${name}=${value}`, text: lead + text, query: next });
        }
      });
    }
  }
  return chips;
}

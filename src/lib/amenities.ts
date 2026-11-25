/**
 * Amenities and seller-declared nearby facilities (Story 2.8). The value of the registry field `amenities` is a map from a catalogue code to
 * `present` or `none`; a code that is not in the map is UNANSWERED, which is never the same as `none`. The Draft form keeps the map as one
 * text (canonical JSON with sorted keys, "" when nothing is answered) so the generic compare, conflict and save flow works on it unchanged.
 */
export type AmenityState = "present" | "none";
export type AmenityMap = Record<string, AmenityState>;
export type AmenityKind = "on_property" | "community" | "nearby";
export type CatalogueItem = { code: string; label: string; kind: AmenityKind; group: string };

export const KIND_ORDER: AmenityKind[] = ["on_property", "community", "nearby"];
export const KIND_TITLES: Record<AmenityKind, string> = { on_property: "On the property", community: "Community", nearby: "Nearby" };
export const STATE_TEXT: Record<AmenityState, string> = { present: "Present", none: "None" };
/** snake_case to "Sentence case" (the same rule as `label` in listing-labels, kept here so this module imports nothing from it). */
const label = (id: string): string => {
  const words = id.trim().replace(/[_\s]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : "";
};

export const NOT_ANSWERED_TEXT = "Not answered";

/** A catalogue code is a stable lowercase token (the backend's `^[a-z][a-z0-9_]{1,47}$`); anything else (a prototype key, odd text) is never trusted as a code. */
export const isAmenityCode = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9_]{1,47}$/.test(value);
const isState = (value: unknown): value is AmenityState => value === "present" || value === "none";

/**
 * Reads the map the server sent for `fields.amenities`: `null` for no answer (null or an empty object), the map for a good one, and
 * `undefined` when it cannot be trusted (not an object, a code that is not a token, a state that is not exactly `present` or `none`).
 * Unknown codes are NOT an error here: a code from a later catalogue is kept as it is.
 */
export function readAmenityMap(value: unknown): AmenityMap | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const map: AmenityMap = {};
  for (const [code, state] of Object.entries(value)) {
    if (!isAmenityCode(code) || !isState(state)) return undefined;
    map[code] = state;
  }
  return Object.keys(map).length === 0 ? null : map;
}

/** The form text of a map: canonical JSON with sorted keys, "" when nothing is answered. */
export function encodeAmenities(map: AmenityMap | null): string {
  if (map === null) return "";
  const sorted: AmenityMap = {};
  for (const code of Object.keys(map).sort()) sorted[code] = map[code];
  return Object.keys(sorted).length === 0 ? "" : JSON.stringify(sorted);
}

/** The map of a form text; text that is not a map (never produced here) is nothing answered. */
export function decodeAmenities(text: string): AmenityMap {
  if (text === "") return {};
  try {
    return readAmenityMap(JSON.parse(text)) ?? {};
  } catch {
    return {};
  }
}

/** The form text after one item is set (`""` is Not answered and removes the code). Every other code stays exactly as it was. */
export function withAmenity(text: string, code: string, state: AmenityState | ""): string {
  const map = decodeAmenities(text);
  if (state === "") delete map[code];
  else map[code] = state;
  return encodeAmenities(map);
}

/** Whether two form texts are the same answers. */
export const sameAmenities = (a: string, b: string): boolean => encodeAmenities(decodeAmenities(a)) === encodeAmenities(decodeAmenities(b));

/** The value a save sends: the whole map, or null for nothing answered. */
export function sentAmenities(text: string): AmenityMap | null {
  const map = decodeAmenities(text);
  return Object.keys(map).length === 0 ? null : map;
}

/** The text of a code: the catalogue's label, else the code humanised (a code the catalogue no longer lists). */
export const amenityLabel = (code: string, items: CatalogueItem[]): string => items.find((item) => item.code === code)?.label ?? label(code);

/** "Present: Elevator, Lobby. None: Park." for the saved answers; "Not answered" when there are none. */
export function amenitySummary(text: string, items: CatalogueItem[]): string {
  const map = decodeAmenities(text);
  const parts = (["present", "none"] as const)
    .map((state) => {
      const names = Object.keys(map)
        .filter((code) => map[code] === state)
        .map((code) => amenityLabel(code, items));
      return names.length > 0 ? `${STATE_TEXT[state]}: ${names.join(", ")}.` : "";
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : NOT_ANSWERED_TEXT;
}

export type CatalogueGroup = { group: string; title: string; items: CatalogueItem[] };
export type CatalogueKind = { kind: AmenityKind; title: string; groups: CatalogueGroup[] };

/**
 * The catalogue as the form shows it: the three kinds in a fixed order, each with its groups in the order the server listed them. A kind with
 * no item is left out. The group heading is the humanised group; a group named like its kind adds no heading of its own.
 */
export function groupCatalogue(items: CatalogueItem[]): CatalogueKind[] {
  return KIND_ORDER.map((kind) => {
    const groups: CatalogueGroup[] = [];
    for (const item of items.filter((entry) => entry.kind === kind)) {
      const existing = groups.find((entry) => entry.group === item.group);
      if (existing) existing.items.push(item);
      else groups.push({ group: item.group, title: label(item.group), items: [item] });
    }
    return { kind, title: KIND_TITLES[kind], groups };
  }).filter((entry) => entry.groups.length > 0);
}

/** The saved codes the catalogue does not list (deactivated since, or from a later catalogue): kept untouched and shown read-only. */
export const otherCodes = (text: string, items: CatalogueItem[]): string[] =>
  Object.keys(decodeAmenities(text))
    .filter((code) => !items.some((item) => item.code === code))
    .sort();

/** The answered codes of one kind (for the summary), in catalogue order. */
export function answeredOfKind(text: string, items: CatalogueItem[], kind: AmenityKind): CatalogueItem[] {
  const map = decodeAmenities(text);
  return items.filter((item) => item.kind === kind && Object.hasOwn(map, item.code));
}

/** The prefix of a line that says the catalogue is not usable, so no label or kind is guessed from a bare code. */
export const CATALOGUE_LOADING_LINE = "Loading the amenities…";
export const CATALOGUE_UNAVAILABLE_LINE = "The amenities are not available right now.";

/**
 * The map's codes the form must not send: a code the active catalogue does not list AND the latest saved map does not hold. The backend
 * accepts an inactive code only when it is re-sent unchanged from what is stored, so such a code (removed by another session) would make the
 * whole save `invalid`; omitting a code is always allowed. Every other code stays exactly as it was.
 */
export function pruneStale(text: string, latestText: string, items: CatalogueItem[]): string {
  const map = decodeAmenities(text);
  const latest = decodeAmenities(latestText);
  for (const code of Object.keys(map)) {
    if (!items.some((item) => item.code === code) && !Object.hasOwn(latest, code)) delete map[code];
  }
  return encodeAmenities(map);
}

/**
 * The answers as one line for "Latest saved": grouped by kind in the catalogue's order ("Nearby (Seller-declared)" is told apart from the
 * community items), then "Other" for codes the catalogue does not hold. Never called with a catalogue that is not ready.
 */
export function amenityGroupedSummary(text: string, items: CatalogueItem[]): string {
  const map = decodeAmenities(text);
  if (Object.keys(map).length === 0) return NOT_ANSWERED_TEXT;
  const states = (codes: string[]) =>
    (["present", "none"] as const)
      .map((state) => {
        const names = codes.filter((code) => map[code] === state).map((code) => amenityLabel(code, items));
        return names.length > 0 ? `${STATE_TEXT[state]}: ${names.join(", ")}.` : "";
      })
      .filter(Boolean)
      .join(" ");
  const parts = KIND_ORDER.map((kind) => {
    const codes = answeredOfKind(text, items, kind).map((entry) => entry.code);
    return codes.length > 0 ? `${KIND_TITLES[kind]}${kind === "nearby" ? " (Seller-declared)" : ""}: ${states(codes)}` : "";
  });
  const other = otherCodes(text, items);
  if (other.length > 0) parts.push(`Other: ${states(other)}`);
  return parts.filter(Boolean).join(" ");
}

import { isListingId } from "./listing-labels";

/** The shape and parser of a public reference list (cities, localities), shared by the client hooks and server components. */
export type RefItem = { id: string; name: string; kind: "area" | "society" | null };
/** `idle`: nothing to load yet (no city chosen). */
export type RefStatus = "idle" | "loading" | "ready" | "empty" | "error";
export type RefList = { status: RefStatus; items: RefItem[] };
/**
 * Fail-closed parsing: the body must hold an `items` list; an item needs a canonical uuid, a non-empty name of at most 80 characters and
 * (localities) a kind of `area` or `society`; a repeated id is dropped. A list with items where none is usable is an error.
 */
export function readReferenceItems(data: unknown, withKind: boolean): RefList {
  const raw = typeof data === "object" && data !== null ? (data as { items?: unknown }).items : undefined;
  if (!Array.isArray(raw)) return { status: "error", items: [] };
  if (raw.length === 0) return { status: "empty", items: [] };
  const seen = new Set<string>();
  const items: RefItem[] = [];
  for (const entry of raw) {
    const { id, name, kind } = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    if (typeof id !== "string" || !isListingId(id) || seen.has(id)) continue;
    if (typeof name !== "string" || name.trim() === "" || Array.from(name.trim()).length > 80) continue; // the limit counts code points of the trimmed name
    if (withKind && kind !== "area" && kind !== "society") continue;
    seen.add(id);
    items.push({ id, name: name.trim(), kind: withKind ? (kind as "area" | "society") : null });
  }
  return items.length > 0 ? { status: "ready", items } : { status: "error", items: [] };
}

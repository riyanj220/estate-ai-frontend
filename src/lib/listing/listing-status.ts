/**
 * The Listing lifecycle (Story 2.17): the six statuses, the order the My listings tabs use, the counts answer and the actions an owner
 * may take. The backend decides every rule (the transition table, the purpose rule, the Suspended limits); this file only names things
 * and reads the counts defensively.
 */
export const LISTING_STATUSES = ["draft", "published", "archived", "sold", "rented", "removed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
/** The tabs of My listings, left to right. */
export const TAB_ORDER: readonly ListingStatus[] = LISTING_STATUSES;
/** The tab opened when the address names none: the first one that is not empty, in this order. */
export const DEFAULT_TAB_ORDER: readonly ListingStatus[] = ["published", "draft", "archived", "sold", "rented", "removed"];
export const TAB_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
  sold: "Sold",
  rented: "Rented",
  removed: "Removed",
};
export const isListingStatus = (value: unknown): value is ListingStatus => typeof value === "string" && (LISTING_STATUSES as readonly string[]).includes(value);

export type Counts = Record<ListingStatus, number>;

/** The counts answer; null when it is not an object of six non-negative integers. */
export function readCounts(data: unknown): Counts | null {
  if (typeof data !== "object" || data === null) return null;
  const counts = {} as Counts;
  for (const status of LISTING_STATUSES) {
    const value = (data as Record<string, unknown>)[status];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
    counts[status] = value;
  }
  return counts;
}

export const totalOf = (counts: Counts): number => LISTING_STATUSES.reduce((sum, status) => sum + counts[status], 0);

/** The first non-empty status in the default order; Published when every count is zero or the counts are unknown. */
export function defaultTab(counts: Counts | null): ListingStatus {
  if (!counts) return "published";
  return DEFAULT_TAB_ORDER.find((status) => counts[status] > 0) ?? "published";
}

/** The statuses an owner can move a Listing to here. */
export type StatusTarget = "archived" | "sold" | "rented";

/**
 * The actions the Actions section offers: Archive for a Published, Sold or Rented Listing (also a restricted one), "Mark as sold" and
 * "Mark as rented" for a Published one only and only for its purpose; a Suspended owner may only archive; a restricted Listing may only be
 * archived. Anything else (Draft, Archived, Removed) has none. The backend refuses what this offers wrongly.
 */
export function targetsFor(status: string | null, purpose: string | null, restricted: boolean, suspended: boolean): StatusTarget[] {
  if (status !== "published" && status !== "sold" && status !== "rented") return [];
  const targets: StatusTarget[] = ["archived"];
  if (status === "published" && !restricted && !suspended) {
    if (purpose === "sale") targets.push("sold");
    if (purpose === "rent") targets.push("rented");
  }
  return targets;
}

/** Whether an owner may edit a Listing in this status: Draft, Published and Archived, and never a restricted one (view only). */
export const isEditableListing = (status: string | null, restricted: boolean): boolean => !restricted && (status === "draft" || status === "published" || status === "archived");

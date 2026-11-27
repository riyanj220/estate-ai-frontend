import { amenitySummary, type CatalogueItem } from "@/lib/amenities";
import { detailLabel } from "@/lib/listing-details";
import { choiceLabel, formatArea, formatPrice, label, type ListingView } from "@/lib/listing-labels";
import type { Registry } from "@/lib/use-registry";

/** The review of a Draft (Story 5.12): which values the owner checks, how they read, and the fixed sentences. */
export const SENSITIVE_FIELDS = ["purpose", "category", "subtype", "asking_price", "locality", "area_value", "area_unit"];

export const NOT_A_DRAFT_REVIEW = "Only a draft needs a review.";
export const CHANGED_ELSEWHERE = "This listing changed meanwhile. Check the values again.";
export const CONFIRM_REFUSED = "That value could not be confirmed. Check it in the form.";
export const DESCRIPTION_SAVED = "Your description was saved.";
export const DESCRIPTION_REFUSED = "The description could not be saved. Use plain text without phone numbers, email addresses or links.";
export const DESCRIPTION_WRITTEN = "A description was written from your confirmed details. Check it, then keep it or edit it.";
export const DESCRIPTION_NOTHING = "Fill in and confirm some details first.";
export const DESCRIPTION_FAILED = "A description could not be written right now. Confirm more details, try again later or write it yourself.";
/** Why the assistant gave no description (Story 5.15); `error` also covers an answer that could not be used. */
export const DESCRIPTION_OUTCOMES: Record<string, string> = {
  fallback: "The assistant is unavailable right now. Write the description yourself or try again later.",
  timeout: "The assistant took too long. Write the description yourself or try again.",
  budget_exhausted: "Today's AI capacity is used up. Write the description yourself or try again tomorrow.",
};
export const WRITE_YOURSELF = "You can write the description yourself.";
export const DESCRIPTION_OWN = "You have your own description. Writing a new one replaces it.";

const NAMES: Record<string, string> = {
  purpose: "Purpose",
  category: "Category",
  subtype: "Subtype",
  title: "Title",
  asking_price: "Asking price (PKR)",
  price_basis: "Price basis",
  rental_period: "Rental period",
  area_value: "Area",
  area_unit: "Area unit",
  marla_basis: "Marla size",
  city: "City",
  locality: "Locality",
  amenities: "Amenities",
  description: "Description",
};
export const reviewName = (id: string, category: string | null): string => (Object.hasOwn(NAMES, id) ? NAMES[id] : detailLabel(id, category));

export type Names = { city: string | null; locality: string | null; amenities: CatalogueItem[] };

const rawValue = (listing: ListingView, id: string): string | null =>
  (listing.fields as Record<string, string | null>)[id] ?? listing.details[id] ?? null;

/** The value as text, or null when the Listing has none. */
export function reviewValue(listing: ListingView, id: string, names: Names): string | null {
  const value = rawValue(listing, id);
  if (value === null) return null;
  if (id === "asking_price") return formatPrice(value);
  if (id === "area_value") return formatArea(value);
  if (id === "city") return names.city ?? "Chosen city";
  if (id === "locality") return names.locality ?? "Chosen locality";
  if (id === "amenities") return amenitySummary(value, names.amenities);
  if (["title", "society", "phase", "sector", "block"].includes(id)) return value;
  if (value === "true" || value === "false") return value === "true" ? "Yes" : "No";
  if (["purpose", "category", "subtype"].includes(id)) return label(value);
  return /^[a-z_]+$/.test(value) || id === "marla_basis" ? choiceLabel(id, value) : value;
}

/** The required values, the sensitive ones and every value the assistant filled in that is not confirmed. */
export function reviewFields(listing: ListingView, registry: Registry, unconfirmed: string[]): string[] {
  const { purpose, category, subtype } = listing.fields;
  return registry
    .fieldList()
    .filter((def) => !def.derived && def.id !== "description" && def.appliesTo(purpose, category, subtype))
    .filter((def) => def.requirement === "required_for_publication" || SENSITIVE_FIELDS.includes(def.id) || unconfirmed.includes(def.id))
    .map((def) => def.id);
}

/** The ids of the values whose provenance says they are not confirmed. */
export function readUnconfirmed(data: unknown): string[] {
  const provenance = (data as { provenance?: unknown } | null)?.provenance;
  if (typeof provenance !== "object" || provenance === null) return [];
  return Object.entries(provenance)
    .filter(([, entry]) => (entry as { confirmed?: unknown } | null)?.confirmed === false)
    .map(([id]) => id);
}

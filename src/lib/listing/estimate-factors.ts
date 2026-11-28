import type { ListingView } from "./listing-labels";

// The details the price model reads (the backend's valuation features), in the order buyers care about.
const DETAILS: [string, string][] = [
  ["bedrooms", "Bedrooms"],
  ["bathrooms", "Bathrooms"],
  ["covered_area", "Covered area"],
  ["construction_year", "Construction year"],
  ["condition", "Condition"],
  ["corner", "Corner plot"],
  ["road_width", "Road width"],
  ["development_status", "Development status"],
];

/** Which of this Listing's own details the estimate used, as short labels. */
export function estimateFactors(listing: ListingView): string[] {
  const fields = listing.fields as Record<string, unknown>;
  const details = listing.details as Record<string, unknown>;
  const given = (key: string) => Boolean(details[key] ?? fields[key]);
  const found = ["Property type", "Locality", "Area"];
  for (const [key, text] of DETAILS) if (given(key)) found.push(text);
  if (listing.details.amenities) found.push("Amenities");
  return found;
}

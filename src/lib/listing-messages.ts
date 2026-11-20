/**
 * Human text for the codes the backend reports in `error.fields` when a Draft is started, and for the other answers of
 * the listing pages. The frontend only presents them; the rules are the backend's.
 */
export const PURPOSE_MESSAGES: Record<string, string> = {
  required: "Choose a purpose.",
  invalid: "Choose a purpose from the list.",
  invalid_choice: "Choose a purpose from the list.",
};
export const CATEGORY_MESSAGES: Record<string, string> = {
  required: "Choose a category.",
  invalid: "Choose a category from the list.",
  invalid_choice: "Choose a category from the list.",
};
export const SUBTYPE_MESSAGES: Record<string, string> = {
  required: "Choose a subtype.",
  invalid: "Choose a subtype from the list.",
  invalid_choice: "Choose a subtype from the list.",
  subtype_not_in_category: "This subtype does not belong to the chosen category. Choose another subtype.",
};

export const LISTING_FIELD_MESSAGES = {
  purpose: PURPOSE_MESSAGES,
  category: CATEGORY_MESSAGES,
  subtype: SUBTYPE_MESSAGES,
} as const;

export const CREATE_FORBIDDEN = "Your account cannot create listings right now.";
export const DRAFT_CAP = "You have reached the limit of open drafts. Finish or remove one before starting another.";
export const LISTINGS_UNAVAILABLE = "Listings are available for individual and agency accounts.";
export const LISTINGS_NOT_AVAILABLE_NOW = "Listings are not available for this account right now.";
export const LISTING_NOT_FOUND = "We could not find that listing.";
export const LOAD_MORE_FAILED = "We could not load more listings. Try again.";

export const LISTINGS_PATH = "/account/listings";
export const NEW_LISTING_PATH = "/account/listings/new";

/** Where a person whose session ended goes: the administrator door for an administrator, else the sign-in that returns to `next`. */
export function signInPathFor(next: string, admin: boolean): string {
  return admin ? "/admin/sign-in?next=%2Fadmin" : `/sign-in?next=${encodeURIComponent(next)}`;
}

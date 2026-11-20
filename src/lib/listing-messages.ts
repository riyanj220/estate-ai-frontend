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

/**
 * The codes the backend reports per editable field when a Draft is saved (Story 2.2). Known codes only: anything else
 * (an unknown code, a sentence, a prototype key) becomes the generic text, never the server's own words.
 */
const NOT_EDITABLE = "This detail cannot be changed here.";
export const CONTACT_DETAILS = "Titles and descriptions cannot contain phone numbers, email addresses or street addresses.";
export const TITLE_MESSAGES: Record<string, string> = {
  required: "Enter a title.",
  invalid: "The title contains characters that are not allowed. Remove them and try again.",
  too_short: "The title is too short. Check the length shown above.",
  too_long: "The title is too long. Check the length shown above.",
  contains_contact_details: CONTACT_DETAILS,
  not_editable: NOT_EDITABLE,
};
export const DESCRIPTION_MESSAGES: Record<string, string> = {
  required: "Enter a description.",
  invalid: "The description contains characters that are not allowed. Remove them and try again.",
  too_short: "The description is too short. Check the length shown above.",
  too_long: "The description is too long. Check the length shown above.",
  contains_contact_details: CONTACT_DETAILS,
  not_editable: NOT_EDITABLE,
};
export const PRICE_MESSAGES: Record<string, string> = {
  required: "Enter an asking price.",
  invalid: "Enter digits only, with an optional decimal point. Do not use commas or currency signs, for example 1500000 or 1500000.50.",
  invalid_price: "Enter an amount above zero within the limits shown above, with at most two decimal places.",
  not_editable: NOT_EDITABLE,
};
export const PRICE_BASIS_MESSAGES: Record<string, string> = {
  required: "Choose a price basis.",
  invalid: "Choose a price basis from the list.",
  invalid_choice: "Choose a price basis from the list.",
  not_applicable: "A price basis does not apply to this listing.",
  not_editable: NOT_EDITABLE,
};
export const RENTAL_PERIOD_MESSAGES: Record<string, string> = {
  required: "Choose a rental period.",
  invalid: "Choose a rental period from the list.",
  invalid_choice: "Choose a rental period from the list.",
  not_applicable: "A rental period applies only to rentals.",
  not_editable: NOT_EDITABLE,
};
export const EDIT_FIELD_MESSAGES = {
  title: TITLE_MESSAGES,
  description: DESCRIPTION_MESSAGES,
  asking_price: PRICE_MESSAGES,
  price_basis: PRICE_BASIS_MESSAGES,
  rental_period: RENTAL_PERIOD_MESSAGES,
} as const;

export const EDIT_FORBIDDEN = "Your account cannot edit listings right now.";
export const SAVED = "Saved";
export const NO_CHANGES = "No changes to save.";
export const CONFLICT_BANNER =
  "This draft was changed in another session. We loaded the latest version; your unsaved changes are still in the form. Review them and save again.";
export const ALREADY_SAVED = "Your changes are already saved.";
export const CHOICES_APPLIED = "Your choices are applied. Save to keep them.";
export const LATEST_NOT_LOADED = "We could not load the latest version. Your changes are still in the form. Try saving again.";

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

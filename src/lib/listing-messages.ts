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
  invalid_price: "Enter an amount within the limits shown above, with at most two decimal places.",
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
export const AREA_VALUE_MESSAGES: Record<string, string> = {
  required: "Enter an area.",
  invalid: "Enter digits only, with an optional decimal point. Do not use commas, signs or units, for example 1200 or 10.5.",
  invalid_area: "Enter an area above zero within the limits shown above, with no more decimal places than allowed.",
  not_editable: NOT_EDITABLE,
};
export const AREA_UNIT_MESSAGES: Record<string, string> = {
  required: "Choose a unit.",
  invalid: "Choose a unit from the list.",
  invalid_choice: "Choose a unit from the list.",
  not_applicable: "An area unit does not apply to this listing.",
  not_editable: NOT_EDITABLE,
};
export const MARLA_BASIS_MESSAGES: Record<string, string> = {
  required: "Choose the marla size.",
  invalid: "Choose a marla size from the list.",
  invalid_choice: "Choose a marla size from the list.",
  not_applicable: "A marla size applies only when the unit is marla or kanal.",
  not_editable: NOT_EDITABLE,
};
export const MARLA_EXPLANATION =
  "A marla is not the same size everywhere. Tell us how many square feet your marla is. If you leave it unknown you can still publish, but your listing will not appear when buyers filter by area and it will have no price estimate.";
export const EDIT_FIELD_MESSAGES = {
  title: TITLE_MESSAGES,
  description: DESCRIPTION_MESSAGES,
  asking_price: PRICE_MESSAGES,
  price_basis: PRICE_BASIS_MESSAGES,
  rental_period: RENTAL_PERIOD_MESSAGES,
  area_value: AREA_VALUE_MESSAGES,
  area_unit: AREA_UNIT_MESSAGES,
  marla_basis: MARLA_BASIS_MESSAGES,
} as const;

/**
 * The codes the backend reports for a registry detail (Story 2.4 on), by registry field type, so a new registry field needs no
 * message of its own. Known codes only, like every other map here: anything else becomes the generic text.
 */
const DETAIL_NOT_APPLICABLE = "This detail does not apply to this listing.";
export const DETAIL_MESSAGES: Record<string, Record<string, string>> = {
  integer: {
    required: "Enter a whole number.",
    invalid: "Enter a whole number, digits only, for example 3.",
    invalid_range: "Enter a whole number within the allowed range.",
    invalid_floor: "The floor cannot be above the number of floors in the building. Check both numbers.",
    not_applicable: DETAIL_NOT_APPLICABLE,
    not_editable: NOT_EDITABLE,
  },
  boolean: {
    required: "Choose Yes or No.",
    invalid: "Choose Yes, No or Not answered.",
    invalid_choice: "Choose Yes, No or Not answered.",
    not_applicable: DETAIL_NOT_APPLICABLE,
    not_editable: NOT_EDITABLE,
  },
  enum: {
    required: "Choose an option.",
    invalid: "Choose an option from the list.",
    invalid_choice: "Choose an option from the list.",
    not_applicable: DETAIL_NOT_APPLICABLE,
    not_editable: NOT_EDITABLE,
  },
  decimal: {
    required: "Enter an amount above zero.",
    invalid: "Enter digits only, with an optional decimal point. Do not use commas, signs or units, for example 1200 or 10.5.",
    invalid_area: "Enter an amount above zero within the allowed range, with no more decimal places than allowed.",
    invalid_measure: "Enter a number above zero within the allowed range, using digits and an optional decimal point.",
    not_applicable: DETAIL_NOT_APPLICABLE,
    not_editable: NOT_EDITABLE,
  },
  money: {
    required: "Enter an amount.",
    invalid: "Enter digits only, with an optional decimal point. Do not use commas or currency signs, for example 2500 or 2500.50.",
    invalid_price: "Enter an amount within the allowed range, with at most two decimal places.",
    not_applicable: DETAIL_NOT_APPLICABLE,
    not_editable: NOT_EDITABLE,
  },
  date: {
    required: "Enter a date.",
    invalid: "Enter a real date written year-month-day, for example 2027-03-01.",
    invalid_date: "Enter a date within the allowed range shown above.",
    not_applicable: DETAIL_NOT_APPLICABLE,
    not_editable: NOT_EDITABLE,
  },
  // Story 2.8: the amenity map has one code, `invalid` (an item that is not offered, another state, too many answers).
  amenities: {
    required: "Choose your amenities.",
    invalid: "One of the amenity choices could not be saved. Check your choices and try again.",
    not_applicable: DETAIL_NOT_APPLICABLE,
    not_editable: NOT_EDITABLE,
  },
};

/**
 * The location fields (Story 2.7), by registry field: known codes only, with the client's own text. The real API's sentences were already
 * turned into codes where the error body was read (`error-sentences.ts`).
 */
const LOCATION_COMMON: Record<string, string> = { not_applicable: DETAIL_NOT_APPLICABLE, not_editable: NOT_EDITABLE };
const LOCATION_TEXT: Record<string, string> = {
  ...LOCATION_COMMON,
  invalid: "This text contains characters that are not allowed. Remove them and try again.",
  too_long: "This text is too long. Check the limit shown above.",
  too_short: "This text is too short.",
  contains_contact_details: "This text cannot contain phone numbers, email addresses or street addresses.",
};
const COORDINATE_RULE = "Enter a decimal number such as 24.860000. Latitude and longitude go together.";
export const LOCATION_MESSAGES: Record<string, Record<string, string>> = {
  city: { ...LOCATION_COMMON, required: "Choose a city.", invalid: "Choose a city from the list.", invalid_choice: "Choose a city from the list." },
  locality: {
    ...LOCATION_COMMON,
    required: "Choose a locality.",
    invalid: "Choose a locality from the list.",
    invalid_choice: "Choose a locality from the list.",
    locality_not_in_city: "Choose a locality that belongs to the selected city.",
  },
  text: LOCATION_TEXT,
  latitude: { ...LOCATION_COMMON, invalid: COORDINATE_RULE, out_of_range: "Latitude must be between -90 and 90, with at most 6 decimal places." },
  longitude: { ...LOCATION_COMMON, invalid: COORDINATE_RULE, out_of_range: "Longitude must be between -180 and 180, with at most 6 decimal places." },
};
/** The codes of a location field as the client's own text; anything not known (a prototype key, another sentence) is `fallback`. */
export function mapLocationCodes(id: string, type: string, values: string[], fallback: string): string[] {
  const map = Object.hasOwn(LOCATION_MESSAGES, id) ? LOCATION_MESSAGES[id] : Object.hasOwn(LOCATION_MESSAGES, type) ? LOCATION_MESSAGES[type] : {};
  const text = values.map((value) => {
    return Object.hasOwn(map, value) ? map[value] : fallback;
  });
  return [...new Set(text)];
}

/** `invalid` on the locality while no city is chosen. */
export const LOCALITY_NEEDS_CITY = "Choose a city first.";
export const ANOTHER_LOCALITY = "Another locality";
export const LOCALITY_DROPPED = "The locality was replaced because the city was changed in another session.";
export const LOADING_VALUE = "Loading…";
export const CITIES_LOADING = "Loading cities…";
export const CITIES_EMPTY = "No cities are available right now.";
export const CITIES_FAILED = "We could not load the list of cities.";
export const LOCALITIES_LOADING = "Loading localities…";
export const LOCALITIES_EMPTY = "No localities are listed for this city.";
export const LOCALITIES_FAILED = "We could not load the localities.";
export const CHOOSE_CITY_FIRST = "Choose a city first";
export const SAVED_CHOICE_GONE = "Saved choice (not in the current list)";
export const LOCALITY_CLEARED = "The locality was cleared because the city changed. Choose a locality for the new city.";

export const AMENITIES_LOADING = "Loading the amenities…";
export const AMENITIES_LOADED = "The amenities are loaded.";
export const AMENITIES_EMPTY = "No amenities are available right now.";
export const AMENITIES_FAILED = "We could not load the list of amenities.";

export const INCOMPLETE_DATE = "Finish the date or clear it.";
export const EDIT_FORBIDDEN = "Your account cannot edit listings right now.";
export const SAVED = "Saved";
export const NO_CHANGES = "No changes to save.";
export const CONFLICT_BANNER =
  "This draft was changed in another session. We loaded the latest version; your unsaved changes are still in the form. Review them and save again.";
export const DETAILS_DROPPED = "Some details no longer apply to this draft, so your changes to them were dropped.";
export const BASIS_DROPPED = "The marla size no longer applies because the unit changed in another session.";
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

// ---- Images (Story 2.10). Known codes only: anything else is the generic text, never the server's own words.
export const MAX_IMAGES = 10;
export const IMAGES_EMPTY = "No images yet. A listing can be saved as a Draft without images, but needs at least one to be published.";
export const IMAGES_HINT = "JPEG, PNG or WebP, up to 5 MB each, up to 10 images. The first image you add becomes the cover.";
export const IMAGES_LIMIT_REACHED = "A listing can have at most 10 images.";
export const IMAGES_CONFLICT = "Your images were changed in another session. We loaded the latest order.";
export const IMAGES_FORBIDDEN = "Your account cannot change images right now.";
export const IMAGES_UNREADABLE = "We could not read the answer. Reload the page to see your images.";
export const IMAGES_REFRESH_FAILED = "We could not check your images. Reload the page to see the latest.";
export const IMAGES_ALREADY_GONE = "That image is already gone. We loaded the latest images.";
export const IMAGES_ONE_AT_A_TIME = "Wait for the current action to finish.";

/** The codes of `error.fields.file` for an upload (a 400), by code. */
export const UPLOAD_FILE_MESSAGES: Record<string, string> = {
  too_large: "Images must be 5 MB or smaller.",
  unsupported_type: "Only JPEG, PNG and WebP images can be added.",
  too_large_dimensions: "This image is too large in pixels. Use one up to 10,000 pixels on each side.",
  too_small: "This image is too small. Each side must be at least 200 pixels.",
  invalid_image: "This file could not be read as an image.",
  required: "Choose an image file.",
  invalid: "Choose an image file.",
};
/** The codes of a 409 on an upload (`error.code`). */
export const UPLOAD_CONFLICT_MESSAGES: Record<string, string> = {
  storage_cap_exceeded: "You have used all of your image storage. Delete an image to upload more.",
  too_many_images: IMAGES_LIMIT_REACHED,
};
export const UPLOAD_BUSY = "Images are busy being processed.";
/** The codes of `error.fields.order` and `error.fields.cover_id` for a reorder (a 400). */
export const ORDER_CHANGED = "The images changed. We loaded the latest order, so try again.";
export const IMAGES_LIST_FULL = "Not added: the list is full.";
export const IMAGES_UNKNOWN = "It may have been added: check the list.";
export const IMAGE_LOAD_FAILED = "This image could not be loaded.";
export const SAVE_PAUSED = "Saving is paused while images are being changed.";
export const SAVE_WAIT = "Wait for the image changes to finish, then save.";
/** The most a single upload body may be (the backend's cap); a bigger file is refused here and never sent. */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

// ---- Draft preview and delete (Story 2.13).
export const PREVIEW_BANNER = "This is a preview. Only you can see it.";
export const ESTIMATE_NOT_AVAILABLE = "Not available yet";
export const PREVIEW_DETAILS_FAILED = "We could not load the labels for the details of this listing.";
export const PREVIEW_NO_IMAGES = "This listing has no images yet.";
export const DELETE_DRAFT_LABEL = "Delete draft";
export const DELETE_DRAFT_TITLE = "Delete this draft?";
export const DELETE_DRAFT_TEXT = "This deletes the draft and its images. This cannot be undone.";
export const DELETE_DRAFT_DONE = "Draft deleted.";
export const DELETE_DRAFT_GONE = "That draft was already deleted.";
export const DELETE_DRAFT_PUBLISHED = "A published listing cannot be deleted here.";
export const DELETE_DRAFT_FORBIDDEN = "Your account cannot delete listings right now.";
export const DELETE_DRAFT_WAIT = "Wait for the current save or image change to finish, then delete the draft.";
export const DELETE_DRAFT_PAUSED = "Saving and image changes are paused while the draft is deleted.";
export const DELETE_DRAFT_NAV_FAILED = "The draft was deleted, but My listings could not be opened. Use the link at the bottom of the page.";
export const PREVIEW_SAVED_HINT = "Preview shows your saved changes.";
export const NO_LONGER_DRAFT = "This listing is no longer a draft, so it cannot be edited or deleted here.";

// ---- Publishing (Story 2.15).
export const PUBLISH_TITLE = "Publish";
export const PUBLISH_TEXT = "Publishing makes this listing visible to everyone immediately. It uses 1 of your monthly publications.";
export const PUBLISH_LABEL = "Publish listing";
export const PUBLISH_SAVE_FIRST = "Save your changes before publishing";
export const PUBLISH_WAIT = "Wait for the current save or image change to finish, then publish.";
export const PUBLISH_PAUSED = "Saving, editing and image changes are paused while the listing is published.";
export const PUBLISH_WORKING = "Publishing the listing…";
export const PUBLISH_DONE = "Your listing is published. It is now visible to everyone.";
export const PUBLISH_ERRORS_ANNOUNCE = "The listing cannot be published yet. Review the list at the top of the page.";
export const PUBLISH_ELSEWHERE = "This listing is already published. We loaded the latest version.";
export const PUBLISH_EMAIL_UNVERIFIED = "Verify your email to publish.";
export const PUBLISH_UNAVAILABLE = "Your account cannot publish right now.";
export const PUBLISH_FAILED = "We could not publish the listing. Try again.";
export const PUBLISH_UNSURE = "We could not confirm whether the listing was published. Retrying is safe: it never publishes twice.";
export const PUBLISH_ALLOWANCE_CHECKING = "Checking your remaining publications…";
export const PUBLISH_ALLOWANCE_FAILED = "We could not check your remaining publications.";
export const IMAGES_REQUIRED_ERROR = "Add at least one image.";
export const CONFIRM_REQUIRED_ERROR = "Confirm this value before publishing.";
export const DASHBOARD_PATH = "/dashboard";
export const VERIFY_EMAIL_PATH = "/verify-email";
/** The quota refusal: "You have used all N publications this month. The allowance resets on 1 December 2026." */
export function quotaExhaustedText(limit: number | null, date: string | null): string {
  const used = limit === null ? "You have used all your publications this month." : limit === 1 ? "You have used your 1 publication this month." : `You have used all ${limit} publications this month.`;
  return date ? `${used} The allowance resets on ${date}.` : used;
}
export const CONFIRM_LABEL = "Confirm this value";
export const CONFIRMED = "The value is confirmed.";
export const CONFIRM_NO_CONTROL = "This value was filled in for you and has not been confirmed. It cannot be confirmed on this page.";
export const PUBLISH_FORM_LOADING = "Publishing is available when the form has loaded.";
export const PUBLISH_FORM_UNAVAILABLE = "Publishing is not available until the form has loaded. Use Retry in the Edit details section.";
// ---- Republication (Story 2.18).
export const REPUBLISH_TITLE = "Republish";
export const REPUBLISH_TEXT =
  "Republishing makes this listing visible to everyone again. It uses 1 of your monthly publications unless you republish in the same month as your last counted publication without changing the category, subtype, purpose, city, locality, area value or area unit.";
export const REPUBLISH_LABEL = "Republish listing";
export const REPUBLISH_SAVE_FIRST = "Save your changes before republishing";
export const REPUBLISH_WAIT = "Wait for the current save or image change to finish, then republish.";
export const REPUBLISH_WORKING = "Republishing the listing…";
export const REPUBLISH_DONE_COUNTED = "Republished. This used 1 of your publications.";
export const REPUBLISH_DONE_FREE = "Republished. This did not use any of your publications.";
export const REPUBLISH_DONE_UNKNOWN = "Republished. Your listing is visible to everyone again.";
export const REPUBLISH_ERRORS_ANNOUNCE = "The listing cannot be republished yet. Review the list at the top of the page.";
export const REPUBLISH_EMAIL_UNVERIFIED = "Verify your email to republish.";
export const REPUBLISH_FAILED = "We could not republish the listing. Try again.";
export const REPUBLISH_UNSURE = "We could not confirm whether the listing was republished. Retrying is safe: it never republishes twice.";
export const REPUBLISH_CHANGED = "The form changed while republishing was starting. Check it and try again.";
export const REPUBLISH_FORM_LOADING = "Republishing is available when the form has loaded.";
export const REPUBLISH_FORM_UNAVAILABLE = "Republishing is not available until the form has loaded. Use Retry in the Edit details section.";
export const REPUBLISH_FORBIDDEN = "This listing cannot be republished.";
/** A republication that found the listing in another status: what it is now and why Republish is gone. */
export const republishGoneText = (now: string): string => `This listing is now ${now}, so it cannot be republished any more. We loaded the latest version.`;
export const REPUBLISH_ARCHIVE_FIRST = "Archive this listing first to republish it.";
export const PUBLISH_CHANGED = "The form changed while publishing was starting. Check it and try again.";

// ---- The Listing lifecycle (Story 2.17).
export const STATUS_ACTIONS: Record<"archived" | "sold" | "rented", { label: string; title: string; text: string; working: string; done: string }> = {
  archived: {
    label: "Archive",
    title: "Archive this listing?",
    text: "Archiving removes this listing from public view. You can republish it later, which may use one of your monthly publications. You will still find it in My listings under Archived.",
    working: "Archiving the listing…",
    done: "The listing is archived. It is no longer visible to the public.",
  },
  sold: {
    label: "Mark as sold",
    title: "Mark this listing as sold?",
    text: "This removes the listing from public view and records it as sold. This cannot be undone. You will still find it in My listings under Sold, but it can no longer be edited.",
    working: "Marking the listing as sold…",
    done: "The listing is marked as sold. It is no longer visible to the public.",
  },
  rented: {
    label: "Mark as rented",
    title: "Mark this listing as rented?",
    text: "This removes the listing from public view and records it as rented. This cannot be undone. You will still find it in My listings under Rented, but it can no longer be edited.",
    working: "Marking the listing as rented…",
    done: "The listing is marked as rented. It is no longer visible to the public.",
  },
};
/** Archiving a Sold or Rented listing: it is already hidden from the public, so the dialog does not say it will be. */
export const ARCHIVE_ENDED_TEXT = "Archiving moves this listing to Archived. It is already hidden from the public. You can republish it from there.";
export const STATUS_TITLE = "Change the status";
export const STATUS_INTRO = "These actions take the listing out of public view.";
export const STATUS_WAIT = "Wait for the current save or image change to finish, then try again.";
export const STATUS_SAVE_FIRST = "Save your changes before you change the status of this listing.";
export const STATUS_PAUSED = "Saving and image changes are paused while the status changes.";
export const STATUS_FORBIDDEN_SUSPENDED = "Your account can only archive listings right now.";
export const STATUS_FORBIDDEN = "The status of this listing cannot be changed right now.";
export const STATUS_FAILED = "We could not change the status of this listing. Try again.";
export const STATUS_UNSURE = "We could not confirm the new status. Reload the page to see the latest.";
export const STATUS_CONFLICT_NOT_LOADED = "This listing has changed. We could not load the latest version: reload the page.";
const STATUS_VERBS = { archived: "archived", sold: "marked as sold", rented: "marked as rented" } as const;
/** What changed under a status action that did not go through: the listing's status now, and whether the move is still possible. */
export function statusChangedText(now: string, target: "archived" | "sold" | "rented", allowed: boolean): string {
  return allowed
    ? `This listing was changed in another session and is now ${now}. We loaded the latest version: you can try again.`
    : `This listing is now ${now}, so it cannot be ${STATUS_VERBS[target]} any more. We loaded the latest version.`;
}
/** A stale save or a refused edit revealed a listing that cannot be edited: what happened to the typed changes. */
export function lostEditsText(now: string, hadChanges: boolean): string {
  return `This listing is now ${now} and can no longer be edited.${hadChanges ? " Your unsaved changes could not be kept." : ""}`;
}
export const PUBLISHED_IDENTITY_NOTE = "These details cannot be changed while the listing is published.";
export const IDENTITY_LOCKED_ERROR = "This detail cannot be changed while the listing is published.";
export const ARCHIVED_NOTE = "This listing is archived and not visible to the public. Use the Republish section below to make it visible again.";
export const LAST_IMAGE_NOTE = "A published listing needs at least one image, so its last image cannot be deleted.";
export const READ_ONLY_NOTES: Record<string, string> = {
  sold: "This listing is sold. It is view only and cannot be edited.",
  rented: "This listing is rented. It is view only and cannot be edited.",
  removed: "This listing was removed. It is view only and cannot be changed.",
};
export const RESTRICTED_NOTE = "This listing is restricted. It is not visible to the public and is view only: it cannot be edited.";
export const READ_ONLY_FALLBACK = "This listing cannot be edited here.";
export const restrictionReasonText = (reason: string): string => `Reason: ${reason}`;
export const noTabListings = (label: string): string => `You have no ${label.toLowerCase()} listings.`;
export const SHOWING_TAB = (label: string): string => `Showing ${label.toLowerCase()} listings.`;

// ---- The one-time correction of locality and area (Story 2.19).
export const CORRECTION_TITLE = "Correct locality or area";
export const CORRECTION_NOTE = "To change the locality or area, archive this listing and republish it.";
export const CORRECTION_INTRO = "If you made a mistake, you can correct the locality or area once, without using a publication.";
export const correctionUntilText = (until: string, left: string): string => `You can do this until ${until} (Karachi time), ${left}.`;
export const CORRECTION_LABEL = "Save correction";
export const CORRECTION_DIALOG_TITLE = "Correct the locality or area?";
export const CORRECTION_DIALOG_TEXT = "This can be done only once for this publication. Check the values before you continue.";
export const CORRECTION_CONFIRM = "Correct now";
export const CORRECTION_WORKING = "Saving the correction…";
export const CORRECTION_DONE = "The locality and area were corrected. No publication was used.";
export const CORRECTION_NO_CHANGE = "Nothing would change. Enter a different locality or area.";
export const CORRECTION_BASIS_ONLY = "To change only the marla size, use the Edit details form above.";
export const CORRECTION_SAVE_FIRST = "Save your changes before you correct the locality or area.";
export const CORRECTION_WAIT = "Wait for the current save or image change to finish, then try again.";
export const CORRECTION_FORM_LOADING = "The correction is available when the form has loaded.";
export const CORRECTION_PAUSED = "Saving and image changes are paused while the correction is saved.";
export const CORRECTION_FAILED = "We could not correct this listing. Try again.";
export const CORRECTION_UNSURE = "We could not confirm whether the correction was saved. Reload the page to see the latest.";
export const CORRECTION_STALE = "This listing was changed in another session. We loaded the latest version: check it and try again.";
export const CORRECTION_CONFLICT = "This listing has changed, so it cannot be corrected now. We loaded the latest version.";
export const CORRECTION_UNAVAILABLE = "The correction window is closed. Archive the listing to change these details.";
export const CORRECTION_FORBIDDEN = "This listing cannot be corrected right now.";
export const CORRECTION_CHECK_FAILED = "We could not check whether the locality or area can still be corrected.";

// AI Price Estimate (Story 4.4).
export const ABOUT_ESTIMATES_PATH = "/about-estimates";
export const ESTIMATE_TITLE = "AI Price Estimate";
export const ESTIMATE_TEXT = "A recommended baseline for your saved details. It never changes your asking price.";
export const ESTIMATE_BUTTON = "Get estimate";
export const ESTIMATE_WORKING = "Getting estimate…";
export const ESTIMATE_SAVE_FIRST = "Save your changes first. The estimate uses the saved details.";
export const ESTIMATE_WAIT = "Wait for the current action to finish.";
export const ESTIMATE_READY = "The estimate is ready.";
export const ESTIMATE_UNAVAILABLE = "Estimate unavailable.";
export const ESTIMATE_NOT_A_DRAFT = "Estimates can only be requested for a draft. Reload the page to see the latest listing.";
export const ESTIMATE_FORBIDDEN = "This account cannot request an estimate right now.";
export const ESTIMATE_VALUE_LABEL = "Estimated Property Value";
export const ESTIMATE_INFO_LABEL = "About this estimate";
export const ESTIMATE_INFO =
  "AI-generated approximation from the listing’s attributes. It is not a verified market valuation or a guaranteed return.";
export const ESTIMATE_ABOUT_LINK = "About AI Price Estimates (opens in a new tab)";

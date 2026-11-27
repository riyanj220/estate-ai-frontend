/**
 * The reverse of the backend's `FIELD_MESSAGES` (`apps/kernel/errors.py`): the real API reports `error.fields` as arrays of static
 * SENTENCES, never codes. `readErrorBody` turns a known sentence into its code once, before any mapper runs, so every mapper (which keys
 * on codes) works against the real wire; a value that is already a code, or a sentence not listed here, passes through unchanged.
 * Where several codes share one sentence the first code is kept (the one the frontend mappers key on). The generated table is checked
 * against the backend file by `tests/e2e/error-sentences.spec.ts` whenever the sibling repository is present.
 */
export const SENTENCE_CODES: Record<string, string> = {
  "This field is required.": "required",
  "This field may not be null.": "null",
  "This field may not be blank.": "blank",
  "This field may not be empty.": "empty",
  "Enter a valid value.": "invalid",
  "Select a valid choice.": "invalid_choice",
  "This value is too long.": "max_length",
  "This value is too short.": "min_length",
  "This value is too large.": "max_value",
  "This value is too small.": "min_value",
  // "This value is too long." is also the sentence of `max_string_length`: both read as `max_length`, the code the mappers key on.
  "This number has too many digits.": "max_digits",
  "This number has too many decimal places.": "max_decimal_places",
  // "This number has too many digits." is also the sentence of `max_whole_digits`: both read as `max_digits`, the code the mappers key on.
  "Expected a list of items.": "not_a_list",
  "Expected an object.": "not_a_dict",
  "This value is already in use.": "unique",
  "Enter a valid date.": "date",
  "Enter a valid date and time.": "datetime",
  "The referenced item does not exist.": "does_not_exist",
  "This subtype does not belong to the selected category.": "subtype_not_in_category",
  "The request contains fields that are not accepted.": "unknown_field",
  "This parameter is not accepted.": "unknown_parameter",
  "Give this parameter only once.": "repeated_parameter",
  "Too many values.": "too_many_values",
  "The upper bound is below the lower bound.": "inverted_range",
  "Enter a valid name without phone numbers or email addresses.": "invalid_name",
  "Enter a valid email address.": "invalid_email",
  "Use at least 8 characters.": "password_too_short",
  "Use at most 1024 characters.": "password_too_long",
  "Administrator passwords need at least 12 characters.": "admin_password_too_short",
  "Administrator passwords must not start or end with whitespace.": "admin_password_whitespace",
  "Administrator passwords need at least one letter and one digit.": "admin_password_weak",
  "This password is too common. Choose a less guessable one.": "password_too_common",
  "The password must not be the same as the email address.": "password_matches_email",
  "The current password is incorrect.": "incorrect",
  "Choose a password different from your current one.": "password_same_as_current",
  "Enter a Pakistani mobile number or a valid international number.": "invalid_phone",
  "Enter an office address of 5 to 300 characters, without line breaks.": "invalid_address",
  "Choose a city from the list.": "invalid_city",
  "Enter a description of up to 1000 characters, or leave it empty.": "invalid_description",
  "This text cannot contain phone numbers, email addresses or street addresses.": "contains_contact_details",
  "This field cannot be changed here.": "not_editable",
  "This field does not apply to this listing.": "not_applicable",
  "This text is too short.": "too_short",
  "This text is too long.": "too_long",
  "The recording is too large. Record a shorter one.": "audio_too_large",
  "Record WebM, Ogg, MP4 or WAV audio.": "audio_type",
  "Enter an amount within the allowed range with at most two decimals.": "invalid_price",
  "Enter an area above zero with at most four decimals, using digits only.": "invalid_area",
  "Enter a number above zero within the allowed range, using digits and an optional decimal point.": "invalid_measure",
  "Enter a date within the allowed range.": "invalid_date",
  "Enter a whole number within the allowed range.": "invalid_range",
  "The image is too large. Use a file of up to 5 MB.": "too_large",
  "Use a JPEG, PNG or WebP image.": "unsupported_type",
  "The image has too many pixels. Use at most 10,000 pixels on a side and 40 megapixels.": "too_large_dimensions",
  "The image is too small. Use at least 200 by 200 pixels.": "too_small",
  "The file is not a usable image.": "invalid_image",
  "Enter a web link that starts with https://, without spaces.": "invalid_url",
  "The floor cannot be above the number of floors in the building.": "invalid_floor",
  "Enter a number within the allowed range, using digits and a decimal point.": "out_of_range",
  "Choose a locality that belongs to the selected city.": "locality_not_in_city",
  "Add at least one image.": "images_required",
  "Nothing would change. Enter a different locality or area.": "no_change",
  "Confirm this value before publishing.": "confirm_required",
  "You wrote this description. Choose to replace it.": "manual_description",
  "Fill in and confirm some details first.": "nothing_confirmed",
};

/** A value of `error.fields` as its code: a known sentence becomes its code, anything else is returned as it came. */
export function codeOfSentence(value: string): string {
  return Object.hasOwn(SENTENCE_CODES, value) ? SENTENCE_CODES[value] : value;
}

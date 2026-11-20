/**
 * Human text for the password codes the backend reports in `error.fields` (registration policy plus the change
 * rules). The frontend only presents them; the rules themselves live in the backend.
 */
export const GENERIC_FIELD_MESSAGE = "Enter a valid value.";

export const POLICY_MESSAGES: Record<string, string> = {
  required: "Enter a password.",
  password_too_short: "Use at least 8 characters.",
  password_too_long: "Use at most 1024 characters.",
  password_matches_email: "The password must not be the same as your email address.",
  password_too_common: "This password is too common. Choose a less guessable one.",
  invalid: "Enter a valid password.",
};

/** Messages for the new password on the change page (policy plus "same as current"). */
export const NEW_PASSWORD_MESSAGES: Record<string, string> = {
  ...POLICY_MESSAGES,
  required: "Enter a new password.",
  password_same_as_current: "Choose a password different from your current one.",
};

/** Messages for the reset page's single password field. */
export const RESET_PASSWORD_MESSAGES: Record<string, string> = { ...POLICY_MESSAGES, required: "Enter a new password." };

/** Messages for the current password on the change page. */
export const CURRENT_PASSWORD_MESSAGES: Record<string, string> = {
  required: "Enter your current password.",
  incorrect: "The current password is not correct.",
  invalid: "Enter your current password.",
};

/** Messages for the email field of the reset request. */
export const EMAIL_MESSAGES: Record<string, string> = {
  required: "Enter your email address.",
  invalid: "Enter a valid email address.",
  invalid_email: "Enter a valid email address.",
};

/**
 * Maps the values of one field to text. A known code gets its text from `map`. The backend's own field messages are
 * static sentences (never echoing input), so a value that is not a code is shown as sent; anything else is generic.
 */
export function mapFieldMessages(values: string[], map: Record<string, string>): string[] {
  const out = values.map((value) => (Object.hasOwn(map, value) ? map[value] : /\s/.test(value) ? value : GENERIC_FIELD_MESSAGE));
  return [...new Set(out)];
}

/**
 * Like `mapFieldMessages` but allow-lists known codes only: anything else (a sentence, an unknown code, a prototype
 * key such as "constructor") becomes `fallback`, never the server's text. Used where a sentence could hint at account data.
 */
export function mapKnownCodes(values: string[], map: Record<string, string>, fallback = GENERIC_FIELD_MESSAGE): string[] {
  return [...new Set(values.map((value) => (Object.hasOwn(map, value) ? map[value] : fallback)))];
}

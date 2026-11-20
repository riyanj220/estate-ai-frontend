import { POLICY_MESSAGES } from "./password-messages";

/**
 * Human text for the codes the registration endpoints report in `error.fields`, per field. The backend owns the rules;
 * this only presents them. Unknown static sentences are shown as sent and anything else becomes a generic message
 * (see `mapFieldMessages`).
 */
export const AGENCY_FIELD_MESSAGES: Record<string, Record<string, string>> = {
  agency_name: {
    required: "Enter the agency name.",
    invalid: "Enter a valid agency name.",
    invalid_name: "Enter a valid agency name. It is shown publicly, so it cannot contain contact details.",
  },
  email: {
    required: "Enter the business email address.",
    invalid: "Enter a valid email address.",
    invalid_email: "Enter a valid email address.",
  },
  phone: {
    required: "Enter the business phone number.",
    invalid: "Enter a valid phone number.",
    invalid_phone: "Enter a valid Pakistani mobile or international number.",
  },
  office_address: {
    required: "Enter the office address.",
    invalid: "Enter a valid office address.",
    invalid_address: "Enter a valid office address.",
  },
  city_id: {
    required: "Select a city.",
    invalid: "Select a city.",
    invalid_city: "That city is no longer available. Select another city.",
  },
  password: POLICY_MESSAGES,
};

/** Form-level codes (the `non_field_errors` key). */
export const GENERAL_FIELD_MESSAGES: Record<string, string> = {
  unknown_field: "The form sent something unexpected. Reload the page and try again.",
};

/**
 * Human text for the codes the profile and email-change endpoints report in `error.fields`, per field (Story 1.20).
 * The backend owns the rules; this only presents them. `current_password` uses `CURRENT_PASSWORD_MESSAGES`.
 */
export const PROFILE_MESSAGES: Record<string, Record<string, string>> = {
  full_name: {
    required: "Enter your full name.",
    invalid: "Enter a valid full name.",
    invalid_name: "Enter your full name using letters only (2 to 80 characters).",
  },
  phone: {
    required: "Enter your phone number.",
    invalid: "Enter a valid phone number.",
    invalid_phone: "Enter a valid Pakistani mobile or international number.",
  },
  new_email: {
    required: "Enter the new email address.",
    invalid: "Enter a valid email address.",
    invalid_email: "Enter a valid email address.",
  },
};

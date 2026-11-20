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

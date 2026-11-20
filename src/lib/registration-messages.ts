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
    // The shared contact-detail check may report this code for the name in future.
    contains_contact_details: "The agency name is shown publicly, so it cannot contain phone numbers, email addresses or street addresses.",
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

/**
 * Human text for the codes the agency business profile endpoint reports in `error.fields`, per field (Story 1.21). The
 * backend owns the rules; this only presents them. Reuses the registration text where the rule is the same.
 */
export const AGENCY_PROFILE_MESSAGES: Record<string, Record<string, string>> = {
  agency_name: AGENCY_FIELD_MESSAGES.agency_name,
  description: {
    invalid: "Enter a valid description.",
    invalid_description:
      "Enter a valid description (up to 1000 characters, with at least one letter or number and no unusual characters).",
    contains_contact_details:
      "Descriptions cannot contain phone numbers, email addresses or street addresses. Your business phone and office address are kept private.",
  },
  city_id: AGENCY_FIELD_MESSAGES.city_id,
  business_phone: {
    required: "Enter the business phone number.",
    invalid: "Enter a valid phone number.",
    invalid_phone: "Enter a valid Pakistani mobile or international number.",
  },
  office_address: AGENCY_FIELD_MESSAGES.office_address,
};

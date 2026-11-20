import type { components } from "@/api/schema";

/** The one definition of the signed-in account summary (what `GET /api/v1/me` returns). */
export type Account = components["schemas"]["ActorSummary"];

/** Short notes for the header, driven only by `state`. Active accounts have none. */
export const STATE_NOTES: Partial<Record<Account["state"], string>> = {
  email_unverified: "Email not verified",
  suspended: "Account restricted",
};

/** Labels for the dashboard's account state line. */
export const STATE_LABELS: Record<Account["state"], string> = {
  email_unverified: "Email not verified",
  active: "Active",
  suspended: "Account restricted",
  deactivated: "Deactivated",
};

/** Agencies are named by their agency name; individuals by their own name; the email is the fallback. */
export function displayName(account: Account): string {
  if (account.account_type === "agency" && account.agency_name) return account.agency_name;
  return account.full_name || account.email;
}

/** Labels for the dashboard's account type line. */
const TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  agency: "Agency",
  admin: "Administrator",
};

/** The label for an account type; an unexpected type is shown as sent rather than hidden. */
export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

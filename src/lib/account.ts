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

export function displayName(account: Account): string {
  return account.full_name || account.email;
}

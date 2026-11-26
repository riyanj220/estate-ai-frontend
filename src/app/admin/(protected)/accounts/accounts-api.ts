import type { components } from "@/api/schema";

export type AdminAccount = components["schemas"]["AdminAccount"];
export type AccountStatus = components["schemas"]["AccountStatus"];

export const SIGN_IN_PATH = `/admin/sign-in?next=${encodeURIComponent("/admin/accounts")}`;
export const NOT_FOUND = "No Individual or Agency account has that email address.";
export const GONE_ACCOUNT = "This account is not available any more. Look it up again.";
export const CHANGED_ELSEWHERE = "The account's state has already changed. Look it up again to see it.";

/** The limits of each reason (the server enforces them; they are checked here first). */
export const LOOKUP_REASON = { min: 10, max: 300 };
export const CHANGE_REASON = { min: 5, max: 500 };

/** The message for a reason code from the server or from the check on the page. */
export function reasonMessage(code: string, { min, max }: { min: number; max: number }): string {
  if (code === "required" || code === "blank") return "Enter a reason.";
  if (code === "too_short" || code === "min_length") return `Use at least ${min} characters.`;
  if (code === "too_long" || code === "max_length") return `Use at most ${max} characters.`;
  if (code === "contains_contact_details") return "Remove phone numbers, email addresses and street addresses from the reason.";
  return "Enter a reason on one line.";
}

export function checkReason(text: string, limits: { min: number; max: number }): string {
  const length = [...text.trim()].length;
  if (!length) return reasonMessage("required", limits);
  if (length < limits.min) return reasonMessage("too_short", limits);
  return length > limits.max ? reasonMessage("too_long", limits) : "";
}

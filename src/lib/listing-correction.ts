/** The correction window of a Published Listing (`GET /api/v1/listings/{id}/correction`, Story 2.19). The backend decides it; this only reads it. */
export type Eligibility = { available: true; until: string; left: string } | { available: false };

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const untilFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Karachi" });

/** "about 5 hours left": rounded, and only as good as the browser's clock (the server is the judge). */
export function timeLeftText(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "less than a minute left";
  if (minutes < 60) return `about ${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
  const hours = Math.round(minutes / 60);
  return `about ${hours} ${hours === 1 ? "hour" : "hours"} left`;
}

/** Fails closed: null for anything that is not the documented shape. */
export function readEligibility(data: unknown, now: number): Eligibility | null {
  if (typeof data !== "object" || data === null) return null;
  const { available, expires_at } = data as { available?: unknown; expires_at?: unknown };
  if (available === false) return { available: false };
  if (available !== true || typeof expires_at !== "string" || !ISO_WITH_OFFSET.test(expires_at)) return null;
  const at = Date.parse(expires_at);
  return Number.isNaN(at) ? null : { available: true, until: untilFormat.format(new Date(at)), left: timeLeftText(at - now) };
}

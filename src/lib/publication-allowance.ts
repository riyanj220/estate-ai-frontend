import type { components } from "@/api/schema";

/** The owner's publication allowance for the current Karachi month (`GET /api/v1/me/publication-allowance`). */
export type Allowance = {
  limit: number;
  used: number;
  remaining: number;
  /** The first instant of the next month in Karachi, as the server sent it. */
  resetsAt: string;
};

export const ALLOWANCE_TIME_ZONE: components["schemas"]["TimezoneEnum"] = "Asia/Karachi";

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const KEYS = ["limit", "used", "remaining", "period_start", "resets_at", "timezone"];
/** ISO 8601 with an explicit offset: `2026-12-01T00:00:00+05:00` (fractions allowed). */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: ALLOWANCE_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

/** The Karachi calendar month of an instant when it is exactly the first midnight of a month (a month index), otherwise null. */
function monthStartIndex(value: unknown): number | null {
  if (typeof value !== "string" || !ISO_WITH_OFFSET.test(value)) return null;
  const at = Date.parse(value);
  if (Number.isNaN(at) || at % 1000 !== 0) return null;
  const got: Record<string, number> = {};
  for (const part of parts.formatToParts(new Date(at))) if (part.type !== "literal") got[part.type] = Number(part.value);
  if (got.day !== 1 || got.hour !== 0 || got.minute !== 0 || got.second !== 0) return null;
  return got.year * 12 + (got.month - 1);
}

/**
 * Reads the allowance and fails closed: anything that is not exactly the documented shape is null (the card then shows its
 * load failure rather than a number nobody can trust). Exactly the six documented keys; counts are non-negative safe integers;
 * `remaining` is exactly `max(limit - used, 0)`; both datetimes are ISO 8601 with an offset and fall on the first midnight of a
 * Karachi month, `resets_at` the month after `period_start`; the zone is Karachi.
 */
export function readAllowance(data: unknown): Allowance | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== KEYS.length || !KEYS.every((key) => keys.includes(key))) return null;
  const { limit, used, remaining, period_start, resets_at, timezone } = data as Record<string, unknown>;
  if (!isCount(limit) || !isCount(used) || !isCount(remaining)) return null;
  if (timezone !== ALLOWANCE_TIME_ZONE) return null;
  if (remaining !== Math.max(limit - used, 0)) return null;
  const start = monthStartIndex(period_start);
  const end = monthStartIndex(resets_at);
  if (start === null || end === null || end !== start + 1) return null;
  return { limit, used, remaining, resetsAt: resets_at as string };
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: ALLOWANCE_TIME_ZONE });

/** "1 December 2026": the day in Karachi, with the month name, whatever the browser's time zone is. */
export function formatResetDate(resetsAt: string): string {
  return dateFormat.format(new Date(resetsAt));
}

export const remainingText = (remaining: number) => `${remaining} ${remaining === 1 ? "publication" : "publications"} remaining`;

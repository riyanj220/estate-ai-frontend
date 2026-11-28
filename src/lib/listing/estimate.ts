import { ESTIMATE_UNAVAILABLE } from "./listing-messages";

/** An AI Price Estimate as the pages show it: a value in PKR, or why there is none. */
export type Estimate = { kind: "value"; value: string } | { kind: "unavailable"; message: string };

const DECIMAL = /^\d{1,15}(\.\d{1,2})?$/;

const record = (data: unknown): Record<string, unknown> | null => (typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null);

/** The value of a stored or fresh estimate; null unless it is a PKR decimal string. */
export function readValue(data: unknown): string | null {
  const body = record(data);
  const value = body?.estimated_value;
  return body?.currency === "PKR" && typeof value === "string" && DECIMAL.test(value) ? value : null;
}

/** The answer of an estimate request; null when the body cannot be trusted. */
export function readEstimate(data: unknown): Estimate | null {
  const body = record(data);
  if (body?.status === "available") {
    const value = readValue(body);
    return value === null ? null : { kind: "value", value };
  }
  if (body?.status !== "unavailable") return null;
  return { kind: "unavailable", message: typeof body.message === "string" && body.message ? body.message : ESTIMATE_UNAVAILABLE };
}

export type Forecast = { years: number; low: string; base: string; high: string };

/** One detail's effect on the estimate, in percent; positive raises it. */
export type Driver = { factor: string; percent: string };

/** A published Listing's estimate beside its total asking price (Stories 4.6 and 4.7). */
export type ListingEstimate = {
  estimate: Estimate;
  askingTotal: string | null;
  comparison: { verdict: "about_equal" | "above" | "below"; percent: string } | null;
  forecast: Forecast | null;
  drivers: Driver[];
  canRecompute: boolean;
};

const decimal = (value: unknown): string | null => (typeof value === "string" && DECIMAL.test(value) ? value : null);

function readComparison(value: unknown): ListingEstimate["comparison"] {
  const body = record(value);
  const verdict = body?.verdict;
  const percent = decimal(body?.percent);
  return (verdict === "about_equal" || verdict === "above" || verdict === "below") && percent !== null ? { verdict, percent } : null;
}

function readForecast(value: unknown): Forecast | null {
  const body = record(value);
  const [low, base, high] = [decimal(body?.low), decimal(body?.base), decimal(body?.high)];
  const years = body?.horizon_years;
  return low && base && high && years === 5 ? { years, low, base, high } : null;
}

function readDrivers(value: unknown): Driver[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const { factor, percent } = record(item) ?? {};
    return typeof factor === "string" && factor && typeof percent === "string" && /^-?\d{1,6}(\.\d)?$/.test(percent) ? [{ factor, percent }] : [];
  });
}

/** Null when the body cannot be trusted. A comparison or forecast is only kept beside a value. */
export function readListingEstimate(data: unknown): ListingEstimate | null {
  const estimate = readEstimate(data);
  const body = record(data);
  if (!estimate || !body) return null;
  const known = estimate.kind === "value";
  return {
    estimate,
    askingTotal: decimal(body.asking_total),
    comparison: known ? readComparison(body.comparison) : null,
    forecast: known ? readForecast(body.forecast) : null,
    drivers: known ? readDrivers(body.drivers) : [],
    canRecompute: body.can_recompute === true,
  };
}

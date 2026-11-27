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

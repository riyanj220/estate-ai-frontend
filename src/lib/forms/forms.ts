import type { components } from "@/api/schema";
import { codeOfSentence } from "../http/error-sentences";

/** Helpers shared by the public forms. No business rules: only reading and presenting server answers. */

export const REQUEST_TIMEOUT_MS = 20_000;
/** An image upload sends up to 6 MiB and the server may spend 20 seconds processing it: it gets a longer deadline. */
export const UPLOAD_TIMEOUT_MS = 60_000;
export const SERVER_ERROR = "Something went wrong on our side. Please try again in a moment.";
export const REJECTED_ERROR = "This request could not be submitted. Please try again.";
export const TIMEOUT_ERROR = "The server took too long to answer. Please try again.";
export const NETWORK_ERROR = "We could not reach the server. Check your connection and try again.";

export function rateLimitMessage(retryAfter: string | null): string {
  const seconds = Number(retryAfter);
  if (!retryAfter || !Number.isFinite(seconds) || seconds <= 0) return "Too many attempts. Try again later.";
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

type ErrorEnvelope = components["schemas"]["ErrorEnvelope"];
export type ErrorBody = ErrorEnvelope["error"];

/**
 * Reads the standard error envelope from a failed response body; null when the body is not one. The backend's static field sentences
 * become their codes (`error-sentences.ts`) unless `raw` is set, for the few forms that show the server's own sentence as it came.
 */
export function readErrorBody(body: unknown, raw = false): ErrorBody | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = (body as { error: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const { message, fields } = error as Partial<ErrorBody>;
  if (typeof message !== "string") return null;
  const clean: Record<string, string[]> = {};
  if (typeof fields === "object" && fields !== null) {
    for (const [key, value] of Object.entries(fields)) {
      // The real API reports static sentences: a known one becomes its code here, once, before any mapper runs (`error-sentences.ts`).
      if (Array.isArray(value)) clean[key] = value.filter((item): item is string => typeof item === "string").map((item) => (raw ? item : codeOfSentence(item)));
    }
  }
  return { ...(error as ErrorBody), message, fields: clean };
}

/** Runs a request with an abort signal that fires after the timeout; the timer is always cleared. */
export async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** True for the error `withTimeout` raises when its timer fires. */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError");
}

/** One signal that aborts when any of `signals` does (`AbortSignal.any` where the browser has it, chained by hand where it does not). */
export function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

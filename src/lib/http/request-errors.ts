import { CsrfFetchError } from "./csrf";
import {
  NETWORK_ERROR,
  REJECTED_ERROR,
  SERVER_ERROR,
  TIMEOUT_ERROR,
  isTimeoutError,
  rateLimitMessage,
} from "../forms/forms";

/** The generic message for a failed answer that is not a field error: 429 with the wait, 5xx, anything else. */
export function failureMessage(status: number, retryAfter: string | null): string {
  if (status === 429) return rateLimitMessage(retryAfter);
  return status >= 500 ? SERVER_ERROR : REJECTED_ERROR;
}

/** The generic message for a thrown error: a failed CSRF fetch, a timeout or a network failure. */
export function thrownMessage(error: unknown): string {
  if (error instanceof CsrfFetchError) return failureMessage(error.status, error.retryAfter);
  return isTimeoutError(error) ? TIMEOUT_ERROR : NETWORK_ERROR;
}

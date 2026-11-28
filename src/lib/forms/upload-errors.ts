import { REJECTED_ERROR, rateLimitMessage, readErrorBody } from "./forms";
import { UPLOAD_BUSY, UPLOAD_FILE_MESSAGES } from "../listing/listing-messages";
import { mapKnownCodes } from "./password-messages";
import { failureMessage } from "../http/request-errors";

/** "Try again in 7 seconds." from a `Retry-After` of plain digits; anything else is "shortly" (the header is only ever shown as text). */
export function retryText(header: string | null): string {
  if (header === null || !/^[1-9][0-9]{0,3}$/.test(header)) return "Try again shortly.";
  return `Try again in ${header} ${header === "1" ? "second" : "seconds"}.`;
}

/**
 * The text for a failed image upload (any non-OK answer except 401 and 404, which the caller handles): the same mapping for the Draft's
 * Images section and the profile picture. Known codes only; a field or code that is not known is the generic text, never the server's
 * own words. `conflicts` maps the codes of a 409, `forbidden` is what a Suspended session sees on a 403 (any other 403 is generic).
 */
export function uploadErrorMessage({
  status,
  error,
  retryAfter,
  suspended,
  forbidden,
  conflicts,
}: {
  status: number;
  error: unknown;
  retryAfter: string | null;
  suspended: boolean;
  forbidden: string;
  conflicts: Record<string, string>;
}): string {
  if (status === 413) return UPLOAD_FILE_MESSAGES.too_large;
  if (status === 400) {
    const codes = readErrorBody(error)?.fields.file ?? [];
    return codes.length > 0 ? mapKnownCodes(codes, UPLOAD_FILE_MESSAGES, REJECTED_ERROR)[0] : REJECTED_ERROR;
  }
  if (status === 409) {
    const code = readErrorBody(error)?.code;
    return typeof code === "string" && Object.hasOwn(conflicts, code) ? conflicts[code] : REJECTED_ERROR;
  }
  if (status === 403) return suspended ? forbidden : failureMessage(403, null);
  if (status === 503) return `${UPLOAD_BUSY} ${retryText(retryAfter)}`;
  if (status === 429) return rateLimitMessage(retryAfter);
  return failureMessage(status, retryAfter);
}

export const DEFAULT_TARGET = "/dashboard";
const MAX_LENGTH = 200;

/**
 * Only a same-origin relative path is honoured as a post-sign-in target: one leading "/", no "//", no backslash,
 * no scheme, no control characters, at most 200 characters. Anything else falls back to the dashboard.
 */
export function safeNext(value: string | string[] | null | undefined): string {
  if (typeof value !== "string") return DEFAULT_TARGET;
  if (value.length === 0 || value.length > MAX_LENGTH) return DEFAULT_TARGET;
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_TARGET;
  // Never send a signed-in user to the API proxy or to framework internals.
  if (/^\/(api|_next)(\/|\?|#|$)/.test(value)) return DEFAULT_TARGET;
  if (/[\u0000-\u001f\u007f-\u009f\\]/.test(value)) return DEFAULT_TARGET;
  try {
    if (new URL(value, "http://placeholder.invalid").origin !== "http://placeholder.invalid") return DEFAULT_TARGET;
  } catch {
    return DEFAULT_TARGET;
  }
  return value;
}

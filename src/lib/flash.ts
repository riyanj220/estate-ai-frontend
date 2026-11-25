import "client-only";

/**
 * One short confirmation handed from the page that did something to the page it navigates to (for example "Draft deleted." from the Draft
 * page to My listings). Held in memory only, for ONE target path and at most `FLASH_TTL_MS`: a navigation that lands elsewhere (a redirect to
 * sign in, a failed navigation) never leaves a message that a later visit would show. Cleared once shown. Nothing is written to any browser
 * storage and nothing goes in the URL.
 */
export const FLASH_TTL_MS = 5000;
let held: { text: string; path: string; at: number } | null = null;
export const setFlash = (text: string, path: string): void => {
  held = { text, path, at: Date.now() };
};
/** The message for `path` if it is still fresh, else empty; reading does not clear it (see `clearFlash`). */
export function peekFlash(path: string): string {
  if (!held || held.path !== path || Date.now() - held.at > FLASH_TTL_MS) return "";
  return held.text;
}
export const clearFlash = (): void => {
  held = null;
};

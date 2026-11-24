import "client-only";

/**
 * Who is changing a Draft's images right now. Module-level on purpose: it survives a remount of the Images section (for example a
 * restore from the back-forward cache), so a second batch can never start while an earlier one is still running.
 */
let holder: symbol | null = null;

/** Takes the one right to change images; false when someone else holds it. */
export function acquireImageLock(token: symbol): boolean {
  if (holder !== null) return false;
  holder = token;
  return true;
}

/** Gives the right back, only if `token` holds it. Returns whether it did. */
export function releaseImageLock(token: symbol): boolean {
  if (holder !== token) return false;
  holder = null;
  return true;
}

export const imageLockHeld = (): boolean => holder !== null;

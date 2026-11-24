import "client-only";

/**
 * Who is changing images right now, per scope: "listing" (a Draft's Images section, Story 2.10, the default) and "profile" (the
 * profile picture or Agency logo, Story 2.11). Module-level on purpose: it survives a remount of a section (for example a restore
 * from the back-forward cache), so a second action can never start while an earlier one is still running. Scopes are independent:
 * a profile upload never blocks a Draft's images and the reverse.
 */
export type ImageLockScope = "listing" | "profile";
const holders = new Map<ImageLockScope, symbol>();

/** Takes the one right to change images in `scope`; false when someone else holds it. */
export function acquireImageLock(token: symbol, scope: ImageLockScope = "listing"): boolean {
  if (holders.has(scope)) return false;
  holders.set(scope, token);
  return true;
}

/** Gives the right back, only if `token` holds it. Returns whether it did. */
export function releaseImageLock(token: symbol, scope: ImageLockScope = "listing"): boolean {
  if (holders.get(scope) !== token) return false;
  holders.delete(scope);
  return true;
}

export const imageLockHeld = (scope: ImageLockScope = "listing"): boolean => holders.has(scope);

/**
 * Whether a text save of the profile is in flight. Set synchronously by the form on submit (not through a render), so an image action
 * started in the very next event already sees it.
 */
let saving = false;
export const markProfileSaving = (value: boolean): void => {
  saving = value;
};
export const profileSaveHeld = (): boolean => saving;

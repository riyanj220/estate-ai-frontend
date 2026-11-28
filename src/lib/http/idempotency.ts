/**
 * A new Idempotency-Key for one publish attempt: 1 to 128 characters from `A-Za-z0-9._:-` (the backend's rule). A random UUID where the
 * browser has one (secure contexts), else 32 random hex digits. Never derived from anything about the Listing.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

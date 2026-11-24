import type { components } from "@/api/schema";

/** What the profile pages know about a profile picture or an Agency logo (Story 2.11). Wire shapes are validated here, and only here. */
export type OwnerImage = components["schemas"]["ProfileImage"];
export type ProfileImageKind = "individual" | "agency";

/** The only URL the owner's image may have: the owner route of its kind. Anything else is an unreadable answer. */
export const OWNER_IMAGE_URL: Record<ProfileImageKind, string> = {
  individual: "/api/v1/me/profile/image/file",
  agency: "/api/v1/me/agency-profile/image/file",
};

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/** An image object from the wire, or null when it is not exactly the documented shape with the owner route as its URL. */
export function readOwnerImage(data: unknown, kind: ProfileImageKind): OwnerImage | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const { content_type, width, height, bytes, url } = data as Record<string, unknown>;
  if (typeof content_type !== "string" || !TYPES.includes(content_type)) return null;
  if (!positive(width) || !positive(height) || !positive(bytes)) return null;
  if (url !== OWNER_IMAGE_URL[kind]) return null;
  return { content_type: content_type as OwnerImage["content_type"], width, height, bytes, url };
}

/** The `image` member of a profile answer: `{ ok: true, image: null }` for a profile without one, `{ ok: false }` for anything unexpected. */
export function readProfileImage(value: unknown, kind: ProfileImageKind): { ok: true; image: OwnerImage | null } | { ok: false } {
  if (value === null) return { ok: true, image: null };
  const image = readOwnerImage(value, kind);
  return image ? { ok: true, image } : { ok: false };
}

/** The Agency's public identifiers: `agency_id` a UUID and `logo_url` null or exactly its public logo route. They are never shown as text. */
export function validAgencyIdentifiers(agencyId: unknown, logoUrl: unknown): boolean {
  if (typeof agencyId !== "string" || !UUID.test(agencyId)) return false;
  return logoUrl === null || (typeof logoUrl === "string" && logoUrl.toLowerCase() === `/api/v1/agencies/${agencyId}/logo`.toLowerCase());
}

/** Texts of the profile picture and logo sections. */
export const PROFILE_IMAGE_TEXT: Record<
  ProfileImageKind,
  { title: string; label: string; alt: string; empty: string; hint: string; remove: string; removeAsk: string; removed: string; updated: string; uploading: string; noun: string }
> = {
  individual: {
    title: "Profile picture",
    label: "Choose a picture",
    alt: "Your profile picture",
    empty: "No picture yet.",
    hint: "JPEG, PNG or WebP, up to 5 MB. Only you can see your picture.",
    remove: "Remove picture",
    removeAsk: "Remove your profile picture?",
    removed: "Your picture was removed.",
    updated: "Your picture was updated.",
    uploading: "Uploading your picture.",
    noun: "picture",
  },
  agency: {
    title: "Agency logo",
    label: "Choose a logo",
    alt: "Your agency logo",
    empty: "No logo yet.",
    hint: "JPEG, PNG or WebP, up to 5 MB. Your logo is shown publicly while your agency account is active.",
    remove: "Remove logo",
    removeAsk: "Remove your agency logo?",
    removed: "Your logo was removed.",
    updated: "Your logo was updated.",
    uploading: "Uploading your logo.",
    noun: "logo",
  },
};
export const PROFILE_IMAGE_BUSY = "Wait for the current action to finish.";
export const PROFILE_IMAGE_SAVING = "Wait for your changes to be saved, then change the image.";
export const PROFILE_IMAGE_UNKNOWN = "It may have been saved: check the image shown.";
export const PROFILE_IMAGE_UNREADABLE = "We could not read the answer.";
export const PROFILE_IMAGE_RELOADED = "We loaded the latest image.";
export const PROFILE_IMAGE_REFRESH_FAILED = "We could not check your image. Reload the page to see the latest.";
export const PROFILE_IMAGE_CAP: Record<string, string> = {
  storage_cap_exceeded: "You have reached your storage limit. Free up space and try again.",
};

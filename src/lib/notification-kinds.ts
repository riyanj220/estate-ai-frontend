/**
 * The one place where a notification kind becomes human text. The backend sends only `kind` and a payload of public
 * values (it has no display text); the copy lives here. To add a kind (a later epic), add one entry to `KINDS`:
 * `title` and `text` are plain strings, or functions of the payload when the kind carries payload keys. Read only the
 * keys the entry names, through `field`, and return plain text (the page renders it as text, never as HTML).
 * An unregistered kind shows `UNKNOWN_KIND` and none of its payload.
 */
export type NotificationPayload = Record<string, unknown>;
export type KindText = string | ((payload: NotificationPayload) => string);
export type KindEntry = { title: KindText; text: KindText; /** An in-app path the notification links to, from the payload; an empty text means no link. */ href?: (payload: NotificationPayload) => string; linkText?: string };
export type NotificationView = { title: string; text: string; /** Set only for a kind that links somewhere (a same-origin path). */ href?: string; linkText?: string };

export const UNKNOWN_KIND: NotificationView = { title: "You have a notification.", text: "" };

/** A payload value as text for a named key: a string or a number, else empty (never an object, never raw markup). */
export function field(payload: NotificationPayload, key: string): string {
  const value = payload[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

/** A whole number of days in the range the backend sends (0 to 365); anything else throws, so the notification reads as the generic line. */
function daysLeft(payload: NotificationPayload): number {
  const value = payload.days_left;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 365) throw new Error("days_left");
  return value;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A moderation notification: the fixed title, the reason and a link to the owner's listing. */
function moderated(title: string): KindEntry {
  return {
    title,
    text: (payload) => {
      const reason = field(payload, "reason");
      return reason ? `Reason: ${reason}` : "";
    },
    href: (payload) => {
      const id = field(payload, "listing_id");
      return UUID.test(id) ? `/account/listings/${id}` : "";
    },
    linkText: "Open the listing",
  };
}

const KINDS: Record<string, KindEntry> = {
  "account.password_changed": {
    title: "Your password was changed.",
    text: "If this was not you, reset your password and contact support.",
  },
  "account.email_changed": {
    title: "Your sign-in email address was changed.",
    text: "If this was not you, contact support.",
  },
  // Story 2.21: both payloads are empty; the reason is only ever read from the account's own session.
  "account.suspended": {
    title: "Your account was suspended.",
    text: "While the suspension lasts, the reason is shown at the top of the page.",
  },
  "account.reactivated": {
    title: "Your account was reactivated.",
    text: "Your account is no longer suspended.",
  },
  // Stories 8.3 and 8.4: empty payloads; the outcome and any reason are read on the verification page.
  "verification.approved": {
    title: "Your agency is now verified.",
    text: "The verified mark shows on your public profile and listings.",
    href: () => "/account/verification",
    linkText: "Open verification",
  },
  "verification.rejected": {
    title: "Your verification request was not approved.",
    text: "Read the reason on the verification page. You can send a new request.",
    href: () => "/account/verification",
    linkText: "Open verification",
  },
  "verification.revoked": {
    title: "Your agency verification was revoked.",
    text: "Read the reason on the verification page. Your listings stay published.",
    href: () => "/account/verification",
    linkText: "Open verification",
  },
  // Story 10.2: empty payload; the reason is read on the closure page.
  "account.closure_rejected": {
    title: "Your account closure request was not approved.",
    text: "Your account is unchanged. Read the reason on the closure page.",
    href: () => "/account/closure",
    linkText: "Open the request",
  },
  // Story 10.9: empty payload.
  "support.closed": {
    title: "Your support request was closed.",
    text: "You can send a new request if you still need help.",
    href: () => "/account/support",
    linkText: "Open support",
  },
  // Story 9.2: empty payloads; the review notes are never sent.
  "report.resolved": {
    title: "Your report was reviewed and resolved.",
    text: "Thank you for helping keep listings trustworthy.",
  },
  "report.dismissed": {
    title: "Your report was reviewed and dismissed.",
    text: "No change was needed this time.",
  },
  // Story 9.4: the payload is the listing's id and the administrator's one-line reason.
  "listing.restricted": moderated("Your listing was restricted and is hidden from the public."),
  "listing.removed": moderated("Your listing was removed."),
  "listing.restriction_lifted": moderated("The restriction on your listing was lifted."),
  "listing.restored": moderated("Your removed listing was restored."),
  "listing.removal_archived": moderated("Your removed listing was moved to your archived listings."),
  // Story 2.13: the payload is only the draft's id and the days left (never its title or any content).
  "listing.draft_expiring": {
    title: (payload) => {
      const days = daysLeft(payload);
      return `Your draft has had no activity for a long time and will be deleted in ${days} ${days === 1 ? "day" : "days"} unless you open it.`;
    },
    text: "",
    href: (payload) => {
      const id = field(payload, "listing_id");
      return UUID.test(id) ? `/account/listings/${id}` : "";
    },
    linkText: "Open the draft",
  },
};

const resolve = (value: KindText, payload: NotificationPayload) => (typeof value === "function" ? value(payload) : value);

/** The title and detail for a notification; an unknown kind gets the generic line and no payload. */
export function describeNotification(kind: string, payload: unknown): NotificationView {
  if (!Object.hasOwn(KINDS, kind)) return UNKNOWN_KIND;
  const entry = KINDS[kind];
  const values: NotificationPayload = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? (payload as NotificationPayload) : {};
  try {
    const title = resolve(entry.title, values);
    const text = resolve(entry.text, values);
    // An entry that resolves to nothing readable falls back to the generic line (never a blank heading).
    if (typeof title !== "string" || !title.trim()) return UNKNOWN_KIND;
    const href = entry.href?.(values);
    const link = href && href.startsWith("/account/") ? { href, linkText: entry.linkText ?? "Open" } : {};
    return { title, text: typeof text === "string" ? text : "", ...link };
  } catch {
    return UNKNOWN_KIND;
  }
}

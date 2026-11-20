/**
 * The one place where a notification kind becomes human text. The backend sends only `kind` and a payload of public
 * values (it has no display text); the copy lives here. To add a kind (a later epic), add one entry to `KINDS`:
 * `title` and `text` are plain strings, or functions of the payload when the kind carries payload keys. Read only the
 * keys the entry names, through `field`, and return plain text (the page renders it as text, never as HTML).
 * An unregistered kind shows `UNKNOWN_KIND` and none of its payload.
 */
export type NotificationPayload = Record<string, unknown>;
export type KindText = string | ((payload: NotificationPayload) => string);
export type KindEntry = { title: KindText; text: KindText };
export type NotificationView = { title: string; text: string };

export const UNKNOWN_KIND: NotificationView = { title: "You have a notification.", text: "" };

/** A payload value as text for a named key: a string or a number, else empty (never an object, never raw markup). */
export function field(payload: NotificationPayload, key: string): string {
  const value = payload[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
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
    return { title, text: typeof text === "string" ? text : "" };
  } catch {
    return UNKNOWN_KIND;
  }
}

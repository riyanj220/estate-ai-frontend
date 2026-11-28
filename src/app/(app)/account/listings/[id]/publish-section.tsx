"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/http/api";
import { clearCsrfToken, getCsrfToken } from "@/lib/http/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms/forms";
import { acquireImageLock, imageLockHeld, releaseImageLock } from "@/lib/listing/image-lock";
import { readListing, type ListingView } from "@/lib/listing/listing-labels";
import {
  DASHBOARD_PATH,
  PUBLISH_ALLOWANCE_CHECKING,
  PUBLISH_ALLOWANCE_FAILED,
  PUBLISH_CHANGED,
  PUBLISH_EMAIL_UNVERIFIED,
  PUBLISH_FORM_LOADING,
  PUBLISH_FORM_UNAVAILABLE,
  PUBLISH_FAILED,
  PUBLISH_LABEL,
  PUBLISH_SAVE_FIRST,
  PUBLISH_TEXT,
  PUBLISH_TITLE,
  PUBLISH_UNAVAILABLE,
  PUBLISH_UNSURE,
  PUBLISH_WAIT,
  PUBLISH_WORKING,
  REPUBLISH_CHANGED,
  REPUBLISH_EMAIL_UNVERIFIED,
  REPUBLISH_FAILED,
  REPUBLISH_FORM_LOADING,
  REPUBLISH_FORM_UNAVAILABLE,
  REPUBLISH_LABEL,
  REPUBLISH_SAVE_FIRST,
  REPUBLISH_TEXT,
  REPUBLISH_TITLE,
  REPUBLISH_UNSURE,
  REPUBLISH_WAIT,
  REPUBLISH_WORKING,
  VERIFY_EMAIL_PATH,
  quotaExhaustedText,
} from "@/lib/listing/listing-messages";
import { newIdempotencyKey } from "@/lib/http/idempotency";
import { formatResetDate, readAllowance, remainingText, type Allowance } from "@/lib/account/publication-allowance";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";

/** What the allowance read answers: the numbers, a failure (never blocks publishing), or a session that is gone. */
async function readOwnAllowance(): Promise<Allowance | "failed" | "gone"> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/publication-allowance", { cache: "no-store", signal }));
    if (response.ok) return readAllowance(data) ?? "failed";
    return response.status === 401 ? "gone" : "failed";
  } catch {
    return "failed";
  }
}

/** The allowance a Listing was published against, re-read after the success: the number the owner has left. */
export function PublishedAllowance() {
  const [allowance, setAllowance] = useState<Allowance | "failed" | "loading">("loading");
  useEffect(() => {
    let live = true;
    void readOwnAllowance().then((answer) => {
      if (live) setAllowance(answer === "gone" ? "failed" : answer);
    });
    return () => {
      live = false;
    };
  }, []);
  if (allowance === "loading" || allowance === "failed") return null;
  return (
    <span data-testid="published-allowance">
      {" "}
      You have {remainingText(allowance.remaining)} this month.
    </span>
  );
}

/** The caller's own numbers of a `quota_exhausted` answer (`details` beside `error`); anything that is not the documented shape is unknown. */
function readQuota(body: unknown): { limit: number | null; date: string | null } {
  const details = typeof body === "object" && body !== null ? (body as { details?: unknown }).details : null;
  if (typeof details !== "object" || details === null) return { limit: null, date: null };
  const { limit, resets_at } = details as { limit?: unknown; resets_at?: unknown };
  const at = typeof resets_at === "string" && /^\d{4}-\d{2}-\d{2}T/.test(resets_at) ? Date.parse(resets_at) : NaN;
  return {
    limit: typeof limit === "number" && Number.isSafeInteger(limit) && limit >= 0 ? limit : null,
    date: Number.isNaN(at) ? null : formatResetDate(resets_at as string),
  };
}

/** What the section does: publish a Draft (Story 2.15) or republish an Archived Listing (Story 2.18); the machinery is the same. */
export type PublishMode = "publish" | "republish";
export type PublicationKind = "republish_counted" | "republish_free";

const COPY = {
  publish: {
    title: PUBLISH_TITLE,
    text: PUBLISH_TEXT,
    label: PUBLISH_LABEL,
    saveFirst: PUBLISH_SAVE_FIRST,
    wait: PUBLISH_WAIT,
    working: PUBLISH_WORKING,
    busyLabel: "Publishing…",
    failed: PUBLISH_FAILED,
    unsure: PUBLISH_UNSURE,
    changed: PUBLISH_CHANGED,
    emailUnverified: PUBLISH_EMAIL_UNVERIFIED,
    formLoading: PUBLISH_FORM_LOADING,
    formUnavailable: PUBLISH_FORM_UNAVAILABLE,
  },
  republish: {
    title: REPUBLISH_TITLE,
    text: REPUBLISH_TEXT,
    label: REPUBLISH_LABEL,
    saveFirst: REPUBLISH_SAVE_FIRST,
    wait: REPUBLISH_WAIT,
    working: REPUBLISH_WORKING,
    busyLabel: "Republishing…",
    failed: REPUBLISH_FAILED,
    unsure: REPUBLISH_UNSURE,
    changed: REPUBLISH_CHANGED,
    emailUnverified: REPUBLISH_EMAIL_UNVERIFIED,
    formLoading: REPUBLISH_FORM_LOADING,
    formUnavailable: REPUBLISH_FORM_UNAVAILABLE,
  },
} as const;

/** The outcome of a republication: `publication_kind` of the 200 answer; anything else is unknown (the republication still happened). */
function readKind(data: unknown): PublicationKind | null {
  const kind = typeof data === "object" && data !== null ? (data as { publication_kind?: unknown }).publication_kind : null;
  return kind === "republish_counted" || kind === "republish_free" ? kind : null;
}

type Note = { text: string; link?: { href: string; label: string }; retry?: boolean; kind: "quota" | "other" };

/**
 * The Publish section of a Draft page (Story 2.15) and, with `mode="republish"`, the Republish section of an Archived page (Story 2.18: the
 * same flow against `POST .../republish`, with its own words and test ids). The click sends `POST .../publish` with the CSRF token, the revision last loaded and
 * an `Idempotency-Key` made per attempt: a retry of the same attempt (a network error, a timeout, a server error) reuses it, so the server
 * never publishes twice; any edit or a new revision starts a new attempt. While it runs the section holds the image lock and the page
 * pauses Save, the images and Delete. The page decides what a validation error, a stale revision or a success mean (callbacks).
 */
export function PublishSection({
  mode = "publish",
  listingId,
  revision,
  stamp,
  dirty,
  blocked,
  saveRunning,
  onBusyChange,
  onSessionGone,
  onNotFound,
  onInvalid,
  onPublished,
  onStale,
  onConflict,
  onForbidden,
  formState,
}: {
  mode?: PublishMode;
  listingId: string;
  revision: number | null;
  /** Changes with every edit or revision: a new stamp means a new attempt (a new Idempotency-Key). */
  stamp: string;
  /** The form has changes that are not saved. */
  dirty: boolean;
  /** A field save, an image action or a delete is running (rendered state). */
  blocked: boolean;
  /** The same for a save that started in this very event (a ref read). */
  saveRunning: () => boolean;
  onBusyChange: (busy: boolean) => void;
  onSessionGone: () => Promise<void>;
  onNotFound: () => void;
  /** The server named what is missing (400): true when it was shown, false when the answer had nothing the page can show. */
  onInvalid: (fields: Record<string, string[]>) => boolean;
  /** 200: the Listing and, for a republication, how it was recorded (null when the answer does not say). */
  onPublished: (listing: ListingView, kind: PublicationKind | null) => void;
  /** 409 `stale_revision`: the answer's body and the revision that was sent; the page runs its conflict flow. */
  onStale: (body: unknown, baseRevision: number) => Promise<void>;
  /** 409 `conflict`: the Listing is not in the expected status any more; the page reads it again ("unchanged": it still is, nothing happened). */
  onConflict: () => Promise<"published" | "unchanged" | "handled">;
  /** Republish only: a plain 403 `forbidden`. The page reads the Listing again: true when it is restricted (the page took over), false otherwise. */
  onForbidden?: () => Promise<boolean>;
  /** The editor's form (the registry) has loaded; until it has, unsaved changes cannot be told, so publishing waits. */
  formState: "loading" | "ready" | "error";
}) {
  const copy = COPY[mode];
  const republish = mode === "republish";
  const id = mode; // test ids and element ids: "publish-…" or "republish-…"
  const [token] = useState(() => Symbol(mode));
  const [allowance, setAllowance] = useState<Allowance | "failed" | "loading">("loading");
  // The remaining count is read when the section mounts and after a quota refusal; it can be stale (another tab may have published), so
  // it informs and never blocks: the server's answer is the one that counts.
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const [noteTick, setNoteTick] = useState(0);
  const running = useRef(false);
  const mounted = useRef(true);
  const attempt = useRef<{ key: string; stamp: string } | null>(null);
  // The latest props for the work that outlives a render (the automatic retry after a key reuse reads these, never a closure).
  const latest = useRef({ stamp, revision, dirty, blocked, formState });
  useEffect(() => {
    latest.current = { stamp, revision, dirty, blocked, formState };
  });

  const goneRef = useRef(onSessionGone);
  useEffect(() => {
    goneRef.current = onSessionGone;
  });
  function applyAllowance(answer: Allowance | "failed" | "gone") {
    if (!mounted.current) return;
    if (answer === "gone") void goneRef.current();
    else setAllowance(answer);
  }
  function loadAllowance() {
    void readOwnAllowance().then(applyAllowance);
  }
  useEffect(() => {
    mounted.current = true;
    // The first read only; later reads follow a refusal.
    void readOwnAllowance().then(applyAllowance);
    return () => {
      mounted.current = false;
      releaseImageLock(token);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (noteTick > 0) noteRef.current?.focus();
  }, [noteTick]);
  function show(next: Note) {
    setNote(next);
    setNoteTick((tick) => tick + 1);
  }

  const busy = blocked || working;
  const notReady = formState !== "ready";
  const reason = busy ? copy.wait : notReady ? (formState === "loading" ? copy.formLoading : copy.formUnavailable) : dirty ? copy.saveFirst : "";
  const disabled = busy || dirty || notReady;

  async function publish(again = true): Promise<void> {
    if (running.current) return;
    const base = latest.current.revision;
    const now = latest.current;
    if (now.blocked || now.dirty || now.formState !== "ready" || saveRunning() || imageLockHeld()) {
      // Declined: the form changed (or something started) since the click; say so instead of doing nothing.
      if (!again) show({ text: copy.changed, kind: "other" });
      return;
    }
    if (!acquireImageLock(token)) return;
    if (base === null) {
      show({ text: copy.failed, kind: "other" });
      releaseImageLock(token);
      return;
    }
    running.current = true;
    setWorking(true);
    setNote(null);
    onBusyChange(true);
    // A new attempt (an edit, a new revision) gets a new key; a retry of the same attempt reuses it.
    if (!attempt.current || attempt.current.stamp !== latest.current.stamp) attempt.current = { key: newIdempotencyKey(), stamp: latest.current.stamp };
    const key = attempt.current.key;
    let retryWithNewKey = false;
    try {
      const api = await getApi();
      const send = async (csrf: string) =>
        withTimeout((signal) =>
          republish
            ? api.POST("/api/v1/listings/{listing_id}/republish", {
                params: { path: { listing_id: listingId }, header: { "Idempotency-Key": key } },
                body: { base_revision: base },
                headers: { "X-CSRFToken": csrf },
                signal,
              })
            : api.POST("/api/v1/listings/{listing_id}/publish", {
                params: { path: { listing_id: listingId }, header: { "Idempotency-Key": key } },
                body: { base_revision: base },
                headers: { "X-CSRFToken": csrf },
                signal,
              }),
        );
      // Not `withCsrf`: that retries on any 403, and a 403 here can be a real answer (email not verified, publishing unavailable) that must not be
      // sent twice. Only the plain `forbidden` answer (a stale token) is retried, once, with the same key.
      let result = await send(await getCsrfToken());
      if (result.response.status === 403 && readErrorBody(result.error)?.code === "forbidden") {
        clearCsrfToken();
        result = await send(await getCsrfToken());
      }
      const { data, error, response } = result;
      // A restricted Listing is refused `forbidden` for good (a stale token was retried above): the same words as the page's own note.
      if (republish && onForbidden && response.status === 403 && readErrorBody(error)?.code === "forbidden") {
        attempt.current = null;
        if (await onForbidden()) return;
        show({ text: failureMessage(403, null), kind: "other" }); // not restricted: the generic refusal, as Publish shows it
        return;
      }
      if (response.ok) {
        const next = readListing(data);
        if (next && next.id === listingId && next.status === "published" && Number.isInteger(next.revision)) {
          attempt.current = null;
          onPublished(next, republish ? readKind(data) : null);
          return;
        }
        // A success nobody can read: the key stays, so a retry can only replay it.
        show({ text: copy.unsure, retry: true, kind: "other" });
        return;
      }
      if (response.status === 401) return await onSessionGone();
      if (response.status === 404) return onNotFound();
      const parsed = readErrorBody(error);
      const code = parsed?.code;
      if (response.status === 400) {
        attempt.current = null;
        const fields = parsed?.fields ?? {};
        if (Object.values(fields).some((codes) => codes.length > 0) && onInvalid(fields)) return;
        show({ text: copy.failed, kind: "other" });
        return;
      }
      if (response.status === 403 && code === "email_not_verified") {
        show({ text: copy.emailUnverified, link: { href: VERIFY_EMAIL_PATH, label: "Verify your email" }, kind: "other" });
        return;
      }
      if (response.status === 403 && code === "publishing_unavailable") {
        show({ text: PUBLISH_UNAVAILABLE, kind: "other" });
        return;
      }
      if (response.status === 409) {
        attempt.current = null;
        if (code === "stale_revision") return await onStale(error, base);
        if (code === "conflict") {
          // Re-read: published elsewhere switches the page; a draft that still is one means nothing was published, so Publish stays.
          if ((await onConflict()) === "unchanged") show({ text: copy.failed, kind: "other" });
          return;
        }
        if (code === "quota_exhausted") {
          const quota = readQuota(error);
          show({ text: quotaExhaustedText(quota.limit, quota.date), link: { href: DASHBOARD_PATH, label: "Go to your dashboard" }, kind: "quota" });
          loadAllowance();
          return;
        }
        show({ text: copy.failed, kind: "other" });
        return;
      }
      if (response.status === 422 && code === "idempotency_key_reused") {
        // Refused without any effect: one automatic try with a new key; a second refusal is shown.
        attempt.current = null;
        if (again) retryWithNewKey = true;
        else show({ text: copy.failed, kind: "other" });
        return;
      }
      if (response.status >= 500 || response.status === 429) {
        // The key stays: a retry of this attempt is a replay at worst.
        show({ text: `${failureMessage(response.status, response.headers.get("Retry-After"))} ${response.status >= 500 ? copy.unsure : ""}`.trim(), retry: true, kind: "other" });
        return;
      }
      attempt.current = null;
      show({ text: response.status === 403 ? failureMessage(403, null) : copy.failed, kind: "other" });
    } catch (thrown) {
      // A network failure or a timeout: the request may have reached the server, so the key stays.
      show({ text: `${thrownMessage(thrown)} ${copy.unsure}`, retry: true, kind: "other" });
    } finally {
      running.current = false;
      releaseImageLock(token);
      onBusyChange(false);
      if (mounted.current) setWorking(false);
      if (retryWithNewKey && mounted.current) queueMicrotask(() => void publish(false));
    }
  }

  // A republication may be free, so an empty allowance is only said as a number there; Publish says what it means.
  const exhausted = !republish && allowance !== "loading" && allowance !== "failed" && allowance.remaining === 0;
  return (
    <section className="card" aria-labelledby={`${id}-title`} data-testid={`${id}-section`} style={{ marginBottom: "var(--space)" }}>
      <h2 id={`${id}-title`} className="section-title">
        {copy.title}
      </h2>
      <p>{copy.text}</p>
      {note?.kind !== "quota" && (
        <p className="muted" data-testid={`${id}-allowance`}>
          {allowance === "loading"
            ? PUBLISH_ALLOWANCE_CHECKING
            : allowance === "failed"
              ? PUBLISH_ALLOWANCE_FAILED
              : exhausted
                ? quotaExhaustedText(allowance.limit, formatResetDate(allowance.resetsAt))
                : `You have ${remainingText(allowance.remaining)} this month.`}
          {exhausted && (
            <>
              {" "}
              <Link href={DASHBOARD_PATH} className="text-link">
                Go to your dashboard
              </Link>
            </>
          )}
        </p>
      )}
      {note && (
        <div ref={noteRef} tabIndex={-1} role="alert" className="notice" data-testid={`${id}-note`}>
          <p>{note.text}</p>
          {note.link && (
            <p>
              <Link href={note.link.href} className="text-link" data-testid={`${id}-note-link`}>
                {note.link.label}
              </Link>
            </p>
          )}
          {note.retry && (
            <button type="button" className="secondary-button" aria-disabled={disabled ? true : undefined} aria-describedby={reason ? `${id}-reason` : undefined} onClick={() => void publish()} data-testid={`${id}-retry`}>
              Retry
            </button>
          )}
        </div>
      )}
      {reason && (
        <p id={`${id}-reason`} className="hint" data-testid={`${id}-reason`}>
          {reason}
        </p>
      )}
      <p role="status" className="sr-only" data-testid={`${id}-working`}>
        {working ? copy.working : ""}
      </p>
      <button
        type="button"
        className="primary-button"
        aria-disabled={disabled ? true : undefined}
        aria-describedby={reason ? `${id}-reason` : undefined}
        onClick={() => void publish()}
        data-testid={`${id}-button`}
      >
        {working ? copy.busyLabel : copy.label}
      </button>
    </section>
  );
}

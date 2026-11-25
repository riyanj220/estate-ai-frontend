"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { clearCsrfToken, getCsrfToken } from "@/lib/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms";
import { acquireImageLock, imageLockHeld, releaseImageLock } from "@/lib/image-lock";
import { readListing, type ListingView } from "@/lib/listing-labels";
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
  VERIFY_EMAIL_PATH,
  quotaExhaustedText,
} from "@/lib/listing-messages";
import { newIdempotencyKey } from "@/lib/idempotency";
import { formatResetDate, readAllowance, remainingText, type Allowance } from "@/lib/publication-allowance";
import { failureMessage, thrownMessage } from "@/lib/request-errors";

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

type Note = { text: string; link?: { href: string; label: string }; retry?: boolean; kind: "quota" | "other" };

/**
 * The Publish section of a Draft page (Story 2.15). The click sends `POST .../publish` with the CSRF token, the revision last loaded and
 * an `Idempotency-Key` made per attempt: a retry of the same attempt (a network error, a timeout, a server error) reuses it, so the server
 * never publishes twice; any edit or a new revision starts a new attempt. While it runs the section holds the image lock and the page
 * pauses Save, the images and Delete. The page decides what a validation error, a stale revision or a success mean (callbacks).
 */
export function PublishSection({
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
  formState,
}: {
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
  onPublished: (listing: ListingView) => void;
  /** 409 `stale_revision`: the answer's body and the revision that was sent; the page runs its conflict flow. */
  onStale: (body: unknown, baseRevision: number) => Promise<void>;
  /** 409 `conflict`: the Listing is not a draft any more; the page reads it again. */
  onConflict: () => Promise<"published" | "draft" | "handled">;
  /** The editor's form (the registry) has loaded; until it has, unsaved changes cannot be told, so publishing waits. */
  formState: "loading" | "ready" | "error";
}) {
  const [token] = useState(() => Symbol("publish"));
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
  const reason = busy ? PUBLISH_WAIT : notReady ? (formState === "loading" ? PUBLISH_FORM_LOADING : PUBLISH_FORM_UNAVAILABLE) : dirty ? PUBLISH_SAVE_FIRST : "";
  const disabled = busy || dirty || notReady;

  async function publish(again = true): Promise<void> {
    if (running.current) return;
    const base = latest.current.revision;
    const now = latest.current;
    if (now.blocked || now.dirty || now.formState !== "ready" || saveRunning() || imageLockHeld()) {
      // Declined: the form changed (or something started) since the click; say so instead of doing nothing.
      if (!again) show({ text: PUBLISH_CHANGED, kind: "other" });
      return;
    }
    if (!acquireImageLock(token)) return;
    if (base === null) {
      show({ text: PUBLISH_FAILED, kind: "other" });
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
          api.POST("/api/v1/listings/{listing_id}/publish", {
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
      if (response.ok) {
        const next = readListing(data);
        if (next && next.id === listingId && next.status === "published" && Number.isInteger(next.revision)) {
          attempt.current = null;
          onPublished(next);
          return;
        }
        // A success nobody can read: the key stays, so a retry can only replay it.
        show({ text: PUBLISH_UNSURE, retry: true, kind: "other" });
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
        show({ text: PUBLISH_FAILED, kind: "other" });
        return;
      }
      if (response.status === 403 && code === "email_not_verified") {
        show({ text: PUBLISH_EMAIL_UNVERIFIED, link: { href: VERIFY_EMAIL_PATH, label: "Verify your email" }, kind: "other" });
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
          if ((await onConflict()) === "draft") show({ text: PUBLISH_FAILED, kind: "other" });
          return;
        }
        if (code === "quota_exhausted") {
          const quota = readQuota(error);
          show({ text: quotaExhaustedText(quota.limit, quota.date), link: { href: DASHBOARD_PATH, label: "Go to your dashboard" }, kind: "quota" });
          loadAllowance();
          return;
        }
        show({ text: PUBLISH_FAILED, kind: "other" });
        return;
      }
      if (response.status === 422 && code === "idempotency_key_reused") {
        // Refused without any effect: one automatic try with a new key; a second refusal is shown.
        attempt.current = null;
        if (again) retryWithNewKey = true;
        else show({ text: PUBLISH_FAILED, kind: "other" });
        return;
      }
      if (response.status >= 500 || response.status === 429) {
        // The key stays: a retry of this attempt is a replay at worst.
        show({ text: `${failureMessage(response.status, response.headers.get("Retry-After"))} ${response.status >= 500 ? PUBLISH_UNSURE : ""}`.trim(), retry: true, kind: "other" });
        return;
      }
      attempt.current = null;
      show({ text: response.status === 403 ? failureMessage(403, null) : PUBLISH_FAILED, kind: "other" });
    } catch (thrown) {
      // A network failure or a timeout: the request may have reached the server, so the key stays.
      show({ text: `${thrownMessage(thrown)} ${PUBLISH_UNSURE}`, retry: true, kind: "other" });
    } finally {
      running.current = false;
      releaseImageLock(token);
      onBusyChange(false);
      if (mounted.current) setWorking(false);
      if (retryWithNewKey && mounted.current) queueMicrotask(() => void publish(false));
    }
  }

  const exhausted = allowance !== "loading" && allowance !== "failed" && allowance.remaining === 0;
  return (
    <section className="card" aria-labelledby="publish-title" data-testid="publish-section" style={{ marginBottom: "var(--space)" }}>
      <h2 id="publish-title" className="section-title">
        {PUBLISH_TITLE}
      </h2>
      <p>{PUBLISH_TEXT}</p>
      {note?.kind !== "quota" && (
        <p className="muted" data-testid="publish-allowance">
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
        <div ref={noteRef} tabIndex={-1} role="alert" className="notice" data-testid="publish-note">
          <p>{note.text}</p>
          {note.link && (
            <p>
              <Link href={note.link.href} className="text-link" data-testid="publish-note-link">
                {note.link.label}
              </Link>
            </p>
          )}
          {note.retry && (
            <button type="button" className="secondary-button" aria-disabled={disabled ? true : undefined} aria-describedby={reason ? "publish-reason" : undefined} onClick={() => void publish()} data-testid="publish-retry">
              Retry
            </button>
          )}
        </div>
      )}
      {reason && (
        <p id="publish-reason" className="hint" data-testid="publish-reason">
          {reason}
        </p>
      )}
      <p role="status" className="sr-only" data-testid="publish-working">
        {working ? PUBLISH_WORKING : ""}
      </p>
      <button
        type="button"
        className="primary-button"
        aria-disabled={disabled ? true : undefined}
        aria-describedby={reason ? "publish-reason" : undefined}
        onClick={() => void publish()}
        data-testid="publish-button"
      >
        {working ? "Publishing…" : PUBLISH_LABEL}
      </button>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms/forms";
import { acquireImageLock, imageLockHeld, releaseImageLock } from "@/lib/listing/image-lock";
import { readListing, type ListingView } from "@/lib/listing/listing-labels";
import {
  ARCHIVE_ENDED_TEXT,
  REPUBLISH_ARCHIVE_FIRST,
  STATUS_ACTIONS,
  STATUS_FAILED,
  STATUS_FORBIDDEN,
  STATUS_FORBIDDEN_SUSPENDED,
  STATUS_INTRO,
  STATUS_SAVE_FIRST,
  STATUS_TITLE,
  STATUS_UNSURE,
  STATUS_WAIT,
} from "@/lib/listing/listing-messages";
import { targetsFor, type StatusTarget } from "@/lib/listing/listing-status";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { useSession } from "@/lib/auth/session";

/**
 * The Actions section of a Listing that has been published (Story 2.17): Archive for a Published, Sold or Rented one, "Mark as sold" or
 * "Mark as rented" for a Published one (only the one that fits its purpose), and only Archive for a Suspended owner or a restricted
 * Listing. Each asks first in the modal dialog pattern of Story 2.13 (the native `<dialog>`: the page behind it is inert, Escape cancels,
 * focus returns to the button that opened it). The request holds the module-wide image lock, so it never starts while a save or an image
 * change runs, and none starts while it runs. The page decides what an answer means (callbacks); a failure is shown in the dialog and on
 * the page with a Retry.
 */
export function StatusActions({
  listingId,
  revision,
  status,
  purpose,
  restricted,
  dirty,
  blocked,
  saveRunning,
  onBusyChange,
  onSessionGone,
  onNotFound,
  onChanged,
  onStale,
  onConflict,
}: {
  listingId: string;
  revision: number | null;
  status: string | null;
  purpose: string | null;
  restricted: boolean;
  /** The form has changes that are not saved. */
  dirty: boolean;
  /** A field save or an image action is running (rendered state). */
  blocked: boolean;
  /** The same for a save that started in this very event (a ref read). */
  saveRunning: () => boolean;
  onBusyChange: (busy: boolean) => void;
  onSessionGone: () => Promise<void>;
  onNotFound: () => void;
  /** The server answered 200 with the Listing in its new status. */
  onChanged: (next: ListingView, target: StatusTarget) => void;
  /** 409 `stale_revision`: the answer's body and the revision that was sent; the page runs its conflict flow. */
  onStale: (body: unknown, baseRevision: number, target: StatusTarget) => Promise<void>;
  /** 409 `conflict`: the move is not allowed any more; the page reads the Listing again and explains. */
  onConflict: (target: StatusTarget) => Promise<void>;
}) {
  const { account } = useSession();
  const suspended = account?.state === "suspended";
  const targets = targetsFor(status, purpose, restricted, suspended);
  const [token] = useState(() => Symbol("status"));
  const dialog = useRef<HTMLDialogElement>(null);
  const triggers = useRef<Partial<Record<StatusTarget, HTMLButtonElement | null>>>({});
  const cancel = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const dialogAlert = useRef<HTMLParagraphElement>(null);
  const pageAlert = useRef<HTMLDivElement>(null);
  const keepFocus = useRef(false);
  const running = useRef(false);
  const mounted = useRef(true);
  const latestBusy = useRef(onBusyChange);
  const latest = useRef({ revision, dirty, blocked });
  useEffect(() => {
    latestBusy.current = onBusyChange;
    latest.current = { revision, dirty, blocked };
  });
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<StatusTarget>("archived");
  const [working, setWorking] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [pageNote, setPageNote] = useState<{ text: string; tone: "info" | "error"; retry?: StatusTarget } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      releaseImageLock(token);
    };
  }, [token]);

  // The dialog is opened and closed through the platform API; the state only mirrors it.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      cancel.current?.focus();
    } else if (!open && element.open) {
      element.close();
      if (!keepFocus.current) triggers.current[target]?.focus(); // back to the button that opened it
    }
  }, [open, target]);

  const busyNow = () => latest.current.blocked || saveRunning() || imageLockHeld() || running.current;
  const reasonText = working || blocked ? STATUS_WAIT : dirty ? STATUS_SAVE_FIRST : "";

  function ask(next: StatusTarget) {
    if (busyNow()) {
      setPageNote({ text: STATUS_WAIT, tone: "info" });
      return;
    }
    if (latest.current.dirty) {
      setPageNote({ text: STATUS_SAVE_FIRST, tone: "info" });
      return;
    }
    setPageNote(null);
    setDialogError("");
    keepFocus.current = false;
    setTarget(next);
    setOpen(true);
    // The dialog may have been closed by the platform behind the state's back: open it again now.
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      cancel.current?.focus();
    }
  }

  /** Any close: the state follows the platform. */
  function onClosed() {
    const element = dialog.current;
    if (running.current) {
      // A running request keeps its dialog: the platform closed it, so it is opened again.
      if (element && !element.open) element.showModal();
      return;
    }
    setOpen(false);
    if (!keepFocus.current) triggers.current[target]?.focus();
    else if (pageNote?.tone === "error") pageAlert.current?.focus(); // a failure the person cancelled out of stays in front of them
  }

  function close() {
    if (running.current) return;
    setOpen(false);
  }

  /** A failure is shown in the dialog and on the page (the dialog may be closed by the platform); the open dialog takes the attention. */
  function fail(text: string) {
    keepFocus.current = true;
    setDialogError(text);
    setPageNote({ text, tone: "error", retry: target });
  }

  async function confirm() {
    if (running.current) return;
    if (latest.current.blocked || saveRunning() || !acquireImageLock(token)) {
      setDialogError(STATUS_WAIT);
      return;
    }
    const base = latest.current.revision;
    if (base === null) {
      releaseImageLock(token);
      fail(STATUS_FAILED);
      return;
    }
    const wanted = target;
    running.current = true;
    setWorking(true);
    setDialogError("");
    latestBusy.current(true);
    try {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.POST("/api/v1/listings/{listing_id}/status", {
            params: { path: { listing_id: listingId } },
            body: { base_revision: base, status: wanted },
            headers: { "X-CSRFToken": csrf },
            signal,
          }),
        ),
      );
      if (response.ok) {
        const next = readListing(data);
        if (next && next.id === listingId && next.status === wanted && Number.isInteger(next.revision)) {
          keepFocus.current = true;
          setOpen(false);
          setPageNote(null);
          onChanged(next, wanted);
          return;
        }
        // A success nobody can read: the page cannot be built on it.
        fail(STATUS_UNSURE);
        return;
      }
      if (response.status === 401) {
        keepFocus.current = true;
        setOpen(false);
        await onSessionGone();
        return;
      }
      if (response.status === 404) {
        keepFocus.current = true;
        setOpen(false);
        onNotFound();
        return;
      }
      const code = readErrorBody(error)?.code;
      if (response.status === 409 && code === "stale_revision") {
        keepFocus.current = true;
        setOpen(false);
        await onStale(error, base, wanted);
        return;
      }
      if (response.status === 409) {
        keepFocus.current = true;
        setOpen(false);
        await onConflict(wanted);
        return;
      }
      if (response.status === 403) {
        fail(suspended && wanted !== "archived" ? STATUS_FORBIDDEN_SUSPENDED : STATUS_FORBIDDEN);
        return;
      }
      fail(response.status === 400 ? STATUS_FAILED : failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (thrown) {
      fail(thrownMessage(thrown));
    } finally {
      running.current = false;
      releaseImageLock(token);
      latestBusy.current(false);
      if (mounted.current) setWorking(false);
    }
  }

  // A failure message takes the reader's attention once.
  useEffect(() => {
    if (!dialogError && pageNote?.tone !== "error") return;
    const element = dialog.current;
    if (element?.open) dialogAlert.current?.focus();
    else pageAlert.current?.focus();
  }, [dialogError, pageNote]);

  // Tab stays between the two buttons of the dialog.
  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const first = cancel.current;
    const last = confirmButton.current;
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (targets.length === 0) return null;
  const text = { ...STATUS_ACTIONS[target], text: target === "archived" && status !== "published" ? ARCHIVE_ENDED_TEXT : STATUS_ACTIONS[target].text };
  const flag = working ? true : undefined;
  const disabled = blocked || working || dirty ? true : undefined;
  return (
    <section className="card" aria-labelledby="status-title" data-testid="status-section" style={{ marginBottom: "var(--space)" }}>
      <h2 id="status-title" className="section-title">
        {STATUS_TITLE}
      </h2>
      <p className="muted">{STATUS_INTRO}</p>
      {(status === "sold" || status === "rented") && !restricted && (
        <p className="hint" data-testid="republish-archive-first">
          {REPUBLISH_ARCHIVE_FIRST}
        </p>
      )}
      {pageNote && (
        <div
          ref={pageAlert}
          tabIndex={-1}
          role={pageNote.tone === "error" && !open ? "alert" : "status"}
          className={pageNote.tone === "error" ? "notice" : "muted"}
          data-testid="status-note"
        >
          <p>{pageNote.text}</p>
          {pageNote.retry && (
            <button type="button" className="secondary-button" aria-disabled={disabled} onClick={() => ask(pageNote.retry as StatusTarget)} data-testid="status-retry">
              Retry
            </button>
          )}
        </div>
      )}
      {reasonText && (
        <p id="status-reason" className="hint" data-testid="status-reason">
          {reasonText}
        </p>
      )}
      <div className="image-actions" role="group" aria-label="Status actions">
        {targets.map((item) => (
          <button
            key={item}
            ref={(element) => {
              triggers.current[item] = element;
            }}
            type="button"
            className="secondary-button"
            aria-disabled={disabled}
            aria-describedby={reasonText ? "status-reason" : undefined}
            onClick={() => ask(item)}
            data-testid={`status-${item}`}
          >
            {STATUS_ACTIONS[item].label}
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby="status-dialog-title"
        aria-describedby="status-dialog-text"
        data-testid="status-dialog"
        onClose={onClosed}
        onCancel={(event) => {
          // Escape: cancels, except while the request runs.
          event.preventDefault();
          close();
        }}
        onKeyDown={onKeyDown}
      >
        <h2 id="status-dialog-title" className="section-title">
          {text.title}
        </h2>
        <p id="status-dialog-text">{text.text}</p>
        {dialogError && (
          <p ref={dialogAlert} tabIndex={-1} role="alert" className="state-note" data-testid="status-error">
            {dialogError}
          </p>
        )}
        <p role="status" className="sr-only">
          {working ? text.working : ""}
        </p>
        <div className="image-actions">
          <button ref={cancel} type="button" className="secondary-button" aria-disabled={flag} onClick={close} data-testid="status-cancel">
            Cancel
          </button>
          <button ref={confirmButton} type="button" className="primary-button" aria-disabled={flag} onClick={() => void confirm()} data-testid="status-confirm">
            {working ? "Working…" : dialogError ? `Retry: ${text.label}` : text.label}
          </button>
        </div>
      </dialog>
    </section>
  );
}

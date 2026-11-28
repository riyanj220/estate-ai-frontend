"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { withTimeout } from "@/lib/forms/forms";
import { clearFlash, setFlash } from "@/lib/auth/flash";
import { acquireImageLock, imageLockHeld, releaseImageLock } from "@/lib/listing/image-lock";
import {
  DELETE_DRAFT_DONE,
  DELETE_DRAFT_FORBIDDEN,
  DELETE_DRAFT_GONE,
  DELETE_DRAFT_LABEL,
  DELETE_DRAFT_NAV_FAILED,
  DELETE_DRAFT_PUBLISHED,
  DELETE_DRAFT_TEXT,
  DELETE_DRAFT_TITLE,
  DELETE_DRAFT_WAIT,
  LISTINGS_PATH,
} from "@/lib/listing/listing-messages";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { useSession } from "@/lib/auth/session";

/** The backend's own not-found answer: `{error: {code: "not_found"}}`. A proxy's or a router's 404 is something else. */
function isNotFoundEnvelope(body: unknown): boolean {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const inner = (body as { error: unknown }).error;
  return typeof inner === "object" && inner !== null && (inner as { code?: unknown }).code === "not_found";
}

/**
 * The Delete draft action of the Draft page (Story 2.13), shown only for a `draft`. Deleting asks first in a modal dialog (the native
 * `<dialog>`: the page behind it is inert, Escape cancels, focus returns to the button). It takes the same module-wide image lock as an
 * image action, so it never starts while an upload or an image change runs (and none starts while it runs), and it never starts while a
 * field save is in flight. Edits not saved are discarded without a second prompt. 204 and 404 (already gone) go to My listings with a
 * polite confirmation; 409 says a published listing cannot be deleted here; any other failure keeps the page with an error.
 */
export function DeleteDraft({
  listingId,
  isDraft,
  blocked,
  saveRunning,
  onBusyChange,
  onSessionGone,
  onConflict,
}: {
  listingId: string;
  /** False once the server has said it is not a draft: only the explaining note stays, the action is gone. */
  isDraft: boolean;
  /** A field save or an image action is running (rendered state). */
  blocked: boolean;
  /** The same for a save that started in this very event (a ref read). */
  saveRunning: () => boolean;
  onBusyChange: (busy: boolean) => void;
  onSessionGone: () => Promise<void>;
  /** The server says this is not a draft (409): the page reads the Listing again so its status and controls are right. */
  onConflict: () => void;
}) {
  const router = useRouter();
  const { account } = useSession();
  const [token] = useState(() => Symbol("delete-draft"));
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const dialogAlert = useRef<HTMLParagraphElement>(null);
  const pageAlert = useRef<HTMLParagraphElement>(null);
  // Set when a message took the focus on purpose: closing the dialog then does not pull it back to the button.
  const keepFocus = useRef(false);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const latestBusy = useRef(onBusyChange);
  useEffect(() => {
    latestBusy.current = onBusyChange;
  });
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [pageNote, setPageNote] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (failsafe.current) clearTimeout(failsafe.current);
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
      trigger.current?.focus(); // back to the button that opened it
    }
  }, [open]);

  const busyNow = () => blocked || saveRunning() || imageLockHeld() || running.current;

  function ask() {
    if (busyNow()) {
      setPageNote({ text: DELETE_DRAFT_WAIT, tone: "info" });
      return;
    }
    setPageNote(null);
    setDialogError("");
    keepFocus.current = false;
    setOpen(true);
    // The dialog may have been closed by the platform behind the state's back: open it again now.
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      cancel.current?.focus();
    }
  }

  /** Any close: the state follows the platform (a second Escape closes even a dialog whose cancel was prevented). */
  function onClosed() {
    const element = dialog.current;
    if (running.current) {
      // A running delete keeps its dialog: the platform closed it, so it is opened again.
      if (element && !element.open) element.showModal();
      return;
    }
    setOpen(false);
    if (!keepFocus.current) trigger.current?.focus();
  }

  /** The navigation after a success or a 401 did not unmount this page in time: give the page back instead of leaving it locked. */
  function armFailsafe(afterSuccess: boolean) {
    failsafe.current = setTimeout(() => {
      if (!mounted.current) return;
      releaseImageLock(token);
      latestBusy.current(false);
      setWorking(false);
      setOpen(false);
      keepFocus.current = true;
      setPageNote({ text: afterSuccess ? DELETE_DRAFT_NAV_FAILED : failureMessage(0, null), tone: "error" });
    }, 4000);
  }

  function close() {
    if (running.current) return;
    setOpen(false);
  }

  async function confirm() {
    if (running.current) return;
    if (blocked || saveRunning() || !acquireImageLock(token)) {
      setDialogError(DELETE_DRAFT_WAIT);
      return;
    }
    running.current = true;
    setWorking(true);
    setDialogError("");
    latestBusy.current(true);
    let navigating = false;
    try {
      const api = await getApi();
      const { error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.DELETE("/api/v1/listings/{listing_id}", { params: { path: { listing_id: listingId } }, headers: { "X-CSRFToken": csrf }, signal }),
        ),
      );
      if (response.status === 401) {
        navigating = true;
        clearFlash();
        armFailsafe(false);
        await onSessionGone();
        return;
      }
      // 404 is "already gone" only when it is the backend's own not-found answer; any other 404 (a proxy, a missing route) is a failure.
      const backendNotFound = response.status === 404 && isNotFoundEnvelope(error);
      if (response.ok || backendNotFound) {
        setFlash(response.ok ? DELETE_DRAFT_DONE : DELETE_DRAFT_GONE, LISTINGS_PATH);
        navigating = true;
        armFailsafe(true);
        router.push(LISTINGS_PATH);
        return;
      }
      if (response.status === 409) {
        keepFocus.current = true;
        setOpen(false);
        setPageNote({ text: DELETE_DRAFT_PUBLISHED, tone: "error" });
        onConflict();
        return;
      }
      fail(
        response.status === 403 && account?.state === "suspended"
          ? DELETE_DRAFT_FORBIDDEN
          : failureMessage(response.status, response.headers.get("Retry-After")),
      );
    } catch (thrown) {
      fail(thrownMessage(thrown));
    } finally {
      running.current = false;
      if (!navigating || !mounted.current) {
        releaseImageLock(token);
        latestBusy.current(false);
      }
      if (mounted.current && !navigating) setWorking(false);
    }
  }

  /** A failure is shown in the dialog and on the page (the dialog may be closed by the platform); the open dialog takes the attention. */
  function fail(text: string) {
    keepFocus.current = true;
    setDialogError(text);
    setPageNote({ text, tone: "error" });
  }

  // A failure message or the 409 note takes the reader's attention once.
  useEffect(() => {
    if (!dialogError && pageNote?.tone !== "error") return;
    const element = dialog.current;
    (element?.open ? dialogAlert : pageAlert).current?.focus();
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

  // The Listing turned out not to be a draft: the explaining note replaces the section, so it takes the focus the section had.
  useEffect(() => {
    if (!isDraft) pageAlert.current?.focus();
  }, [isDraft, pageNote]);

  const flag = working ? true : undefined;
  if (!isDraft) {
    return pageNote ? (
      <p ref={pageAlert} tabIndex={-1} role="alert" className="notice" data-testid="delete-note">
        {pageNote.text}
      </p>
    ) : null;
  }
  return (
    <section className="card" aria-labelledby="delete-draft-title" style={{ marginBottom: "var(--space)" }}>
      <h2 id="delete-draft-title" className="section-title">
        Delete this draft
      </h2>
      <p className="muted">{DELETE_DRAFT_TEXT}</p>
      {pageNote && (
        <p
          ref={pageAlert}
          tabIndex={-1}
          role={pageNote.tone === "error" && !open ? "alert" : "status"}
          className={pageNote.tone === "error" ? "notice" : "muted"}
          data-testid="delete-note"
        >
          {pageNote.text}
        </p>
      )}
      <button ref={trigger} type="button" className="secondary-button" aria-disabled={blocked || working ? true : undefined} onClick={ask} data-testid="delete-draft">
        {DELETE_DRAFT_LABEL}
      </button>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-text"
        data-testid="delete-dialog"
        onClose={onClosed}
        onCancel={(event) => {
          // Escape: cancels, except while the request runs.
          event.preventDefault();
          close();
        }}
        onKeyDown={onKeyDown}
      >
        <h2 id="delete-dialog-title" className="section-title">
          {DELETE_DRAFT_TITLE}
        </h2>
        <p id="delete-dialog-text">{DELETE_DRAFT_TEXT}</p>
        {dialogError && (
          <p ref={dialogAlert} tabIndex={-1} role="alert" className="state-note" data-testid="delete-error">
            {dialogError}
          </p>
        )}
        <p role="status" className="sr-only">
          {working ? "Deleting the draft…" : ""}
        </p>
        <div className="image-actions">
          <button ref={cancel} type="button" className="secondary-button" aria-disabled={flag} onClick={close} data-testid="delete-cancel">
            Cancel
          </button>
          <button ref={confirmButton} type="button" className="primary-button" aria-disabled={flag} onClick={() => void confirm()} data-testid="delete-confirm">
            {working ? "Deleting…" : DELETE_DRAFT_LABEL}
          </button>
        </div>
      </dialog>
    </section>
  );
}

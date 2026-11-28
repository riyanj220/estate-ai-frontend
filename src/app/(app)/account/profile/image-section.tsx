"use client";

import { useEffect, useRef, useState } from "react";
import { RetryImage } from "@/components/retry-image";
import { getApi } from "@/lib/api";
import { CsrfFetchError, withCsrf } from "@/lib/csrf";
import { UPLOAD_TIMEOUT_MS, anySignal, withTimeout } from "@/lib/forms";
import { acquireImageLock, imageLockHeld, profileSaveHeld, releaseImageLock } from "@/lib/image-lock";
import { IMAGES_FORBIDDEN, MAX_UPLOAD_BYTES, UPLOAD_FILE_MESSAGES } from "@/lib/listing-messages";
import {
  PROFILE_IMAGE_BUSY,
  PROFILE_IMAGE_CAP,
  PROFILE_IMAGE_REFRESH_FAILED,
  PROFILE_IMAGE_RELOADED,
  PROFILE_IMAGE_SAVING,
  PROFILE_IMAGE_TEXT,
  PROFILE_IMAGE_UNKNOWN,
  PROFILE_IMAGE_UNREADABLE,
  readOwnerImage,
  type OwnerImage,
  type ProfileImageKind,
} from "@/lib/profile-image";
import { nextStamp } from "@/lib/read-stamp";
import { thrownMessage } from "@/lib/request-errors";
import { useSession } from "@/lib/session";
import { uploadErrorMessage } from "@/lib/upload-errors";
import { useFormFeedback } from "@/lib/use-form-feedback";
import { usePageshowRecheck } from "@/lib/use-pageshow-recheck";
import { PROFILE_PATH } from "@/lib/use-profile-load";

type Notice = { kind: "error" | "wait" | "ok"; text: string };
type Shown = { image: OwnerImage | null; stamp: number; version: number; mine: boolean };
type ReadOutcome = "applied" | "superseded" | "failed";

const ALLOWED_TYPES = "image/jpeg,image/png,image/webp";
const INPUT_ID = "profile-image-input";
const REMOVE_ID = "profile-image-remove";
const CANCEL_ID = "profile-image-cancel";
const AFTER = "after"; // focus goes to the Remove button when an image is shown, else to the picker
const SIGN_IN = `/sign-in?next=${encodeURIComponent(PROFILE_PATH)}`;

type Answer = { data?: unknown; error?: unknown; response: Response };

/**
 * The profile picture (Individual) or Agency logo (Story 2.11): its own section with its own state, never sharing the text form's Save.
 * The two exclude each other (`onBusyChange` pauses that Save while an image action runs; `locked` pauses these actions while a text
 * save is in flight). What is shown comes from the server: the answer of the upload, the answer of a re-read after a lost answer, or
 * the page's profile read. Every one carries a stamp (see `read-stamp.ts`), and an older answer never replaces a newer one. Nothing about
 * a file is kept: no file name is read, no preview URL is made, nothing is stored or logged. The image URL is the owner route and is
 * never shown as text; the picker's choice is cleared as soon as it is read.
 */
export function ProfileImageSection({
  kind,
  image,
  readStamp,
  locked,
  onBusyChange,
  reread,
  onSessionGone,
}: {
  kind: ProfileImageKind;
  /** The picture the page's latest profile read carried, and the stamp that read took before it asked. */
  image: OwnerImage | null;
  readStamp: number;
  /** A text save is in flight: the image actions wait. */
  locked: boolean;
  /** Whether an image action is running (the page pauses the text form's Save meanwhile). */
  onBusyChange: (busy: boolean) => void;
  /** Reads the profile again quietly: applied, superseded by a newer read (whose answer applies), or failed. */
  reread: () => Promise<ReadOutcome>;
  onSessionGone: () => Promise<void>;
}) {
  const text = PROFILE_IMAGE_TEXT[kind];
  const { account } = useSession();
  const { announcement, announce, resetAnnouncement } = useFormFeedback();
  const [shown, setShown] = useState<Shown>({ image, stamp: readStamp, version: 0, mine: false });
  const [force, setForce] = useState(false);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [, setFocusTick] = useState(0);
  const [token] = useState(() => Symbol("profile-image"));
  const mounted = useRef(true);
  const focusRequest = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const hasImage = useRef(shown.image !== null);
  const workingRef = useRef(false);
  const latest = useRef({ locked, onBusyChange, reread });
  useEffect(() => {
    latest.current = { locked, onBusyChange, reread };
    hasImage.current = shown.image !== null;
  });

  // A profile read that started after the last change replaces what is shown; an older one never does.
  if (readStamp > shown.stamp) {
    const changed = JSON.stringify(image) !== JSON.stringify(shown.image);
    // The wire carries no identity of the bytes, so after a change this page made itself the first newer read mounts the image afresh
    // (a replacement from another tab with the same size and type would otherwise go unnoticed). The cost is one extra image request.
    setShown({ image, stamp: readStamp, version: changed || force || shown.mine ? shown.version + 1 : shown.version, mine: false });
    if (force) setForce(false);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort(); // nothing is handed to a page that is gone
      workingRef.current = false;
      if (releaseImageLock(token, "profile")) latest.current.onBusyChange(false);
    };
  }, [token]);
  // A focus move waits for the render that carries the new state.
  useEffect(() => {
    if (focusRequest.current === null) return;
    const id = focusRequest.current === AFTER ? (hasImage.current ? REMOVE_ID : INPUT_ID) : focusRequest.current;
    focusRequest.current = null;
    document.getElementById(id)?.focus();
  });
  // Leaving the page while an upload runs asks first.
  useEffect(() => {
    if (!uploading) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [uploading]);
  // A restore from the back-forward cache: the session is checked, then the picture is read again and a stale prompt is dropped.
  usePageshowRecheck(SIGN_IN, () => {
    setConfirming(false);
    setNotice((current) => (current?.kind === "wait" ? null : current));
    void latest.current.reread();
  });

  const waiting = working || locked;
  const focusLater = (id: string) => {
    focusRequest.current = id;
    setFocusTick((tick) => tick + 1);
  };

  const blockedBySave = () => latest.current.locked || profileSaveHeld();

  /** Takes the one right to change the picture (module-wide); false when another action runs or a text save is in flight. */
  function begin(): boolean {
    if (blockedBySave() || !acquireImageLock(token, "profile")) return false;
    workingRef.current = true;
    setWorking(true);
    latest.current.onBusyChange(true);
    setNotice(null);
    resetAnnouncement();
    return true;
  }
  function finish() {
    workingRef.current = false;
    // A stale instance (one that was unmounted and replaced) no longer holds the lock and must not touch the page's busy flag.
    if (releaseImageLock(token, "profile")) latest.current.onBusyChange(false);
    if (mounted.current) {
      resetAnnouncement(); // a pending "Uploading…" must not land after the result
      setWorking(false);
      setUploading(false);
    }
  }
  /** A request that cannot start: say why and bring focus back, unless this very instance is already working (a double click). */
  function refuse() {
    if (workingRef.current) return;
    setNotice({ kind: "wait", text: blockedBySave() ? PROFILE_IMAGE_SAVING : PROFILE_IMAGE_BUSY });
    focusLater(INPUT_ID);
  }

  /** The change landed: show the server's answer. */
  function adopt(next: OwnerImage | null) {
    const stamp = nextStamp();
    setShown((current) => ({ image: next, stamp, version: current.version + 1, mine: true }));
    hasImage.current = next !== null;
  }

  /** The outcome is not known (a lost answer, a server error): read the profile again and let that answer decide what is shown. */
  async function recheck(message: string, suffix: string = PROFILE_IMAGE_UNKNOWN): Promise<string> {
    setForce(true);
    const outcome: ReadOutcome = await latest.current.reread().catch((): ReadOutcome => "failed");
    // A superseded read is not a failure: the newer read's answer applies. A failed one leaves nothing to bump.
    if (outcome === "failed") {
      setForce(false);
      return `${message} ${PROFILE_IMAGE_REFRESH_FAILED}`;
    }
    return `${message} ${suffix}`;
  }

  async function put(file: File, signal: AbortSignal): Promise<Answer> {
    const api = await getApi();
    return withCsrf((csrf) =>
      withTimeout((timeout) => {
        // One part named `file`; a fresh body per attempt (the CSRF retry sends it again). The content type is left to the browser.
        const form = new FormData();
        form.append("file", file);
        const options = { body: { file: "" }, bodySerializer: () => form, headers: { "X-CSRFToken": csrf }, signal: anySignal([timeout, signal]) };
        return kind === "individual" ? api.PUT("/api/v1/me/profile/image", options) : api.PUT("/api/v1/me/agency-profile/image", options);
      }, UPLOAD_TIMEOUT_MS),
    );
  }
  async function del(signal: AbortSignal): Promise<Answer> {
    const api = await getApi();
    return withCsrf((csrf) =>
      withTimeout((timeout) => {
        const options = { headers: { "X-CSRFToken": csrf }, signal: anySignal([timeout, signal]) };
        return kind === "individual" ? api.DELETE("/api/v1/me/profile/image", options) : api.DELETE("/api/v1/me/agency-profile/image", options);
      }),
    );
  }

  /**
   * The text of a refusal and what the page must do about it: `unsure` (a 5xx other than "busy": the server may have changed something) and
   * `reload` (a removal that met 404 or 409: the page's picture may be out of date) both read the profile again.
   */
  function refusal(answer: Answer, removing = false): { text: string; unsure: boolean; reload: boolean } {
    const status = answer.response.status;
    const text = uploadErrorMessage({
      status,
      error: answer.error,
      retryAfter: answer.response.headers.get("Retry-After"),
      suspended: account?.state === "suspended",
      forbidden: IMAGES_FORBIDDEN,
      conflicts: PROFILE_IMAGE_CAP,
    });
    return { text, unsure: status >= 500 && status !== 503, reload: removing && (status === 404 || status === 409) };
  }

  async function onChoose(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // the same file can be chosen again; the browser keeps nothing
    if (!file) return;
    // A running action comes first: a size notice must not interrupt it.
    if (!begin()) {
      refuse();
      return;
    }
    // Refused here, never sent: a body over the backend's cap.
    if (file.size > MAX_UPLOAD_BYTES) {
      finish();
      setConfirming(false);
      setNotice({ kind: "error", text: UPLOAD_FILE_MESSAGES.too_large });
      focusLater(INPUT_ID);
      return;
    }
    const cancel = new AbortController();
    request.current = cancel;
    setUploading(true);
    setConfirming(false);
    announce(text.uploading);
    let end = false;
    let next: Notice | null = null;
    try {
      const answer = await put(file, cancel.signal);
      const { response } = answer;
      if (response.ok) {
        const stored = readOwnerImage(answer.data, kind);
        if (stored) {
          adopt(stored);
          next = { kind: "ok", text: text.updated };
        } else {
          // The upload was accepted but the answer cannot be trusted: what the server holds decides.
          next = { kind: "error", text: await recheck(PROFILE_IMAGE_UNREADABLE) };
        }
      } else if (response.status === 401) end = true;
      else {
        const { text: message, unsure } = refusal(answer);
        next = { kind: "error", text: unsure ? await recheck(message) : message };
      }
    } catch (thrown) {
      if (cancel.signal.aborted) next = null;
      // A request that never left (no CSRF token) is a plain failure; a lost answer or a timeout may have stored the image.
      else next = { kind: "error", text: thrown instanceof CsrfFetchError ? thrownMessage(thrown) : await recheck(thrownMessage(thrown)) };
    } finally {
      if (request.current === cancel) request.current = null;
      finish();
    }
    if (!mounted.current) return;
    if (end) return void (await onSessionGone());
    setNotice(next);
    focusLater(next?.kind === "ok" ? INPUT_ID : AFTER);
  }

  async function remove() {
    if (!begin()) {
      refuse();
      return;
    }
    const cancel = new AbortController();
    request.current = cancel;
    let end = false;
    let next: Notice | null = null;
    try {
      const answer = await del(cancel.signal);
      const { response } = answer;
      if (response.ok) {
        adopt(null);
        next = { kind: "ok", text: text.removed };
      } else if (response.status === 401) end = true;
      else {
        const { text: message, unsure, reload } = refusal(answer, true);
        next = { kind: "error", text: unsure ? await recheck(message) : reload ? await recheck(message, PROFILE_IMAGE_RELOADED) : message };
      }
    } catch (thrown) {
      if (cancel.signal.aborted) next = null;
      else next = { kind: "error", text: thrown instanceof CsrfFetchError ? thrownMessage(thrown) : await recheck(thrownMessage(thrown)) };
    } finally {
      if (request.current === cancel) request.current = null;
      finish();
    }
    if (!mounted.current) return;
    setConfirming(false);
    if (end) return void (await onSessionGone());
    setNotice(next);
    focusLater(AFTER);
  }

  function askRemove() {
    if (imageLockHeld("profile")) return;
    if (blockedBySave()) {
      setNotice({ kind: "wait", text: PROFILE_IMAGE_SAVING });
      return;
    }
    setNotice(null);
    setConfirming(true);
    focusLater(CANCEL_ID);
  }
  function cancelRemove() {
    if (imageLockHeld("profile")) return;
    setConfirming(false);
    focusLater(REMOVE_ID);
  }

  const flag = waiting ? true : undefined;
  return (
    <section className="card" aria-labelledby="profile-image-title" data-testid="profile-image-section" data-read-seen={readStamp} style={{ marginBottom: "var(--space)" }}>
      <h2 id="profile-image-title" className="section-title">
        {text.title}
      </h2>
      <div className="profile-image-frame" data-kind={kind}>
        {shown.image ? (
          <RetryImage
            key={shown.version}
            // The owner route never changes, so a replaced image would be served from the browser's memory: a counter makes it a new request.
            url={shown.version > 0 ? `${shown.image.url}?r=${shown.version}` : shown.image.url}
            alt={text.alt}
            label={`your ${text.noun}`}
            className="profile-image"
            failedClassName="profile-image profile-image-failed"
            failedTestId="profile-image-failed"
          />
        ) : (
          <div className="profile-image profile-image-placeholder border border-border border-dashed" aria-hidden="true" data-testid="profile-image-placeholder" />
        )}
      </div>
      {!shown.image && (
        <p className="muted" data-testid="profile-image-empty">
          {text.empty}
        </p>
      )}
      {/* The one live region of this section: a result or a failure, and the "uploading" announcement. */}
      <div role="status" aria-live="polite" data-testid="profile-image-live">
        {notice && (
          <p className={notice.kind === "ok" ? "hint" : "notice"} data-testid={notice.kind === "ok" ? "profile-image-success" : "profile-image-notice"} data-kind={notice.kind}>
            {notice.text}
          </p>
        )}
        <span className="sr-only" data-testid="profile-image-announcement">
          {announcement}
        </span>
      </div>
      <div className="image-add">
        <label htmlFor={INPUT_ID}>{text.label}</label>
        <input
          id={INPUT_ID}
          type="file"
          accept={ALLOWED_TYPES}
          aria-describedby="profile-image-hint"
          aria-disabled={flag}
          // A running action blocks the picker without disabling the control.
          onClick={(event) => {
            if (waiting) event.preventDefault();
          }}
          onChange={onChoose}
        />
        <p id="profile-image-hint" className="hint">
          {text.hint}
        </p>
      </div>
      {shown.image &&
        (confirming ? (
          <div
            role="group"
            aria-label={text.remove}
            className="image-actions"
            data-testid="profile-image-confirm"
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelRemove();
            }}
          >
            <p className="basis-full m-0">{text.removeAsk}</p>
            <button type="button" className="primary-button" aria-disabled={flag} onClick={() => void remove()}>
              Yes, remove
            </button>
            <button
              type="button"
              id={CANCEL_ID}
              className="secondary-button"
              aria-disabled={flag}
              onClick={cancelRemove}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="image-actions">
            <button type="button" id={REMOVE_ID} className="secondary-button" aria-disabled={flag} onClick={askRemove}>
              {text.remove}
            </button>
          </div>
        ))}
    </section>
  );
}

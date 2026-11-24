"use client";

import { useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { CsrfFetchError, withCsrf } from "@/lib/csrf";
import { acquireImageLock, imageLockHeld, releaseImageLock } from "@/lib/image-lock";
import { REJECTED_ERROR, UPLOAD_TIMEOUT_MS, rateLimitMessage, readErrorBody, withTimeout } from "@/lib/forms";
import { readListing, type ListingView, type MediaItem } from "@/lib/listing-labels";
import {
  IMAGES_ALREADY_GONE,
  IMAGES_CONFLICT,
  IMAGES_EMPTY,
  IMAGES_FORBIDDEN,
  IMAGES_HINT,
  IMAGES_LIMIT_REACHED,
  IMAGES_LIST_FULL,
  IMAGES_ONE_AT_A_TIME,
  IMAGES_REFRESH_FAILED,
  IMAGES_UNKNOWN,
  IMAGES_UNREADABLE,
  IMAGE_LOAD_FAILED,
  LATEST_NOT_LOADED,
  MAX_IMAGES,
  MAX_UPLOAD_BYTES,
  ORDER_CHANGED,
  UPLOAD_BUSY,
  UPLOAD_CONFLICT_MESSAGES,
  UPLOAD_FILE_MESSAGES,
} from "@/lib/listing-messages";
import { mapKnownCodes } from "@/lib/password-messages";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useSession } from "@/lib/session";
import { useFormFeedback } from "@/lib/use-form-feedback";
import type { Latest } from "./draft-editor";

type RowState = "waiting" | "uploading" | "done" | "failed" | "skipped" | "unknown";
/** One file of the current upload. The name lives in this component's state only: it is never stored or logged. */
type Row = { key: number; name: string; state: RowState; message: string };
type Notice = { kind: "conflict" | "error" | "wait"; text: string };
/** How one upload ended: whether to go on with the next file and whether the Draft must be read again. */
type Outcome = { state: "done" | "failed" | "unknown"; message: string; stop: boolean; reread: boolean; end?: "gone" | "missing" };
type Read = { kind: "ok"; media: MediaItem[] } | { kind: "gone" | "missing" | "error" };

const STATE_TEXT: Record<RowState, string> = { waiting: "Waiting", uploading: "Uploading…", done: "Uploaded", failed: "Not uploaded", skipped: "Not uploaded", unknown: "Unknown" };
const SKIPPED = "An earlier image could not be added, so this one was not sent.";
const ALLOWED_TYPES = "image/jpeg,image/png,image/webp";

/** "Try again in 7 seconds." from a `Retry-After` of plain digits; anything else is "shortly" (the header is only ever shown as text). */
function retryText(header: string | null): string {
  if (header === null || !/^[1-9][0-9]{0,3}$/.test(header)) return "Try again shortly.";
  return `Try again in ${header} ${header === "1" ? "second" : "seconds"}.`;
}

/** One thumbnail: a plain same-origin `<img>`; when it cannot load, the reason and a Retry (which mounts a fresh `<img>`). */
function Thumb({ url, alt, label }: { url: string; alt: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) {
    return (
      <div className="image-thumb image-failed" data-testid="image-failed">
        <p>{IMAGE_LOAD_FAILED}</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setFailed(false);
            setAttempt((tick) => tick + 1);
          }}
        >
          Retry<span className="sr-only"> loading {label}</span>
        </button>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a same-origin, owner-only, no-store URL: the image optimiser must never see it
    <img key={attempt} src={url} alt={alt} loading="lazy" className="image-thumb" onError={() => setFailed(true)} />
  );
}

/**
 * The Images section of the Draft page (Story 2.10): upload, reorder, choose the cover and delete. It has its own state and never
 * shares the field form's Save; the two exclude each other (`onBusyChange` pauses Save while images change, `locked` pauses the
 * image actions while a field save is in flight). The list shown is the Draft's `media` (a prop); every answer that carries the
 * Listing, and a read after an upload or a delete (which return no revision), goes to `onListing`, so the page's revision and media
 * stay in step and a field save that follows does not conflict. Thumbnails are plain same-origin `<img>` elements: no preview URL is
 * ever created, and nothing about a file or an image is stored or logged. A conflict that also changed fields raises the editor's
 * own alert, which takes focus after this section's focus move (child effects run first); this notice stays in the live region.
 */
export function ImagesSection({
  listingId,
  revision,
  media,
  locked,
  onListing,
  onBusyChange,
  refresh,
  onSessionGone,
  onNotFound,
}: {
  listingId: string;
  revision: number | null;
  media: MediaItem[];
  /** A field save is in flight: the image actions wait. */
  locked: boolean;
  /** A Listing the server answered with (or a fresh read): the page takes its revision and media. */
  onListing: (next: ListingView) => void;
  /** Whether an image action is running (the page pauses its own Save meanwhile). */
  onBusyChange: (busy: boolean) => void;
  /** Reads the Draft again (an upload or a delete answers without a revision). */
  refresh: () => Promise<Latest>;
  onSessionGone: () => Promise<void>;
  onNotFound: () => void;
}) {
  const { account } = useSession();
  const { announcement, announce, resetAnnouncement } = useFormFeedback();
  const [rows, setRows] = useState<Row[]>([]);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [, setFocusTick] = useState(0);
  const [token] = useState(() => Symbol("images"));
  const mounted = useRef(true);
  const focusRequest = useRef<string | null>(null);
  const batch = useRef<AbortController | null>(null);
  // The latest values for the async answers (a batch of uploads outlives the render that started it).
  const latest = useRef({ media, onListing, refresh, revision, locked, onBusyChange });
  useEffect(() => {
    latest.current = { media, onListing, refresh, revision, locked, onBusyChange };
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      batch.current?.abort(); // the loop stops, and nothing is handed to a page that is gone
      if (releaseImageLock(token)) latest.current.onBusyChange(false);
    };
  }, [token]);
  // A focus move waits for the render that carries the new list.
  useEffect(() => {
    if (focusRequest.current === null) return;
    const target = document.getElementById(focusRequest.current);
    focusRequest.current = null;
    target?.focus();
  });
  // Leaving the page while a batch runs asks first.
  useEffect(() => {
    if (!uploading) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [uploading]);

  const count = media.length;
  const full = count >= MAX_IMAGES;
  const waiting = working || locked;
  const flag = waiting ? true : undefined;
  const focusLater = (id: string) => {
    focusRequest.current = id;
    setFocusTick((tick) => tick + 1);
  };

  /** Takes the one right to change images (module-wide); false when another action runs or a field save is in flight. */
  function begin(): boolean {
    if (latest.current.locked || !acquireImageLock(token)) return false;
    setWorking(true);
    latest.current.onBusyChange(true);
    setNotice((current) => (current?.kind === "wait" ? null : current));
    return true;
  }
  function finish() {
    releaseImageLock(token);
    latest.current.onBusyChange(false);
    if (mounted.current) {
      setWorking(false);
      setUploading(false);
      setNotice((current) => (current?.kind === "wait" ? null : current));
    }
  }
  function wait() {
    if (!mounted.current) return;
    setNotice({ kind: "wait", text: IMAGES_ONE_AT_A_TIME });
  }

  /** Reads the Draft again and hands it to the page; never throws. `media` is the list just read (the props follow after the next render). */
  async function reload(): Promise<Read> {
    try {
      const answer = await latest.current.refresh();
      if (!mounted.current) return { kind: "error" };
      if (answer.kind === "found") {
        if (answer.listing.id !== listingId) return { kind: "error" };
        latest.current.onListing(answer.listing);
        return { kind: "ok", media: answer.listing.media };
      }
      return { kind: answer.kind === "gone" || answer.kind === "missing" ? answer.kind : "error" };
    } catch {
      return { kind: "error" };
    }
  }

  /** Ends whatever the Draft page must do when the session is gone or the Draft cannot be found. */
  async function leave(end: "gone" | "missing") {
    if (!mounted.current) return;
    if (end === "gone") await onSessionGone();
    else onNotFound();
  }

  /** Where focus goes after a read: the same image's `target` when it is still there, else the image that took its place, else the picker. */
  function focusAfter(read: Read, index: number, target: string, id: string): string {
    if (read.kind !== "ok") return target;
    if (read.media.some((entry) => entry.id === id)) return target;
    const next = read.media[Math.min(Math.max(index, 0), read.media.length - 1)];
    return next ? `image-item-${next.id}` : "images-add";
  }

  async function uploadOne(file: File, cancel: AbortSignal): Promise<Outcome> {
    try {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) => {
          // One part named `file`; a fresh body per attempt (the CSRF retry sends it again). The content type is left to the browser.
          const form = new FormData();
          form.append("file", file);
          return api.POST("/api/v1/listings/{listing_id}/images", {
            params: { path: { listing_id: listingId } },
            body: { file: "" },
            bodySerializer: () => form,
            headers: { "X-CSRFToken": csrf },
            signal: AbortSignal.any([signal, cancel]),
          });
        }, UPLOAD_TIMEOUT_MS),
      );
      if (response.ok) {
        const created = typeof data === "object" && data !== null ? (data as { id?: unknown }).id : null;
        if (typeof created === "string" && created) return { state: "done", message: "", stop: false, reread: true };
        return { state: "unknown", message: IMAGES_UNREADABLE, stop: true, reread: true };
      }
      if (response.status === 401) return { state: "failed", message: "Your session ended.", stop: true, reread: false, end: "gone" };
      if (response.status === 404) return { state: "failed", message: "This draft could not be found.", stop: true, reread: false, end: "missing" };
      const parsed = readErrorBody(error);
      // A file the server refuses for its size or its content is that file's own problem: the others still go.
      if (response.status === 413) return { state: "failed", message: UPLOAD_FILE_MESSAGES.too_large, stop: false, reread: false };
      if (response.status === 400) {
        const codes = parsed?.fields.file ?? [];
        // Known codes only; a field with no known code is the generic text, never the server's own words.
        const messages = codes.length > 0 ? mapKnownCodes(codes, UPLOAD_FILE_MESSAGES, REJECTED_ERROR) : [REJECTED_ERROR];
        return { state: "failed", message: messages[0], stop: false, reread: false };
      }
      if (response.status === 409) {
        const code = parsed?.code;
        const text = typeof code === "string" && Object.hasOwn(UPLOAD_CONFLICT_MESSAGES, code) ? UPLOAD_CONFLICT_MESSAGES[code] : REJECTED_ERROR;
        return { state: "failed", message: text, stop: true, reread: true };
      }
      if (response.status === 403) return { state: "failed", message: account?.state === "suspended" ? IMAGES_FORBIDDEN : failureMessage(403, null), stop: true, reread: false };
      if (response.status === 503) {
        return { state: "failed", message: `${UPLOAD_BUSY} ${retryText(response.headers.get("Retry-After"))}`, stop: true, reread: false };
      }
      if (response.status === 429) return { state: "failed", message: rateLimitMessage(response.headers.get("Retry-After")), stop: true, reread: false };
      // A server error may have come after the image was stored: the outcome is unknown.
      if (response.status >= 500) return { state: "unknown", message: failureMessage(response.status, null), stop: true, reread: true };
      return { state: "failed", message: failureMessage(response.status, null), stop: true, reread: false };
    } catch (thrown) {
      if (cancel.aborted) return { state: "failed", message: "", stop: true, reread: false };
      // A request that never left (no CSRF token) is a plain failure; a lost answer or a timeout may have stored the image.
      if (thrown instanceof CsrfFetchError) return { state: "failed", message: thrownMessage(thrown), stop: true, reread: false };
      return { state: "unknown", message: thrownMessage(thrown), stop: true, reread: true };
    }
  }

  async function onChoose(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const chosen = Array.from(input.files ?? []);
    input.value = ""; // the same file can be chosen again; the browser keeps nothing
    if (chosen.length === 0) return;
    if (!begin()) {
      // Files dropped onto the picker while something runs are not taken: say so.
      if (latest.current.locked) setNotice({ kind: "error", text: "Wait for your changes to be saved, then add images." });
      else wait();
      announce(IMAGES_ONE_AT_A_TIME);
      return;
    }
    const cancel = new AbortController();
    batch.current = cancel;
    setUploading(true);
    setNotice(null);
    setConfirming(null);
    const total = chosen.length;
    let table: Row[] = chosen.map((file, index) => ({ key: index, name: file.name, state: "waiting", message: "" }));
    const show = (index: number, patch: Partial<Row>) => {
      table = table.map((row, at) => (at === index ? { ...row, ...patch } : row));
      if (mounted.current) setRows(table);
    };
    setRows(table);
    let stopped = false;
    let reread = false;
    let end: "gone" | "missing" | undefined;
    let added = 0;
    let known = latest.current.media.length; // what the server holds as far as this batch has read
    try {
      for (let index = 0; index < total; index++) {
        if (cancel.signal.aborted) stopped = true;
        if (stopped) {
          show(index, { state: "skipped", message: SKIPPED });
          continue;
        }
        const file = chosen[index];
        // Refused here, never sent: a body over the backend's cap (the others still go).
        if (file.size > MAX_UPLOAD_BYTES) {
          show(index, { state: "failed", message: UPLOAD_FILE_MESSAGES.too_large });
          continue;
        }
        // The server decides; this only avoids sending what is certain to be refused.
        if (known >= MAX_IMAGES) {
          show(index, { state: "failed", message: IMAGES_LIST_FULL });
          continue;
        }
        show(index, { state: "uploading" });
        announce(total > 1 ? `Uploading image ${index + 1} of ${total}.` : "Uploading image.");
        const outcome = await uploadOne(file, cancel.signal);
        show(index, { state: outcome.state, message: outcome.state === "unknown" ? `${outcome.message} ${IMAGES_UNKNOWN}` : outcome.message });
        if (outcome.state === "done") {
          added += 1;
          // The answer carries no revision: the Draft is read so the page's revision and list are the server's.
          const read = await reload();
          if (read.kind === "ok") known = read.media.length;
          else if (read.kind === "gone" || read.kind === "missing") {
            end = read.kind;
            stopped = true;
          } else {
            if (mounted.current) setNotice({ kind: "error", text: IMAGES_REFRESH_FAILED });
            stopped = true;
          }
        } else {
          reread = reread || outcome.reread;
          if (outcome.end) end = outcome.end;
          if (outcome.stop) stopped = true;
        }
      }
      if (reread && !end && !cancel.signal.aborted) {
        const read = await reload();
        if (read.kind === "gone" || read.kind === "missing") end = read.kind;
        else if (read.kind === "error" && mounted.current) setNotice({ kind: "error", text: IMAGES_REFRESH_FAILED });
      }
    } finally {
      // No row is ever left "Waiting" or "Uploading", whatever happened.
      table = table.map((row) => (row.state === "waiting" || row.state === "uploading" ? { ...row, state: "skipped", message: SKIPPED } : row));
      if (mounted.current) setRows(table);
      if (batch.current === cancel) batch.current = null;
      finish();
    }
    if (!mounted.current) return;
    const failed = table.filter((row) => row.state !== "done").length;
    resetAnnouncement();
    announce(failed === 0 ? `Uploaded ${added} ${added === 1 ? "image" : "images"}.` : `Uploaded ${added} of ${total}. ${failed} could not be confirmed or added; see the list.`);
    if (end) await leave(end);
  }

  /** Runs one revision-checked change of the order and/or the cover; `done` says what happened, `failFocus` is where focus returns when it did not. */
  async function change(order: string[], coverId: string | null, done: (next: ListingView) => { text: string; focus: string }, failFocus: string) {
    const base = latest.current.revision;
    if (base === null) {
      setNotice({ kind: "error", text: REJECTED_ERROR });
      focusLater(failFocus);
      return;
    }
    if (!begin()) return;
    setNotice(null);
    setConfirming(null);
    resetAnnouncement();
    let end: "gone" | "missing" | undefined;
    let ok = false;
    try {
      const api = await getApi();
      const body: components["schemas"]["ImageOrderRequest"] = coverId === null ? { base_revision: base, order } : { base_revision: base, order, cover_id: coverId };
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.PATCH("/api/v1/listings/{listing_id}/images", { params: { path: { listing_id: listingId } }, body, headers: { "X-CSRFToken": csrf }, signal }),
        ),
      );
      if (response.ok) {
        const next = readListing(data);
        if (next && next.id === listingId && next.revision !== null) {
          latest.current.onListing(next);
          const result = done(next);
          announce(result.text);
          focusLater(result.focus);
          ok = true;
        } else {
          setNotice({ kind: "error", text: IMAGES_UNREADABLE });
        }
      } else if (response.status === 401) end = "gone";
      else if (response.status === 404) end = "missing";
      else if (response.status === 409) {
        // Another session changed the Draft: its latest list replaces the one shown, and nothing is lost silently.
        const current = typeof error === "object" && error !== null ? readListing((error as { current?: unknown }).current) : null;
        let adopted = current && current.id === listingId && current.revision !== null && current.revision > base ? current : null;
        if (!adopted) {
          let again: Latest;
          try {
            again = await latest.current.refresh();
          } catch {
            again = { kind: "error" };
          }
          if (again.kind === "found" && again.listing.id === listingId) adopted = again.listing;
          else if (again.kind === "gone") end = "gone";
          else if (again.kind === "missing") end = "missing";
          else setNotice({ kind: "error", text: LATEST_NOT_LOADED });
        }
        if (adopted) {
          latest.current.onListing(adopted);
          setNotice({ kind: "conflict", text: IMAGES_CONFLICT });
          const firstId = adopted.media[0]?.id;
          focusLater(firstId ? `image-item-${firstId}` : "images-add");
          ok = true;
        }
      } else if (response.status === 400) {
        const parsed = readErrorBody(error);
        const invalid = (parsed?.fields.order ?? []).concat(parsed?.fields.cover_id ?? []).includes("invalid");
        if (invalid) {
          // The list this page holds is no longer the Draft's: read it again.
          const read = await reload();
          setNotice({ kind: "error", text: read.kind === "ok" ? ORDER_CHANGED : IMAGES_REFRESH_FAILED });
          if (read.kind === "gone" || read.kind === "missing") end = read.kind;
        } else setNotice({ kind: "error", text: REJECTED_ERROR });
      } else if (response.status === 403) {
        setNotice({ kind: "error", text: account?.state === "suspended" ? IMAGES_FORBIDDEN : failureMessage(403, null) });
      } else {
        setNotice({ kind: "error", text: failureMessage(response.status, response.headers.get("Retry-After")) });
      }
    } catch (thrown) {
      setNotice({ kind: "error", text: thrownMessage(thrown) });
    } finally {
      finish();
    }
    if (!ok && !end && mounted.current) focusLater(failFocus); // focus never falls to the page
    if (end) await leave(end);
  }

  function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= media.length) return;
    const order = media.map((item) => item.id);
    [order[index], order[target]] = [order[target], order[index]];
    const moved = media[index].id;
    const button = `image-${moved}-${by < 0 ? "earlier" : "later"}`;
    void change(
      order,
      null,
      (next) => {
        const at = next.media.findIndex((item) => item.id === moved);
        return { text: at < 0 ? "Image moved." : `Image moved to position ${at + 1} of ${next.media.length}.`, focus: button };
      },
      button,
    );
  }

  function makeCover(id: string) {
    void change(
      media.map((item) => item.id),
      id,
      (next) => {
        const at = next.media.findIndex((item) => item.id === id);
        return { text: at < 0 ? "Cover image changed." : `Image ${at + 1} of ${next.media.length} is now the cover image.`, focus: `image-item-${id}` };
      },
      `image-item-${id}`,
    );
  }

  async function remove(id: string) {
    const index = media.findIndex((item) => item.id === id);
    if (!begin()) return;
    // The confirmation stays on screen (its buttons aria-disabled) until the request ends.
    setNotice(null);
    resetAnnouncement();
    let end: "gone" | "missing" | undefined;
    let focus = `image-${id}-delete`;
    try {
      const api = await getApi();
      const { response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.DELETE("/api/v1/listings/{listing_id}/images/{image_id}", {
            params: { path: { listing_id: listingId, image_id: id } },
            headers: { "X-CSRFToken": csrf },
            signal,
          }),
        ),
      );
      if (response.status === 401) end = "gone";
      else if (response.status === 403) setNotice({ kind: "error", text: account?.state === "suspended" ? IMAGES_FORBIDDEN : failureMessage(403, null) });
      else if (response.ok || response.status === 404) {
        // The answer carries no revision (and a 404 may be this image or the Draft): the Draft is read again.
        const read = await reload();
        if (read.kind === "ok") {
          if (response.ok) announce("Image deleted.");
          else setNotice({ kind: "error", text: IMAGES_ALREADY_GONE });
          focus = focusAfter(read, index, focus, id);
        } else if (read.kind === "error") setNotice({ kind: "error", text: IMAGES_REFRESH_FAILED });
        else end = read.kind;
      } else {
        setNotice({ kind: "error", text: failureMessage(response.status, response.headers.get("Retry-After")) });
        if (response.status >= 500) {
          // The proxy answers 5xx when the answer was lost: the image may be gone, so the list is read again.
          const read = await reload();
          if (read.kind === "gone" || read.kind === "missing") end = read.kind;
          else focus = focusAfter(read, index, focus, id);
        }
      }
    } catch (thrown) {
      // A lost answer: the image may be gone, so the list is read again before anything else is believed.
      setNotice({ kind: "error", text: thrownMessage(thrown) });
      if (!(thrown instanceof CsrfFetchError)) {
        const read = await reload();
        if (read.kind === "gone" || read.kind === "missing") end = read.kind;
        else focus = focusAfter(read, index, focus, id);
      }
    } finally {
      if (mounted.current) setConfirming(null);
      finish();
    }
    if (!end && mounted.current) focusLater(focus);
    if (end) await leave(end);
  }

  function askDelete(id: string) {
    if (imageLockHeld() || latest.current.locked) return;
    setConfirming(id);
    focusLater(`image-${id}-cancel`);
  }
  function cancelDelete(id: string) {
    if (imageLockHeld()) return;
    setConfirming(null);
    focusLater(`image-${id}-delete`);
  }

  const noRevision = revision === null;
  return (
    <section className="card" aria-labelledby="draft-images-title" data-testid="images-section" style={{ marginBottom: "var(--space)" }}>
      <h2 id="draft-images-title" className="section-title">
        Images
      </h2>
      <p id="images-hint" className="hint">
        {IMAGES_HINT}
      </p>
      <p className="muted" data-testid="images-count">
        {count} of {MAX_IMAGES} images
      </p>
      {/* The one live region of this section: the notice (a conflict or a failure) and the announcements of counts and results. */}
      <div role="status" aria-live="polite" data-testid="images-live">
        {notice && (
          <p className="notice" data-testid={notice.kind === "conflict" ? "images-conflict" : notice.kind === "wait" ? "images-wait" : "images-notice"}>
            {notice.text}
          </p>
        )}
        <span className="sr-only" data-testid="images-announcement">
          {announcement}
        </span>
      </div>
      <div className="image-add">
        <label htmlFor="images-add">Add images</label>
        <input
          id="images-add"
          type="file"
          multiple
          accept={ALLOWED_TYPES}
          aria-describedby={full ? "images-hint images-limit" : "images-hint"}
          aria-disabled={waiting || full ? true : undefined}
          // A full list or a running action blocks the picker without disabling the control.
          onClick={(event) => {
            if (waiting || full) event.preventDefault();
          }}
          onChange={onChoose}
        />
        {full && (
          <p id="images-limit" className="hint" data-testid="images-limit">
            {IMAGES_LIMIT_REACHED}
          </p>
        )}
      </div>
      {rows.length > 0 && (
        <div data-testid="upload-list">
          <h3 className="section-title" id="upload-title">
            Uploads
          </h3>
          <ul aria-labelledby="upload-title" className="upload-list">
            {rows.map((row) => (
              <li key={row.key} data-testid="upload-row" data-state={row.state}>
                <span className="upload-name">{row.name}</span>: <span data-testid="upload-status">{STATE_TEXT[row.state]}</span>
                {row.message ? <span data-testid="upload-message">. {row.message}</span> : null}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="secondary-button"
            aria-disabled={flag}
            onClick={() => {
              if (!imageLockHeld()) {
                setRows([]);
                focusLater("images-add");
              }
            }}
          >
            Clear upload list
          </button>
        </div>
      )}
      {count === 0 ? (
        <p className="muted" data-testid="images-empty">
          {IMAGES_EMPTY}
        </p>
      ) : (
        <ol className="image-list" aria-label="Images in order" data-testid="image-list">
          {media.map((item, index) => {
            const name = `image ${index + 1} of ${count}`;
            const asking = confirming === item.id;
            const alt = item.isCover ? `Image ${index + 1} of ${count}, cover image` : `Image ${index + 1} of ${count}`;
            return (
              <li key={item.id} id={`image-item-${item.id}`} tabIndex={-1} className="image-card" data-testid="image-item" data-cover={item.isCover ? "true" : "false"}>
                <Thumb url={item.url} alt={alt} label={name} />
                <p className="image-caption">
                  <span data-testid="image-position">
                    Image {index + 1} of {count}
                  </span>
                  {item.isCover && (
                    <span className="cover-badge" data-testid="image-cover">
                      Cover image
                    </span>
                  )}
                </p>
                {asking ? (
                  <div role="group" aria-label={`Delete ${name}`} className="image-actions" data-testid="image-confirm">
                    <p className="image-confirm-text">Delete this image? This cannot be undone.</p>
                    <button type="button" className="primary-button" aria-disabled={flag} onClick={() => void remove(item.id)}>
                      Yes, delete<span className="sr-only"> {name}</span>
                    </button>
                    <button
                      type="button"
                      id={`image-${item.id}-cancel`}
                      className="secondary-button"
                      aria-disabled={flag}
                      onClick={() => cancelDelete(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") cancelDelete(item.id);
                      }}
                    >
                      Cancel<span className="sr-only"> deleting {name}</span>
                    </button>
                  </div>
                ) : (
                  <div role="group" aria-label={`Actions for ${name}`} className="image-actions">
                    <button
                      type="button"
                      id={`image-${item.id}-earlier`}
                      className="secondary-button"
                      aria-disabled={waiting || index === 0 || noRevision ? true : undefined}
                      onClick={() => move(index, -1)}
                    >
                      Move earlier<span className="sr-only"> {name}</span>
                    </button>
                    <button
                      type="button"
                      id={`image-${item.id}-later`}
                      className="secondary-button"
                      aria-disabled={waiting || index === count - 1 || noRevision ? true : undefined}
                      onClick={() => move(index, 1)}
                    >
                      Move later<span className="sr-only"> {name}</span>
                    </button>
                    {!item.isCover && (
                      <button type="button" className="secondary-button" aria-disabled={waiting || noRevision ? true : undefined} onClick={() => makeCover(item.id)}>
                        Set as cover<span className="sr-only"> {name}</span>
                      </button>
                    )}
                    <button type="button" id={`image-${item.id}-delete`} className="secondary-button" aria-disabled={flag} onClick={() => askDelete(item.id)}>
                      Delete<span className="sr-only"> {name}</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { RetryImage } from "@/components/ui/retry-image";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { UPLOAD_TIMEOUT_MS, withTimeout } from "@/lib/forms/forms";
import { acquireImageLock, releaseImageLock } from "@/lib/listing/image-lock";
import type { FloorPlan } from "@/lib/listing/listing-labels";
import {
  FLOOR_PLAN_ADDED,
  FLOOR_PLAN_HINT,
  FLOOR_PLAN_REMOVED,
  IMAGES_FORBIDDEN,
  IMAGES_ONE_AT_A_TIME,
  IMAGES_REFRESH_FAILED,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONFLICT_MESSAGES,
  UPLOAD_FILE_MESSAGES,
} from "@/lib/listing/listing-messages";
import { thrownMessage } from "@/lib/http/request-errors";
import { useSession } from "@/lib/auth/session";
import { uploadErrorMessage } from "@/lib/forms/upload-errors";
import type { Latest } from "./draft-editor";

/**
 * The floor plan of a Listing (Story 11.4): at most one image, never a photo or the cover. It shares the one right to change images
 * with the Images section (`image-lock`), so the two never race each other for the revision. The answers carry no revision, so the
 * Draft is read again afterwards.
 */
export function FloorPlanSection({
  listingId,
  floorPlan,
  locked,
  onListing,
  onBusyChange,
  refresh,
  onSessionGone,
  onNotFound,
}: {
  listingId: string;
  floorPlan: FloorPlan | null;
  /** A field save or another change is in flight: the actions wait. */
  locked: boolean;
  onListing: (next: Extract<Latest, { kind: "found" }>["listing"]) => void;
  onBusyChange: (busy: boolean) => void;
  refresh: () => Promise<Latest>;
  onSessionGone: () => Promise<void>;
  onNotFound: () => void;
}) {
  const { account } = useSession();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ kind: "done" | "error"; text: string } | null>(null);
  const [token] = useState(() => Symbol("floor-plan"));
  const busyChange = useRef(onBusyChange);
  useEffect(() => {
    busyChange.current = onBusyChange;
  });
  useEffect(
    () => () => {
      if (releaseImageLock(token)) busyChange.current(false);
    },
    [token],
  );

  /** Runs one upload or removal under the lock, then reads the Draft again. */
  async function run(call: () => Promise<{ response: Response; error?: unknown }>, done: string) {
    if (locked || !acquireImageLock(token)) {
      setMessage({ kind: "error", text: IMAGES_ONE_AT_A_TIME });
      return;
    }
    setWorking(true);
    onBusyChange(true);
    setMessage(null);
    try {
      const { response, error } = await call();
      if (response.status === 401) return await onSessionGone();
      const gone = response.status === 404;
      if (!response.ok && !gone) {
        setMessage({
          kind: "error",
          text: uploadErrorMessage({
            status: response.status,
            error,
            retryAfter: response.headers.get("Retry-After"),
            suspended: account?.state === "suspended",
            forbidden: IMAGES_FORBIDDEN,
            conflicts: UPLOAD_CONFLICT_MESSAGES,
          }),
        });
      }
      // Success, or the page may be stale (already removed, sold, restricted): the server's Draft is read either way.
      if (response.ok || gone || response.status === 403 || response.status === 409 || response.status >= 500) {
        const latest = await refresh();
        if (latest.kind === "found") {
          onListing(latest.listing);
          if (response.ok) setMessage({ kind: "done", text: done });
        } else if (latest.kind === "gone") await onSessionGone();
        else if (latest.kind === "missing") onNotFound();
        else setMessage({ kind: "error", text: IMAGES_REFRESH_FAILED });
      }
    } catch (thrown) {
      setMessage({ kind: "error", text: thrownMessage(thrown) });
    } finally {
      releaseImageLock(token);
      onBusyChange(false);
      setWorking(false);
    }
  }

  function onChoose(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage({ kind: "error", text: UPLOAD_FILE_MESSAGES.too_large });
      return;
    }
    void run(async () => {
      const api = await getApi();
      return withCsrf((csrf) =>
        withTimeout((signal) => {
          const form = new FormData();
          form.append("file", file);
          return api.PUT("/api/v1/listings/{listing_id}/floor-plan", {
            params: { path: { listing_id: listingId } },
            body: { file: "" },
            bodySerializer: () => form,
            headers: { "X-CSRFToken": csrf },
            signal,
          });
        }, UPLOAD_TIMEOUT_MS),
      );
    }, FLOOR_PLAN_ADDED);
  }

  function remove() {
    if (working) return;
    void run(async () => {
      const api = await getApi();
      return withCsrf((csrf) =>
        withTimeout((signal) =>
          api.DELETE("/api/v1/listings/{listing_id}/floor-plan", { params: { path: { listing_id: listingId } }, headers: { "X-CSRFToken": csrf }, signal }),
        ),
      );
    }, FLOOR_PLAN_REMOVED);
  }

  const waiting = working || locked;
  return (
    <section className="card" aria-labelledby="floor-plan-title" style={{ marginBottom: "var(--space)" }} data-testid="floor-plan">
      <h2 id="floor-plan-title" className="section-title">
        Floor plan
      </h2>
      <p className="hint" id="floor-plan-hint">
        {FLOOR_PLAN_HINT}
      </p>
      {floorPlan && <RetryImage url={floorPlan.url} alt="Floor plan" label="floor plan" className="image-thumb" failedClassName="image-thumb image-failed" />}
      <div className="field">
        <label htmlFor="floor-plan-file">{floorPlan ? "Replace the floor plan" : "Add a floor plan"}</label>
        <input
          id="floor-plan-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby="floor-plan-hint"
          aria-disabled={waiting ? true : undefined}
          onClick={(event) => waiting && event.preventDefault()}
          onChange={onChoose}
        />
      </div>
      {floorPlan && (
        <button type="button" className="secondary-button" aria-disabled={waiting ? true : undefined} onClick={remove}>
          Remove floor plan
        </button>
      )}
      <p role="status" className={message?.kind === "error" ? "field-error" : "muted"} data-testid="floor-plan-status">
        {working ? "Working…" : (message?.text ?? "")}
      </p>
    </section>
  );
}

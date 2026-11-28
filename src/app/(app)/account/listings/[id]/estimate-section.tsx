"use client";

import { useRef, useState } from "react";
import { EstimateFigure } from "@/components/listing/estimate-figure";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { readEstimate, type Estimate } from "@/lib/listing/estimate";
import { REJECTED_ERROR, UPLOAD_TIMEOUT_MS, withTimeout } from "@/lib/forms/forms";
import {
  ESTIMATE_BUTTON,
  ESTIMATE_FORBIDDEN,
  ESTIMATE_NOT_A_DRAFT,
  ESTIMATE_READY,
  ESTIMATE_SAVE_FIRST,
  ESTIMATE_TEXT,
  ESTIMATE_TITLE,
  ESTIMATE_UNAVAILABLE,
  ESTIMATE_WAIT,
  ESTIMATE_WORKING,
} from "@/lib/listing/listing-messages";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";

/**
 * "Get estimate" on the Draft form (Story 4.4). Asked for only by pressing the button, computed from the saved Draft, and read only: it
 * never touches the form. `stamp` is the saved details; an answer for other details is not shown.
 */
export function EstimateSection({
  listingId,
  stamp,
  dirty,
  blocked,
  onSessionGone,
  onNotFound,
}: {
  listingId: string;
  stamp: string;
  dirty: boolean;
  /** Another action on the Draft is running. */
  blocked: boolean;
  onSessionGone: () => Promise<void>;
  onNotFound: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [answer, setAnswer] = useState<{ stamp: string; estimate: Estimate } | null>(null);
  const [failure, setFailure] = useState("");
  const running = useRef(false);
  const reason = dirty ? ESTIMATE_SAVE_FIRST : blocked ? ESTIMATE_WAIT : "";
  const estimate = answer?.stamp === stamp ? answer.estimate : null;

  async function request() {
    if (running.current || reason) return;
    running.current = true;
    setWorking(true);
    setAnswer(null);
    setFailure("");
    try {
      const api = await getApi();
      const { data, response } = await withCsrf((csrf) =>
        withTimeout(
          (signal) => api.POST("/api/v1/listings/{listing_id}/estimate", { params: { path: { listing_id: listingId } }, headers: { "X-CSRFToken": csrf }, signal }),
          UPLOAD_TIMEOUT_MS,
        ),
      );
      if (response.status === 401) return await onSessionGone();
      if (response.status === 404) return onNotFound();
      if (!response.ok) {
        setFailure(
          response.status === 409 ? ESTIMATE_NOT_A_DRAFT : response.status === 403 ? ESTIMATE_FORBIDDEN : failureMessage(response.status, response.headers.get("Retry-After")),
        );
        return;
      }
      const read = readEstimate(data);
      if (read) setAnswer({ stamp, estimate: read });
      else setFailure(REJECTED_ERROR);
    } catch (error) {
      setFailure(thrownMessage(error));
    } finally {
      running.current = false;
      setWorking(false);
    }
  }

  return (
    <section className="card" aria-labelledby="estimate-title" style={{ marginBottom: "var(--space)" }} data-testid="estimate-section">
      <h2 id="estimate-title" className="section-title">
        {ESTIMATE_TITLE}
      </h2>
      <p className="muted">{ESTIMATE_TEXT}</p>
      {estimate?.kind === "value" && <EstimateFigure value={estimate.value} testId="estimate" />}
      {/* The one announcement: why there is no number, a failure, or (unseen) that the figure above is there. */}
      <p role="status" className={estimate?.kind === "unavailable" || failure ? "state-note" : "sr-only"} data-testid="estimate-status">
        {failure || (estimate?.kind === "unavailable" ? `${ESTIMATE_UNAVAILABLE} ${estimate.message}` : estimate ? ESTIMATE_READY : "")}
      </p>
      {reason && (
        <p id="estimate-reason" className="hint" data-testid="estimate-reason">
          {reason}
        </p>
      )}
      <button type="button" className="secondary-button" aria-disabled={reason || working ? true : undefined} aria-describedby={reason ? "estimate-reason" : undefined} onClick={() => void request()}>
        {working ? ESTIMATE_WORKING : ESTIMATE_BUTTON}
      </button>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { components } from "@/api/schema";
import { Field } from "@/components/ui/form-field";
import { RetryImage } from "@/components/ui/retry-image";
import { getApi } from "@/lib/http/api";
import { withTimeout } from "@/lib/forms/forms";
import { formatResetDate as formatDate } from "@/lib/account/publication-allowance";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { LOOKUP_REASON, checkReason, reasonMessage } from "../../accounts/accounts-api";
import { ReasonedRead } from "../../reasoned-read";
import { STATUS_LABELS, shown, useAdminWrite, useSessionGone, words } from "../../moderation-shared";

type Detail = components["schemas"]["AdminListingDetail"];
type Action = Detail["actions"][number];

/** The server's limits for a moderation reason (the owner reads it). */
const ACTION_REASON = { min: 5, max: 120 };
const ACTIONS: Record<Action, { label: string; done: string }> = {
  restrict: { label: "Restrict", done: "The listing was restricted." },
  remove: { label: "Remove", done: "The listing was removed." },
  lift_restriction: { label: "Lift restriction", done: "The restriction was lifted." },
  restore: { label: "Restore to published", done: "The listing was restored." },
  archive_removed: { label: "Move to archived", done: "The listing was archived." },
};

/** One Listing for review and moderation (Stories 9.3 and 9.4). A Draft is shown only after a recorded reason. */
export function ListingReview({ listingId, draft }: { listingId: string; draft: boolean }) {
  const gone = useSessionGone(`/admin/listings/${listingId}`);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [missing, setMissing] = useState("");
  const [notice, setNotice] = useState("");
  const [readReason, setReadReason] = useState("");
  const [readError, setReadError] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const { working, write } = useAdminWrite(gone, setNotice);

  const load = useCallback(async () => {
    try {
      const api = await getApi();
      const { data, response } = await withTimeout((signal) => api.GET("/api/v1/admin/listings/{listing_id}", { params: { path: { listing_id: listingId } }, cache: "no-store", signal }));
      if (response.ok && data) return setDetail(data);
      if (response.status === 401) return await gone();
      setMissing(response.status === 404 ? "This listing is not available. A draft is opened from the Drafts list." : failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (thrown) {
      setMissing(thrownMessage(thrown));
    }
  }, [gone, listingId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the state is set after the request answers
    if (!draft) void load();
  }, [draft, load]);

  function readDraft(event: React.FormEvent) {
    event.preventDefault();
    const problem = checkReason(readReason, LOOKUP_REASON);
    setReadError(problem);
    if (problem) return;
    void write<Detail>(
      async (csrf, signal) => {
        const api = await getApi();
        return api.POST("/api/v1/admin/listings/{listing_id}/read", {
          params: { path: { listing_id: listingId } },
          body: { reason: readReason.trim() },
          headers: { "X-CSRFToken": csrf },
          cache: "no-store",
          signal,
        });
      },
      { done: setDetail, field: "reason", invalid: (code) => setReadError(reasonMessage(code, LOOKUP_REASON)) },
    );
  }

  function act(action: Action) {
    const problem = checkReason(reason, ACTION_REASON);
    setReasonError(problem);
    if (problem) return document.getElementById("action-reason")?.focus();
    void write<components["schemas"]["ModerationRecord"]>(
      async (csrf, signal) => {
        const api = await getApi();
        const options = { params: { path: { listing_id: listingId } }, body: { reason: reason.trim() }, headers: { "X-CSRFToken": csrf }, cache: "no-store" as const, signal };
        if (action === "restrict") return api.POST("/api/v1/admin/listings/{listing_id}/restrict", options);
        if (action === "remove") return api.POST("/api/v1/admin/listings/{listing_id}/remove", options);
        if (action === "lift_restriction") return api.POST("/api/v1/admin/listings/{listing_id}/lift-restriction", options);
        if (action === "restore") return api.POST("/api/v1/admin/listings/{listing_id}/restore", options);
        return api.POST("/api/v1/admin/listings/{listing_id}/archive", options);
      },
      {
        done: () => {
          setReason("");
          void load().then(() => setNotice(ACTIONS[action].done));
        },
        field: "reason",
        invalid: (code) => setReasonError(reasonMessage(code, ACTION_REASON)),
        conflict: () => void load().then(() => setNotice("This listing has changed. It has been reloaded.")),
      },
    );
  }

  return (
    <>
      <p>
        <Link href="/admin/listings" className="text-link">
          Back to listings
        </Link>
      </p>
      <h1 className="page-title account-text">{detail ? (detail.title ?? "Untitled listing") : draft ? "Draft listing" : "Listing"}</h1>
      <p role="status" aria-live="polite" className={notice ? "state-note" : "sr-only"} data-testid="moderation-notice">
        {notice}
      </p>
      {missing && <p role="alert">{missing}</p>}
      {!detail && draft && (
        <form noValidate className="card" onSubmit={readDraft} aria-label="Open draft">
          <Field name="read-reason" label="Reason for opening" hint="10 to 300 characters, without contact details." errors={readError ? [readError] : undefined}>
            {(props) => <input {...props} type="text" autoComplete="off" value={readReason} onChange={(event) => setReadReason(event.target.value)} />}
          </Field>
          <button type="submit" className="primary-button" aria-disabled={working || undefined}>
            Show draft
          </button>
        </form>
      )}
      {!detail && !draft && !missing && <p className="muted">Loading the listing…</p>}
      {detail && (
        <article className="card" data-testid="admin-listing">
          <dl className="account-details">
            <dt>Status</dt>
            <dd data-testid="admin-listing-status">
              {[STATUS_LABELS[detail.status], detail.restricted ? "Restricted" : null, detail.under_review ? "Under review" : null].filter(Boolean).join(" · ")}
            </dd>
            {detail.moderation_reason && (
              <>
                <dt>Reason shown to the owner</dt>
                <dd className="account-text">{detail.moderation_reason}</dd>
              </>
            )}
            <dt>Owner</dt>
            <dd className="account-text">{detail.owner?.masked_email ?? "Account removed"}</dd>
            <dt>Open reports</dt>
            <dd>{detail.open_reports}</dd>
            <dt>Type</dt>
            <dd>{[detail.purpose, detail.category, detail.subtype].map(words).join(" · ")}</dd>
            <dt>Location</dt>
            <dd className="account-text">{[detail.locality, detail.city].filter(Boolean).join(", ") || "Not given"}</dd>
            <dt>Description</dt>
            <dd className="account-text">{detail.description ?? "None"}</dd>
            <dt>Images</dt>
            <dd>{detail.image_count}</dd>
            {Object.entries(detail.attributes).map(([key, value]) => (
              <div key={key}>
                <dt>{words(key)}</dt>
                <dd className="account-text">{shown(value)}</dd>
              </div>
            ))}
          </dl>
          {detail.media.length > 0 && (
            <ul className="list-none p-0 mt-0 mx-0 mb-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-4" aria-label="Images">
              {detail.media.map((item, index) => (
                <li key={item.id}>
                  <RetryImage url={item.url} alt={`Image ${index + 1} of ${detail.media.length}`} label={`image ${index + 1}`} className="image-thumb" failedClassName="image-thumb image-failed" />
                </li>
              ))}
            </ul>
          )}
          {detail.floor_plan && (
            <p>
              <RetryImage url={detail.floor_plan.url} alt="Floor plan" label="floor plan" className="image-thumb" failedClassName="image-thumb image-failed" />
            </p>
          )}
          <PrivateAddress listingId={listingId} onSessionGone={gone} />
          <h2 className="section-title">Actions</h2>
          {detail.actions.length === 0 ? (
            <p className="muted" data-testid="no-actions">
              This listing can only be viewed.
            </p>
          ) : (
            <>
              <Field name="action-reason" label="Reason" hint="5 to 120 characters, without contact details. The owner sees this reason." errors={reasonError ? [reasonError] : undefined}>
                {(props) => <input {...props} type="text" autoComplete="off" value={reason} onChange={(event) => setReason(event.target.value)} />}
              </Field>
              <div className="image-actions">
                {detail.actions.map((action) => (
                  <button key={action} type="button" className="secondary-button" aria-disabled={working || undefined} onClick={() => act(action)}>
                    {ACTIONS[action].label}
                  </button>
                ))}
              </div>
            </>
          )}
          <h2 className="section-title">Moderation history</h2>
          {detail.history.length === 0 ? (
            <p className="muted">No actions yet.</p>
          ) : (
            <ul aria-label="Moderation history">
              {detail.history.map((entry) => (
                <li key={entry.at} className="account-text">
                  {ACTIONS[entry.action].label} on {formatDate(entry.at)} by administrator {entry.by_account_id}: {entry.reason}
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </>
  );
}

/** The Private address (Story 10.4): one listing at a time, after a recorded reason. */
function PrivateAddress({ listingId, onSessionGone }: { listingId: string; onSessionGone: () => Promise<void> }) {
  return (
    <ReasonedRead<components["schemas"]["AdminListingAddress"]>
      title="Private address"
      onSessionGone={onSessionGone}
      send={async (reason, csrf, signal) => {
        const api = await getApi();
        return api.POST("/api/v1/admin/listings/{listing_id}/private-address", {
          params: { path: { listing_id: listingId } },
          body: { reason },
          headers: { "X-CSRFToken": csrf },
          cache: "no-store",
          signal,
        });
      }}
      show={(address) => (
        <dl className="account-details">
          <dt>Street</dt>
          <dd className="account-text">{address.street ?? "Not given"}</dd>
          <dt>House number</dt>
          <dd className="account-text">{address.house_number ?? "Not given"}</dd>
          <dt>Coordinates</dt>
          <dd>{address.latitude && address.longitude ? `${address.latitude}, ${address.longitude}` : "Not given"}</dd>
        </dl>
      )}
    />
  );
}

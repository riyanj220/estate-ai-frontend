"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Field } from "@/components/form-field";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms";
import { formatResetDate as formatDate } from "@/lib/publication-allowance";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useSession } from "@/lib/session";
import { useFormFeedback } from "@/lib/use-form-feedback";
import { CHANGE_REASON, LOOKUP_REASON, checkReason, reasonMessage } from "../accounts/accounts-api";

type Row = components["schemas"]["VerificationQueue"]["results"][number];
type Detail = components["schemas"]["VerificationDetail"];
type Status = Row["status"];
type Action = "approve" | "reject" | "revoke";

const SIGN_IN_PATH = `/admin/sign-in?next=${encodeURIComponent("/admin/verification")}`;
const LABELS: Record<Status, string> = { pending: "Pending", verified: "Verified", rejected: "Rejected", revoked: "Revoked", withdrawn: "Withdrawn" };
const DONE: Record<Action, string> = { approve: "The agency is now verified.", reject: "The request was rejected.", revoke: "The verification was revoked." };
const CHANGED = "This request has changed. The list has been reloaded.";

type List = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: Row[]; next: string | null };

async function fetchQueue(status: Status, after: string | null) {
  const cursor = after ? (new URL(after, window.location.origin).searchParams.get("cursor") ?? undefined) : undefined;
  const api = await getApi();
  return withTimeout((signal) => api.GET("/api/v1/admin/verification-requests", { params: { query: { status, cursor } }, cache: "no-store", signal }));
}

/** The Verification review queue (Story 8.4). Submitted details are shown only after a recorded reason. */
export function VerificationQueue() {
  const router = useRouter();
  const { refresh } = useSession();
  const { announcement, announce, resetAnnouncement, notice, setNotice, showNotice, noticeRef } = useFormFeedback();
  const [status, setStatus] = useState<Status>("pending");
  const [list, setList] = useState<List>({ kind: "loading" });
  const [selected, setSelected] = useState<Row | null>(null);
  const ticket = useRef(0);

  const sessionGone = useCallback(async () => {
    await refresh();
    router.replace(SIGN_IN_PATH);
  }, [refresh, router]);

  /** The first page, or the page after `after` (the server's link; only its cursor is used) appended to `kept`. */
  const read = useCallback(
    (wanted: Status, after: string | null = null, kept: Row[] = []) => {
      const mine = ++ticket.current;
      return fetchQueue(wanted, after).then(
        ({ data, response }) => {
          if (mine !== ticket.current) return;
          if (response.ok && Array.isArray(data?.results)) return setList({ kind: "ready", rows: [...kept, ...data.results], next: data.next });
          if (response.status === 401) return sessionGone();
          if (response.status === 404) router.refresh(); // also the answer to a non-administrator: run the server guard again
          setList({ kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")) });
        },
        (thrown) => {
          if (mine === ticket.current) setList({ kind: "error", message: thrownMessage(thrown) });
        },
      );
    },
    [router, sessionGone],
  );

  useEffect(() => {
    void read("pending");
  }, [read]);

  function reload(wanted: Status) {
    setSelected(null);
    setList({ kind: "loading" });
    void read(wanted);
  }

  return (
    <>
      <h1 className="page-title">Verification</h1>
      <p className="muted">Review agency verification requests. Opening a request is recorded with your reason.</p>
      {/* The one live region of this page. */}
      <p role="status" aria-live="polite" className={announcement && !notice ? "muted" : "sr-only"} data-testid="verification-announcement">
        {announcement}
      </p>
      {notice && (
        <p ref={noticeRef} tabIndex={-1} className="state-note" data-testid="verification-notice">
          {notice}
        </p>
      )}
      <div className="field">
        <label htmlFor="verification-filter">Show</label>
        <select
          id="verification-filter"
          value={status}
          onChange={(event) => {
            const wanted = event.target.value as Status;
            setStatus(wanted);
            resetAnnouncement();
            setNotice("");
            reload(wanted);
          }}
        >
          {Object.entries(LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <section className="card" aria-labelledby="queue-title" style={{ marginBottom: "var(--space)" }}>
        <h2 id="queue-title" className="section-title">
          {LABELS[status]} requests
        </h2>
        {list.kind === "loading" && <p className="muted">Loading requests…</p>}
        {list.kind === "error" && (
          <div role="alert">
            <p>{list.message}</p>
            <button type="button" className="secondary-button" onClick={() => reload(status)}>
              Try again
            </button>
          </div>
        )}
        {list.kind === "ready" && list.rows.length === 0 && <p className="muted">No requests.</p>}
        {list.kind === "ready" && list.rows.length > 0 && (
          <ul className="listing-list" aria-label="Requests">
            {list.rows.map((row) => (
              <li key={row.id} className="listing-item" data-testid="verification-row">
                <p className="account-text">{row.business_name}</p>
                <p className="muted account-text">
                  {[row.agency_name ?? "Account removed", row.account_state === "suspended" ? "Suspended" : null, `Sent ${formatDate(row.submitted_at)}`].filter(Boolean).join(" · ")}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Review ${row.business_name}`}
                  onClick={() => {
                    resetAnnouncement();
                    setNotice("");
                    setSelected(row);
                  }}
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.kind === "ready" && list.next && (
          <button type="button" className="secondary-button" onClick={() => void read(status, list.next, list.rows)}>
            Load more
          </button>
        )}
      </section>
      {selected && (
        <Review
          key={selected.id}
          row={selected}
          onSessionGone={sessionGone}
          onStart={() => {
            resetAnnouncement();
            setNotice("");
          }}
          onNotice={showNotice}
          onDone={(message) => {
            announce(message);
            reload(status);
          }}
          onChanged={() => {
            showNotice(CHANGED);
            reload(status);
          }}
        />
      )}
    </>
  );
}

/** One request: the reasoned read first, then its details, history and the decisions its status allows. */
function Review({
  row,
  onSessionGone,
  onStart,
  onNotice,
  onDone,
  onChanged,
}: {
  row: Row;
  onSessionGone: () => Promise<void>;
  onStart: () => void;
  onNotice: (message: string) => void;
  onDone: (message: string) => void;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [decision, setDecision] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [detail]);

  async function run(work: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    onStart();
    try {
      await work();
    } catch (thrown) {
      onNotice(thrownMessage(thrown));
    } finally {
      running.current = false;
      setWorking(false);
    }
  }

  function failed(status: number, retryAfter: string | null) {
    if (status === 401) return onSessionGone();
    if (status === 404 || status === 409) return onChanged();
    onNotice(failureMessage(status, retryAfter));
  }

  function open(event: React.FormEvent) {
    event.preventDefault();
    const problem = checkReason(reason, LOOKUP_REASON);
    setReasonError(problem);
    if (problem) return;
    void run(async () => {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.POST("/api/v1/admin/verification-requests/{request_id}/read", {
            params: { path: { request_id: row.id } },
            body: { reason: reason.trim() },
            headers: { "X-CSRFToken": csrf },
            cache: "no-store",
            signal,
          }),
        ),
      );
      if (response.ok && data) return setDetail(data);
      const code = response.status === 400 ? readErrorBody(error)?.fields?.reason?.[0] : undefined;
      if (code) return setReasonError(reasonMessage(code, LOOKUP_REASON));
      await failed(response.status, response.headers.get("Retry-After"));
    });
  }

  function decide(action: Action) {
    if (action !== "approve") {
      const problem = checkReason(decision, CHANGE_REASON);
      setDecisionError(problem);
      if (problem) return document.getElementById("decision-reason")?.focus();
    }
    void run(async () => {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) => {
          const options = { params: { path: { request_id: row.id } }, headers: { "X-CSRFToken": csrf }, cache: "no-store" as const, signal };
          if (action === "approve") return api.POST("/api/v1/admin/verification-requests/{request_id}/approve", options);
          const body = { reason: decision.trim() };
          return action === "reject"
            ? api.POST("/api/v1/admin/verification-requests/{request_id}/reject", { ...options, body })
            : api.POST("/api/v1/admin/verification-requests/{request_id}/revoke", { ...options, body });
        }),
      );
      if (response.ok && data) return onDone(DONE[action]);
      const code = response.status === 400 ? readErrorBody(error)?.fields?.reason?.[0] : undefined;
      if (code) return setDecisionError(reasonMessage(code, CHANGE_REASON));
      await failed(response.status, response.headers.get("Retry-After"));
    });
  }

  const busy = working || undefined;
  return (
    <section className="card" aria-labelledby="review-title" data-testid="verification-review">
      <h2 id="review-title" ref={heading} tabIndex={-1} className="section-title account-text">
        {row.business_name}
      </h2>
      {!detail ? (
        <form noValidate onSubmit={open} aria-label="Open request">
          <Field name="read-reason" label="Reason for opening" hint="10 to 300 characters, without contact details." errors={reasonError ? [reasonError] : undefined}>
            {(props) => <input {...props} type="text" autoComplete="off" value={reason} onChange={(event) => setReason(event.target.value)} />}
          </Field>
          <button type="submit" className="primary-button" aria-disabled={busy}>
            Show details
          </button>
        </form>
      ) : (
        <>
          <dl className="account-details">
            <dt>Agency</dt>
            <dd className="account-text">{detail.agency_name ?? "Account removed"}</dd>
            <dt>Status</dt>
            <dd>{LABELS[detail.status]}</dd>
            <dt>Registration or licence number</dt>
            <dd className="account-text">{detail.registration_number}</dd>
            <dt>Note</dt>
            <dd className="account-text">{detail.note || "None"}</dd>
          </dl>
          <h3>Decision history</h3>
          {detail.history.length === 0 ? (
            <p className="muted">No earlier decisions.</p>
          ) : (
            <ul aria-label="Decision history">
              {detail.history.map((entry) => (
                <li key={`${entry.at}-${entry.action}`} className="account-text">
                  {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)} on {formatDate(entry.at)} by{" "}
                  {entry.action === "withdrawn" ? "the agency" : `administrator ${entry.by_account_id}`}
                  {entry.reason ? `: ${entry.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
          {(detail.status === "pending" || detail.status === "verified") && (
            <>
              <Field
                name="decision-reason"
                label={detail.status === "pending" ? "Reason for rejecting" : "Reason for revoking"}
                hint="5 to 500 characters, without contact details. The agency sees this reason."
                errors={decisionError ? [decisionError] : undefined}
              >
                {(props) => <input {...props} type="text" autoComplete="off" value={decision} onChange={(event) => setDecision(event.target.value)} />}
              </Field>
              <div className="image-actions">
                {detail.status === "pending" ? (
                  <>
                    <button type="button" className="primary-button" aria-disabled={busy} onClick={() => decide("approve")}>
                      Approve
                    </button>
                    <button type="button" className="secondary-button" aria-disabled={busy} onClick={() => decide("reject")}>
                      Reject
                    </button>
                  </>
                ) : (
                  <button type="button" className="secondary-button" aria-disabled={busy} onClick={() => decide("revoke")}>
                    Revoke verification
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

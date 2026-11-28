"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/form-field";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms/forms";
import { formatResetDate as formatDate } from "@/lib/account/publication-allowance";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { useSession } from "@/lib/auth/session";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";
import { CHANGE_REASON, checkReason, reasonMessage } from "../accounts/accounts-api";

type Row = components["schemas"]["AdminClosureQueue"]["results"][number];
type Status = Row["status"];
type Action = "approve" | "reject";

const SIGN_IN_PATH = `/admin/sign-in?next=${encodeURIComponent("/admin/closure-requests")}`;
const LABELS: Record<Status, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
const KINDS: Record<Row["kind"], string> = { deactivation: "Deactivation", deletion: "Deletion" };
const DONE: Record<Action, string> = { approve: "The account was closed.", reject: "The request was rejected." };
const CHANGED = "This request has changed. The list has been reloaded.";

type List = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: Row[]; next: string | null };

const label = (row: Row) => row.masked_email ?? "Closed account";

/** The closure request queue (Story 10.2): approve (cannot be undone) or reject, each with a reason the account holder reads. */
export function ClosureQueue() {
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
    async (wanted: Status, after: string | null = null, kept: Row[] = []) => {
      const mine = ++ticket.current;
      try {
        const cursor = after ? (new URL(after, window.location.origin).searchParams.get("cursor") ?? undefined) : undefined;
        const api = await getApi();
        const { data, response } = await withTimeout((signal) => api.GET("/api/v1/admin/closure-requests", { params: { query: { status: wanted, cursor } }, cache: "no-store", signal }));
        if (mine !== ticket.current) return;
        if (response.ok && Array.isArray(data?.results)) return setList({ kind: "ready", rows: [...kept, ...data.results], next: data.next });
        if (response.status === 401) return sessionGone();
        if (response.status === 404) router.refresh(); // also the answer to a non-administrator: run the server guard again
        setList({ kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")) });
      } catch (thrown) {
        if (mine === ticket.current) setList({ kind: "error", message: thrownMessage(thrown) });
      }
    },
    [router, sessionGone],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set only after the request answers
    void read("pending");
  }, [read]);

  function clear() {
    resetAnnouncement();
    setNotice("");
  }

  function reload(wanted: Status) {
    setSelected(null);
    setList({ kind: "loading" });
    void read(wanted);
  }

  return (
    <>
      <h1 className="page-title">Closure requests</h1>
      <p className="muted">Account holders asking to close their account. The account stays as it is until you decide.</p>
      {/* The one live region of this page. */}
      <p role="status" aria-live="polite" className={announcement && !notice ? "muted" : "sr-only"} data-testid="closure-announcement">
        {announcement}
      </p>
      {notice && (
        <p ref={noticeRef} tabIndex={-1} className="state-note" data-testid="closure-notice">
          {notice}
        </p>
      )}
      <div className="field">
        <label htmlFor="closure-filter">Show</label>
        <select
          id="closure-filter"
          value={status}
          onChange={(event) => {
            const wanted = event.target.value as Status;
            setStatus(wanted);
            clear();
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
              <li key={row.id} className="listing-item" data-testid="closure-row">
                <p className="account-text">{label(row)}</p>
                <p className="muted account-text">
                  {[KINDS[row.kind], row.account_type === "agency" ? "Agency" : "Individual", row.account_state === "suspended" ? "Suspended" : null, `Sent ${formatDate(row.submitted_at)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {row.decision_reason && <p className="account-text">Reason: {row.decision_reason}</p>}
                {row.status === "pending" && (
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label={`Decide ${label(row)}`}
                    onClick={() => {
                      clear();
                      setSelected(row);
                    }}
                  >
                    Decide
                  </button>
                )}
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
        <Decide
          key={selected.id}
          row={selected}
          onSessionGone={sessionGone}
          onStart={clear}
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

function Decide({
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
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function decide(action: Action) {
    const problem = checkReason(reason, CHANGE_REASON);
    setReasonError(problem);
    if (problem) return document.getElementById("decision-reason")?.focus();
    if (running.current) return;
    running.current = true;
    setWorking(true);
    onStart();
    try {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) => {
          const options = { params: { path: { request_id: row.id } }, body: { reason: reason.trim() }, headers: { "X-CSRFToken": csrf }, cache: "no-store" as const, signal };
          return action === "approve"
            ? api.POST("/api/v1/admin/closure-requests/{request_id}/approve", options)
            : api.POST("/api/v1/admin/closure-requests/{request_id}/reject", options);
        }),
      );
      if (response.ok && data) return onDone(DONE[action]);
      const code = response.status === 400 ? readErrorBody(error)?.fields?.reason?.[0] : undefined;
      if (code) return setReasonError(reasonMessage(code, CHANGE_REASON));
      if (response.status === 401) return void onSessionGone();
      if (response.status === 404 || response.status === 409) return onChanged();
      onNotice(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (thrown) {
      onNotice(thrownMessage(thrown));
    } finally {
      running.current = false;
      setWorking(false);
    }
  }

  const busy = working || undefined;
  return (
    <section className="card" aria-labelledby="decide-title" data-testid="closure-decision">
      <h2 id="decide-title" ref={heading} tabIndex={-1} className="section-title account-text">
        {label(row)}
      </h2>
      <p className="muted">Approving closes the account: its personal details are removed and its listings archived. This cannot be undone.</p>
      <Field name="decision-reason" label="Reason" hint="5 to 500 characters, without contact details. The account holder sees this reason." errors={reasonError ? [reasonError] : undefined}>
        {(props) => <input {...props} type="text" autoComplete="off" value={reason} onChange={(event) => setReason(event.target.value)} />}
      </Field>
      <div className="image-actions">
        <button type="button" className="primary-button" aria-disabled={busy} onClick={() => void decide("approve")}>
          Approve and close account
        </button>
        <button type="button" className="secondary-button" aria-disabled={busy} onClick={() => void decide("reject")}>
          Reject
        </button>
      </div>
    </section>
  );
}

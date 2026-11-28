"use client";

import { useCallback, useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/http/api";
import { formatResetDate as formatDate } from "@/lib/account/publication-allowance";
import { SUPPORT_CATEGORIES } from "@/lib/account/support";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";
import { cursorOf, useAdminRead, useAdminWrite } from "../moderation-shared";
import { ReasonedRead } from "../reasoned-read";

type Page = components["schemas"]["AdminSupportQueue"];
type Row = Page["results"][number];
type Status = Row["status"];

const LABELS: Record<Status, string> = { open: "Open", closed: "Closed" };
const CHANGED = "This request has changed. The list has been reloaded.";

const label = (row: Row) => row.masked_email ?? "Closed account";

/** The support queue (Story 10.9). The list holds no message text: reading one needs a recorded reason. */
export function SupportQueue() {
  const [status, setStatus] = useState<Status>("open");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Row | null>(null);
  const { announcement, announce, resetAnnouncement, notice, setNotice, showNotice, noticeRef } = useFormFeedback();
  const send = useCallback(
    async (signal: AbortSignal) => (await getApi()).GET("/api/v1/admin/support-requests", { params: { query: { status, cursor } }, cache: "no-store", signal }),
    [status, cursor],
  );
  const { data, failure, reload, gone } = useAdminRead<Page>(send, "/admin/support");
  const { working, write } = useAdminWrite(gone, (message) => (message ? showNotice(message) : setNotice("")));

  function show(wanted: Status, after?: string) {
    resetAnnouncement();
    setNotice("");
    setSelected(null);
    setStatus(wanted);
    setCursor(after);
  }

  function close(row: Row) {
    void write<Row>(
      async (csrf, signal) =>
        (await getApi()).POST("/api/v1/admin/support-requests/{request_id}/close", {
          params: { path: { request_id: row.id } },
          headers: { "X-CSRFToken": csrf },
          cache: "no-store",
          signal,
        }),
      {
        done: () => {
          setSelected(null);
          announce("The request was closed.");
          void reload();
        },
        conflict: () => {
          setSelected(null);
          showNotice(CHANGED);
          void reload();
        },
      },
    );
  }

  return (
    <>
      <h1 className="page-title">Support requests</h1>
      <p className="muted">Messages from account holders, oldest first. Closing a request notifies its sender.</p>
      {/* The one live region of this page. */}
      <p role="status" aria-live="polite" className={announcement && !notice ? "muted" : "sr-only"} data-testid="support-announcement">
        {announcement}
      </p>
      {notice && (
        <p ref={noticeRef} tabIndex={-1} className="state-note" data-testid="support-notice">
          {notice}
        </p>
      )}
      <div className="field">
        <label htmlFor="support-filter">Show</label>
        <select id="support-filter" value={status} onChange={(event) => show(event.target.value as Status)}>
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
        {failure && (
          <div role="alert">
            <p>{failure}</p>
            <button type="button" className="secondary-button" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        )}
        {!failure && !data && <p className="muted">Loading requests…</p>}
        {data && data.results.length === 0 && <p className="muted">No requests.</p>}
        {data && data.results.length > 0 && (
          <ul className="listing-list" aria-label="Requests">
            {data.results.map((row) => (
              <li key={row.id} className="listing-item" data-testid="support-row">
                <p className="account-text">{label(row)}</p>
                <p className="muted account-text">
                  {[SUPPORT_CATEGORIES[row.category], row.account_type === "agency" ? "Agency" : "Individual", row.account_state === "suspended" ? "Suspended" : null, `Sent ${formatDate(row.submitted_at)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Open request from ${label(row)}`}
                  onClick={() => {
                    resetAnnouncement();
                    setNotice("");
                    setSelected(row);
                  }}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
        {data?.next && (
          <button type="button" className="secondary-button" onClick={() => show(status, cursorOf(data.next))}>
            Next page
          </button>
        )}
        {cursor && (
          <button type="button" className="secondary-button" onClick={() => show(status)}>
            First page
          </button>
        )}
      </section>
      {selected && (
        <section key={selected.id} className="card" aria-label="Selected request" data-testid="support-selected">
          <p className="account-text">{label(selected)}</p>
          <ReasonedRead<components["schemas"]["AdminSupportMessage"]>
            title="Message"
            onSessionGone={gone}
            send={async (reason, csrf, signal) =>
              (await getApi()).POST("/api/v1/admin/support-requests/{request_id}/read", {
                params: { path: { request_id: selected.id } },
                body: { reason },
                headers: { "X-CSRFToken": csrf },
                cache: "no-store",
                signal,
              })
            }
            show={(found) => (
              <p className="account-text" style={{ whiteSpace: "pre-wrap" }}>
                {found.message || "The message was erased with the account."}
              </p>
            )}
          />
          {selected.status === "open" && (
            <button type="button" className="primary-button" aria-disabled={working || undefined} onClick={() => close(selected)}>
              Close request
            </button>
          )}
        </section>
      )}
    </>
  );
}

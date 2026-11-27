"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { Field } from "@/components/form-field";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { formatResetDate as formatDate } from "@/lib/publication-allowance";
import { REPORT_REASONS, type ReportReason } from "@/lib/reports";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { shown, useAdminWrite, useSessionGone, words } from "../moderation-shared";

type Queue = components["schemas"]["ReportQueue"];
type Row = Queue["results"][number];
type Detail = components["schemas"]["ReportDetail"];
type Status = Row["status"];

const STATUSES: Record<Status, string> = { pending: "Pending", reviewing: "Reviewing", resolved: "Resolved", dismissed: "Dismissed" };

type List =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; rows: Row[]; next: string | null; unresolved: Queue["unresolved"] };

/** The Report queue (Story 9.2). Nothing here changes a Listing. */
export function ReportsReview() {
  const router = useRouter();
  const gone = useSessionGone("/admin/reports");
  const [status, setStatus] = useState<Status>("pending");
  const [reason, setReason] = useState<ReportReason | "">("");
  const [list, setList] = useState<List>({ kind: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const ticket = useRef(0);

  const read = useCallback(
    async (wanted: Status, why: ReportReason | "", after: string | null = null, kept: Row[] = []) => {
      const mine = ++ticket.current;
      try {
        const cursor = after ? (new URL(after, window.location.origin).searchParams.get("cursor") ?? undefined) : undefined;
        const api = await getApi();
        const { data, response } = await withTimeout((signal) =>
          api.GET("/api/v1/admin/reports", { params: { query: { status: wanted, reason: why || undefined, cursor } }, cache: "no-store", signal }),
        );
        if (mine !== ticket.current) return;
        if (response.ok && Array.isArray(data?.results)) return setList({ kind: "ready", rows: [...kept, ...data.results], next: data.next, unresolved: data.unresolved });
        if (response.status === 401) return await gone();
        if (response.status === 404) router.refresh();
        setList({ kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")) });
      } catch (thrown) {
        if (mine === ticket.current) setList({ kind: "error", message: thrownMessage(thrown) });
      }
    },
    [gone, router],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the state is set after the request answers
    void read(status, reason);
  }, [read, status, reason]);

  function filter(apply: () => void) {
    setSelected(null);
    setNotice("");
    setList({ kind: "loading" });
    apply();
  }

  return (
    <>
      <h1 className="page-title">Reports</h1>
      <p className="muted" data-testid="report-counts">
        {list.kind === "ready" ? `Unresolved: ${list.unresolved.pending} pending, ${list.unresolved.reviewing} reviewing.` : "Unresolved reports are counted here."}
      </p>
      <p role="status" aria-live="polite" className={notice ? "state-note" : "sr-only"} data-testid="report-notice">
        {notice}
      </p>
      <div className="field">
        <label htmlFor="report-status">Show</label>
        <select id="report-status" value={status} onChange={(event) => filter(() => setStatus(event.target.value as Status))}>
          {Object.entries(STATUSES).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="report-reason-filter">Reason</label>
        <select id="report-reason-filter" value={reason} onChange={(event) => filter(() => setReason(event.target.value as ReportReason | ""))}>
          <option value="">All reasons</option>
          {Object.entries(REPORT_REASONS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <section className="card" aria-labelledby="reports-title" style={{ marginBottom: "var(--space)" }}>
        <h2 id="reports-title" className="section-title">
          {STATUSES[status]} reports
        </h2>
        {list.kind === "loading" && <p className="muted">Loading reports…</p>}
        {list.kind === "error" && (
          <div role="alert">
            <p>{list.message}</p>
            <button type="button" className="secondary-button" onClick={() => filter(() => void read(status, reason))}>
              Try again
            </button>
          </div>
        )}
        {list.kind === "ready" && list.rows.length === 0 && <p className="muted">No reports.</p>}
        {list.kind === "ready" && list.rows.length > 0 && (
          <ul className="listing-list" aria-label="Reports">
            {list.rows.map((row) => (
              <li key={row.id} className="listing-item" data-testid="report-row">
                <p className="account-text">{row.title ?? "Untitled listing"}</p>
                <p className="muted">
                  {REPORT_REASONS[row.reason]} · Sent {formatDate(row.created_at)}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Review report on ${row.title ?? "Untitled listing"}`}
                  onClick={() => {
                    setNotice("");
                    setSelected(row.id);
                  }}
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.kind === "ready" && list.next && (
          <button type="button" className="secondary-button" onClick={() => void read(status, reason, list.next, list.rows)}>
            Load more
          </button>
        )}
      </section>
      {selected && (
        <ReportPanel
          key={selected}
          reportId={selected}
          gone={gone}
          onNotice={setNotice}
          onMoved={(message) => {
            setNotice(message);
            if (message) void read(status, reason);
          }}
        />
      )}
    </>
  );
}

function ReportPanel({ reportId, gone, onNotice, onMoved }: { reportId: string; gone: () => Promise<void>; onNotice: (message: string) => void; onMoved: (message: string) => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState("");
  const { working, write } = useAdminWrite(gone, onNotice);
  const heading = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    try {
      const api = await getApi();
      const { data, response } = await withTimeout((signal) => api.GET("/api/v1/admin/reports/{report_id}", { params: { path: { report_id: reportId } }, cache: "no-store", signal }));
      if (response.ok && data) return setDetail(data);
      if (response.status === 401) return await gone();
      onNotice(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (thrown) {
      onNotice(thrownMessage(thrown));
    }
  }, [gone, onNotice, reportId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the state is set after the request answers
    void load();
  }, [load]);

  useEffect(() => {
    heading.current?.focus();
  }, [detail?.id]);

  function move(action: "start" | "resolve" | "dismiss") {
    const text = notes.trim();
    if (action !== "start" && text.length < 5) {
      setNotesError("Write notes of at least 5 characters.");
      document.getElementById("report-notes")?.focus();
      return;
    }
    setNotesError("");
    void write<Detail>(
      async (csrf, signal) => {
        const api = await getApi();
        const options = { params: { path: { report_id: reportId } }, headers: { "X-CSRFToken": csrf }, cache: "no-store" as const, signal };
        if (action === "start") return api.POST("/api/v1/admin/reports/{report_id}/start", options);
        const body = { notes: text };
        return action === "resolve"
          ? api.POST("/api/v1/admin/reports/{report_id}/resolve", { ...options, body })
          : api.POST("/api/v1/admin/reports/{report_id}/dismiss", { ...options, body });
      },
      {
        done: (data) => {
          setDetail(data);
          setNotes("");
          onMoved({ start: "The report is being reviewed.", resolve: "The report was resolved.", dismiss: "The report was dismissed." }[action]);
        },
        field: "notes",
        invalid: () => setNotesError("Write notes of 5 to 1000 characters."),
        conflict: () => {
          onMoved("This report has changed. It has been reloaded.");
          void load();
        },
      },
    );
  }

  if (!detail) return <p className="muted">Loading the report…</p>;
  const { snapshot } = detail;
  const busy = working || undefined;
  return (
    <section className="card" aria-labelledby="report-title" data-testid="report-detail">
      <h2 id="report-title" ref={heading} tabIndex={-1} className="section-title account-text">
        {snapshot.title ?? "Untitled listing"}
      </h2>
      <dl className="account-details">
        <dt>Status</dt>
        <dd>{STATUSES[detail.status]}</dd>
        <dt>Reason</dt>
        <dd>{REPORT_REASONS[detail.reason]}</dd>
        <dt>Description</dt>
        <dd className="account-text">{detail.description || "None"}</dd>
        <dt>Reported by</dt>
        <dd className="account-text">{detail.reporter?.masked_email ?? "Account removed"}</dd>
        <dt>Listing owner</dt>
        <dd className="account-text">{detail.owner?.masked_email ?? "Account removed"}</dd>
        <dt>Open reports on this listing</dt>
        <dd>{detail.open_for_listing}</dd>
      </dl>
      <h3>Content when reported</h3>
      <dl className="account-details" data-testid="report-snapshot">
        <dt>Type</dt>
        <dd>{[snapshot.purpose, snapshot.category, snapshot.subtype].map(words).join(" · ")}</dd>
        <dt>Location</dt>
        <dd className="account-text">{[snapshot.locality, snapshot.city].filter(Boolean).join(", ") || "Not given"}</dd>
        <dt>Description</dt>
        <dd className="account-text">{snapshot.description ?? "None"}</dd>
        <dt>Images</dt>
        <dd>{snapshot.image_count}</dd>
        {Object.entries(snapshot.fields ?? {}).map(([key, value]) => (
          <div key={key}>
            <dt>{words(key)}</dt>
            <dd className="account-text">{shown(value)}</dd>
          </div>
        ))}
      </dl>
      <p>
        <Link href={`/admin/listings/${detail.listing_id}`} className="text-link">
          Open this listing
        </Link>
      </p>
      {detail.history.length > 0 && (
        <>
          <h3>Review history</h3>
          <ul aria-label="Review history">
            {detail.history.map((entry) => (
              <li key={entry.at} className="account-text">
                {STATUSES[entry.to_status]} on {formatDate(entry.at)}
                {entry.notes ? `: ${entry.notes}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      {(detail.status === "pending" || detail.status === "reviewing") && (
        <>
          <Field name="report-notes" label="Notes" hint="Only administrators see these. Needed to resolve or dismiss." errors={notesError ? [notesError] : undefined}>
            {(props) => <textarea {...props} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />}
          </Field>
          <div className="image-actions">
            {detail.status === "pending" ? (
              <button type="button" className="primary-button" aria-disabled={busy} onClick={() => move("start")}>
                Start review
              </button>
            ) : (
              <>
                <button type="button" className="primary-button" aria-disabled={busy} onClick={() => move("resolve")}>
                  Resolve
                </button>
                <button type="button" className="secondary-button" aria-disabled={busy} onClick={() => move("dismiss")}>
                  Dismiss
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

"use client";

import { useCallback, useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { cursorOf, useAdminRead } from "../moderation-shared";

type Page = components["schemas"]["AuditPage"];
type Filters = { actor: string; action: string; target_type: string; target: string; date_from: string; date_to: string };

const NONE: Filters = { actor: "", action: "", target_type: "", target: "", date_from: "", date_to: "" };
const when = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "medium" });

/** The audit trail (Story 10.7): read only. */
export function AuditTrail() {
  const [filters, setFilters] = useState<Filters>(NONE);
  const [applied, setApplied] = useState<Filters>(NONE);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const send = useCallback(
    async (signal: AbortSignal) => {
      const query = Object.fromEntries(Object.entries(applied).filter(([, value]) => value));
      return (await getApi()).GET("/api/v1/admin/audit-records", { params: { query: { ...query, cursor } }, cache: "no-store", signal });
    },
    [applied, cursor],
  );
  const { data, failure } = useAdminRead<Page>(send, "/admin/audit");
  const [actions, setActions] = useState<string[]>([]);
  if (data && data.actions.length !== actions.length) setActions(data.actions); // kept while a refused filter is shown

  const input = (name: keyof Filters, label: string, type: string) => (
    <div className="field">
      <label htmlFor={`audit-${name}`}>{label}</label>
      <input id={`audit-${name}`} type={type} autoComplete="off" value={filters[name]} onChange={(event) => setFilters({ ...filters, [name]: event.target.value })} />
    </div>
  );

  return (
    <>
      <h1 className="page-title">Audit log</h1>
      <p className="muted">Records cannot be changed or deleted. Times are Karachi time.</p>
      <form
        aria-label="Filter records"
        className="card"
        style={{ marginBottom: "var(--space)" }}
        onSubmit={(event) => {
          event.preventDefault();
          setCursor(undefined);
          setApplied({ ...filters, actor: filters.actor.trim(), target: filters.target.trim(), target_type: filters.target_type.trim() });
        }}
      >
        {input("actor", "Actor account id", "text")}
        <div className="field">
          <label htmlFor="audit-action">Action</label>
          <select id="audit-action" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}>
            <option value="">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
        {input("target_type", "Target type", "text")}
        {input("target", "Target id", "text")}
        {input("date_from", "From date", "date")}
        {input("date_to", "To date", "date")}
        <button type="submit" className="primary-button">
          Apply filters
        </button>
      </form>
      {failure && <p role="alert">{failure}</p>}
      {!data && !failure && <p className="muted">Loading records…</p>}
      {data && !failure && data.results.length === 0 && <p className="muted">No records.</p>}
      {data && !failure && data.results.length > 0 && (
        <ul className="listing-list" aria-label="Audit records">
          {data.results.map((row) => (
            <li key={row.id} className="listing-item" data-testid="audit-row">
              <p className="account-text">
                {row.action} · {when(row.created_at)}
              </p>
              <p className="muted account-text">
                By {row.actor_email ?? row.actor_kind}
                {row.actor_id ? ` (${row.actor_id})` : ""}
              </p>
              <p className="muted account-text">
                On {row.target_type} {row.target_id}
              </p>
              {row.reason && <p className="account-text">Reason: {row.reason}</p>}
              {Object.keys(row.details).length > 0 && (
                <p className="muted account-text">
                  {Object.entries(row.details)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="image-actions">
        {cursor && (
          <button type="button" className="secondary-button" onClick={() => setCursor(undefined)}>
            First page
          </button>
        )}
        {data?.next && (
          <button type="button" className="secondary-button" onClick={() => setCursor(cursorOf(data.next))}>
            Next page
          </button>
        )}
      </div>
    </>
  );
}

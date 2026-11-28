"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { components } from "@/api/schema";
import { STATE_LABELS, typeLabel } from "@/lib/account/account";
import { getApi } from "@/lib/http/api";
import { formatResetDate as formatDate } from "@/lib/account/publication-allowance";
import { cursorOf, useAdminRead } from "../moderation-shared";

type Page = components["schemas"]["DirectoryPage"];
type Row = Page["results"][number];
type Filters = { q: string; type: Row["account_type"] | ""; state: Row["state"] | "" };

/** The account directory (Story 10.4): names and masked emails only. The search is not put in the page address. */
export function Directory() {
  const [filters, setFilters] = useState<Filters>({ q: "", type: "", state: "" });
  const [applied, setApplied] = useState<Filters>(filters);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const send = useCallback(
    async (signal: AbortSignal) =>
      (await getApi()).GET("/api/v1/admin/accounts", {
        params: { query: { q: applied.q || undefined, type: applied.type || undefined, state: applied.state || undefined, cursor } },
        cache: "no-store",
        signal,
      }),
    [applied, cursor],
  );
  const { data, failure } = useAdminRead<Page>(send, "/admin/accounts");

  return (
    <section className="card" aria-labelledby="directory-title" style={{ marginBottom: "var(--space)" }}>
      <h2 id="directory-title" className="section-title">
        Directory
      </h2>
      <form
        aria-label="Search accounts"
        onSubmit={(event) => {
          event.preventDefault();
          setCursor(undefined);
          setApplied({ ...filters, q: filters.q.trim() });
        }}
      >
        <div className="field">
          <label htmlFor="directory-q">Name or account id</label>
          <input id="directory-q" type="search" maxLength={100} autoComplete="off" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="directory-type">Type</label>
          <select id="directory-type" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value as Filters["type"] })}>
            <option value="">All</option>
            <option value="individual">Individual</option>
            <option value="agency">Agency</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="directory-state">State</label>
          <select id="directory-state" value={filters.state} onChange={(event) => setFilters({ ...filters, state: event.target.value as Filters["state"] })}>
            <option value="">All</option>
            {Object.entries(STATE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="secondary-button">
          Search
        </button>
      </form>
      {failure && <p role="alert">{failure}</p>}
      {!data && !failure && <p className="muted">Loading accounts…</p>}
      {data && data.results.length === 0 && <p className="muted">No accounts.</p>}
      {data && data.results.length > 0 && (
        <ul className="listing-list" aria-label="Accounts">
          {data.results.map((row) => (
            <li key={row.id} className="listing-item" data-testid="account-row">
              <p className="account-text">
                <Link href={`/admin/accounts/${row.id}`} className="text-link">
                  {row.display_name || row.masked_email}
                </Link>
              </p>
              <p className="muted account-text">
                {[typeLabel(row.account_type), STATE_LABELS[row.state], row.masked_email, `Joined ${formatDate(row.created_at)}`].join(" · ")}
              </p>
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
    </section>
  );
}

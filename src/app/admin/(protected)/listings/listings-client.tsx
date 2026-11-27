"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { formatResetDate as formatDate } from "@/lib/publication-allowance";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { STATUS_LABELS, useSessionGone, words } from "../moderation-shared";

type Row = components["schemas"]["AdminListingPage"]["results"][number];
type Filters = { status: Row["status"] | ""; category: string; owner: string; created_from: string; created_to: string };

const NONE: Filters = { status: "", category: "", owner: "", created_from: "", created_to: "" };
const CATEGORIES = ["house", "apartment", "plot", "commercial"] as const;

type List = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: Row[]; next: string | null };

/** The Listing review list (Story 9.3). Drafts are listed only when asked for, without their content. */
export function ListingsReview() {
  const router = useRouter();
  const gone = useSessionGone("/admin/listings");
  const [form, setForm] = useState<Filters>(NONE);
  const [applied, setApplied] = useState<Filters>(NONE);
  const [list, setList] = useState<List>({ kind: "loading" });
  const ticket = useRef(0);

  const read = useCallback(
    async (filters: Filters, after: string | null = null, kept: Row[] = []) => {
      const mine = ++ticket.current;
      try {
        const cursor = after ? (new URL(after, window.location.origin).searchParams.get("cursor") ?? undefined) : undefined;
        const query = Object.fromEntries(Object.entries({ ...filters, cursor }).filter(([, value]) => value));
        const api = await getApi();
        const { data, response } = await withTimeout((signal) => api.GET("/api/v1/admin/listings", { params: { query }, cache: "no-store", signal }));
        if (mine !== ticket.current) return;
        if (response.ok && Array.isArray(data?.results)) return setList({ kind: "ready", rows: [...kept, ...data.results], next: data.next });
        if (response.status === 401) return await gone();
        if (response.status === 404) router.refresh();
        const message = response.status === 400 ? "Check the filters and try again." : failureMessage(response.status, response.headers.get("Retry-After"));
        setList({ kind: "error", message });
      } catch (thrown) {
        if (mine === ticket.current) setList({ kind: "error", message: thrownMessage(thrown) });
      }
    },
    [gone, router],
  );

  useEffect(() => {
    void read(applied);
  }, [read, applied]);

  function apply(filters: Filters) {
    setList({ kind: "loading" });
    setForm(filters);
    setApplied({ ...filters, owner: filters.owner.trim() });
  }

  const input = (name: keyof Filters, label: string, type: string) => (
    <div className="field">
      <label htmlFor={`listing-${name}`}>{label}</label>
      <input id={`listing-${name}`} type={type} autoComplete="off" value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
    </div>
  );

  return (
    <>
      <h1 className="page-title">Listings</h1>
      <p className="muted">Drafts are shown only when you choose them, and reading one is recorded with your reason.</p>
      <form
        className="card"
        aria-label="Filter listings"
        onSubmit={(event) => {
          event.preventDefault();
          apply(form);
        }}
        style={{ marginBottom: "var(--space)" }}
      >
        <div className="field">
          <label htmlFor="listing-status">Status</label>
          <select id="listing-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Filters["status"] })}>
            <option value="">All except drafts</option>
            {Object.entries(STATUS_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="listing-category">Category</label>
          <select id="listing-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            <option value="">All categories</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {words(value)}
              </option>
            ))}
          </select>
        </div>
        {input("owner", "Owner account id", "text")}
        {input("created_from", "Created from", "date")}
        {input("created_to", "Created to", "date")}
        <button type="submit" className="primary-button">
          Apply filters
        </button>
      </form>
      <section className="card" aria-labelledby="listings-title">
        <h2 id="listings-title" className="section-title">
          Results
        </h2>
        {list.kind === "loading" && <p className="muted">Loading listings…</p>}
        {list.kind === "error" && <p role="alert">{list.message}</p>}
        {list.kind === "ready" && list.rows.length === 0 && <p className="muted">No listings.</p>}
        {list.kind === "ready" && list.rows.length > 0 && (
          <ul className="listing-list" aria-label="Listings">
            {list.rows.map((row) => {
              const name = row.title ?? `${words(row.category)} ${row.status === "draft" ? "draft" : "listing"}`;
              return (
                <li key={row.id} className="listing-item" data-testid="admin-listing-row">
                  <p className="account-text">
                    <Link href={`/admin/listings/${row.id}${row.status === "draft" ? "?draft=1" : ""}`} className="text-link">
                      {name}
                    </Link>
                  </p>
                  <p className="muted account-text">
                    {[STATUS_LABELS[row.status], row.restricted ? "Restricted" : null, row.under_review ? "Under review" : null, row.owner?.masked_email, `Created ${formatDate(row.created_at)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <button type="button" className="secondary-button" aria-label={`Show this owner's listings: ${name}`} onClick={() => apply({ ...applied, owner: row.owner_account_id })}>
                    This owner
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {list.kind === "ready" && list.next && (
          <button type="button" className="secondary-button" onClick={() => void read(applied, list.next, list.rows)}>
            Load more
          </button>
        )}
      </section>
    </>
  );
}

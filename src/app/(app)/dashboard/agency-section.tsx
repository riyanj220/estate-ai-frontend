"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRows, fetchTotals, STATUSES, type DashboardPage, type DashboardRow, type Filters, type Totals } from "@/lib/account/agency-dashboard";
import { label } from "@/lib/listing/listing-labels";
import { LISTINGS_PATH } from "@/lib/listing/listing-messages";
import { INBOX_PATH } from "@/lib/messaging/messaging";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/account/use-profile-load";
import { useLocationLists } from "@/lib/reference/use-reference";
import { useRegistry } from "@/lib/listing/use-registry";

const HEADING_ID = "portfolio-title";
const LIST_HEADING_ID = "portfolio-listings-title";
const SIGN_IN_PATH = "/sign-in?next=%2Fdashboard";
const FOCUS_INTERVAL_MS = 5000;
const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

async function loadTotals(): Promise<ProfileFetch<Totals>> {
  const result = await fetchTotals();
  if (result.kind === "ok") return { kind: "ready", profile: result.totals };
  if (result.kind === "gone") return "gone";
  return result.kind === "forbidden" ? { kind: "forbidden" } : { kind: "error", message: result.message };
}

/** The Agency's portfolio (Stories 8.1 and 8.2): totals, then its Listings with filters, views and inquiries. */
export function AgencySection() {
  const { load, retry, stale, sessionGone } = useResourceLoad<Totals>(loadTotals, HEADING_ID, {
    signInPath: SIGN_IN_PATH,
    focusIntervalMs: FOCUS_INTERVAL_MS,
  });
  if (load.kind === "forbidden") return null;
  if (load.kind !== "ready") return <ProfileLoadState load={load} onRetry={retry} noun="portfolio" titleId="portfolio-error-title" />;
  const totals = load.profile;
  return (
    <>
      <section className="card" aria-labelledby={HEADING_ID} data-testid="portfolio-totals">
        <h2 id={HEADING_ID} tabIndex={-1} className="section-title">
          Your portfolio
        </h2>
        <p data-testid="portfolio-total">Total listings: {totals.total_listings}</p>
        <ul aria-label="Listings by status" data-testid="portfolio-statuses">
          {STATUSES.map((status) => (
            <li key={status}>
              {label(status)}: {totals.by_status[status]}
            </li>
          ))}
        </ul>
        <p data-testid="portfolio-inquiries">Inquiries received: {totals.inquiries_total}</p>
        <p data-testid="portfolio-views">Listing views: {totals.views_total}</p>
        <p>
          <Link href={INBOX_PATH} className="text-link">
            Open your inbox
          </Link>
        </p>
        {stale && <p className="muted">These numbers may be out of date. We could not refresh them.</p>}
      </section>
      <Portfolio sessionGone={sessionGone} />
    </>
  );
}

type Rows = { kind: "loading" } | { kind: "error"; message?: string } | ({ kind: "ready" } & DashboardPage);

function Portfolio({ sessionGone }: { sessionGone: () => void }) {
  const [filters, setFilters] = useState<Filters>({});
  const [rows, setRows] = useState<Rows>({ kind: "loading" });
  const [more, setMore] = useState<"idle" | "busy" | "failed">("idle");
  const ticket = useRef(0);

  const show = useCallback(
    (wanted: Filters) => {
      const mine = ++ticket.current;
      return fetchRows(wanted).then((result) => {
        if (mine !== ticket.current) return; // a newer filter's answer applies
        if (result.kind === "gone") return sessionGone();
        setMore("idle");
        setRows(result.kind === "ok" ? { kind: "ready", ...result.page } : { kind: "error", message: result.kind === "failed" ? result.message : undefined });
      });
    },
    [sessionGone],
  );

  useEffect(() => {
    void show({});
  }, [show]);

  function apply(wanted: Filters) {
    setFilters(wanted);
    setRows({ kind: "loading" });
    void show(wanted);
  }

  async function loadMore() {
    if (rows.kind !== "ready" || !rows.next || more === "busy") return;
    const mine = ticket.current;
    setMore("busy");
    const result = await fetchRows(filters, rows.next);
    if (mine !== ticket.current) return;
    if (result.kind === "gone") return sessionGone();
    if (result.kind !== "ok") return setMore("failed");
    setMore("idle");
    setRows({ kind: "ready", results: [...rows.results, ...result.page.results], next: result.page.next });
  }

  return (
    <section className="card" aria-labelledby={LIST_HEADING_ID} data-testid="portfolio-listings">
      <h2 id={LIST_HEADING_ID} className="section-title">
        Listing performance
      </h2>
      <p className="muted">A view is counted once per browser in 30 minutes. Your own views are not counted.</p>
      <FilterForm onApply={apply} />
      <p role="status" className={rows.kind === "ready" && rows.results.length > 0 ? "sr-only" : "muted"} data-testid="portfolio-status">
        {rows.kind === "loading"
          ? "Loading listings…"
          : rows.kind === "ready"
            ? rows.results.length === 0
              ? "No listings match."
              : `${rows.results.length} listing${rows.results.length === 1 ? "" : "s"} shown`
            : ""}
      </p>
      {rows.kind === "error" && (
        <div role="alert">
          <p>{rows.message ?? "We could not load your listings."}</p>
          <button type="button" className="secondary-button" onClick={() => apply(filters)}>
            Try again
          </button>
        </div>
      )}
      {rows.kind === "ready" && rows.results.length > 0 && (
        <ul className="listing-list" aria-label="Listings">
          {rows.results.map((row) => (
            <ListingRow key={row.id} row={row} />
          ))}
        </ul>
      )}
      {rows.kind === "ready" && rows.next && (
        <button type="button" className="secondary-button" aria-disabled={more === "busy" ? true : undefined} onClick={loadMore}>
          Load more
        </button>
      )}
      {more === "failed" && <p role="alert">We could not load more listings. Try again.</p>}
    </section>
  );
}

function ListingRow({ row }: { row: DashboardRow }) {
  const place = [row.locality?.name, row.city?.name].filter(Boolean).join(", ");
  return (
    <li className="listing-item" data-testid="portfolio-row">
      <Link href={`${LISTINGS_PATH}/${row.id}`} className="listing-link font-semibold">
        {row.title ?? "Untitled listing"}
      </Link>
      <p className="muted">
        {[label(row.status), label(row.category), place, `Created ${day.format(new Date(`${row.created_on}T00:00:00Z`))}`].filter(Boolean).join(" · ")}
      </p>
      <p>
        Views: {row.views} · Inquiries: {row.inquiries}
      </p>
    </li>
  );
}

const EMPTY = { status: "", category: "", city_id: "", locality_id: "", created_from: "", created_to: "" };

function FilterForm({ onApply }: { onApply: (filters: Filters) => void }) {
  const [draft, setDraft] = useState(EMPTY);
  const [problem, setProblem] = useState("");
  const registry = useRegistry(SIGN_IN_PATH);
  const { city, locality } = useLocationLists(draft.city_id, true);
  const set = (name: keyof typeof EMPTY, value: string) =>
    setDraft((current) => ({ ...current, [name]: value, ...(name === "city_id" ? { locality_id: "" } : {}) }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.created_from && draft.created_to && draft.created_from > draft.created_to) {
      setProblem("The end date must not be before the start date.");
      return;
    }
    setProblem("");
    onApply(Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== "")) as Filters);
  }

  const select = (name: "status" | "category" | "city_id" | "locality_id", text: string, options: [string, string][], disabled = false) => (
    <div className="field">
      <label htmlFor={`portfolio-${name}`}>{text}</label>
      <select id={`portfolio-${name}`} value={draft[name]} disabled={disabled} onChange={(event) => set(name, event.target.value)}>
        <option value="">Any</option>
        {options.map(([value, shown]) => (
          <option key={value} value={value}>
            {shown}
          </option>
        ))}
      </select>
    </div>
  );
  const date = (name: "created_from" | "created_to", text: string) => (
    <div className="field">
      <label htmlFor={`portfolio-${name}`}>{text}</label>
      <input id={`portfolio-${name}`} type="date" min="2000-01-01" max="9000-12-31" value={draft[name]} onChange={(event) => set(name, event.target.value)} />
    </div>
  );
  const listFailed = registry.status === "error" || city.status === "error" || locality.status === "error";

  return (
    <form onSubmit={submit} noValidate aria-label="Filter listings">
      {select("status", "Status", STATUSES.map((status) => [status, label(status)]))}
      {select("category", "Category", (registry.registry?.categories ?? []).map((id) => [id, label(id)]), registry.status !== "ready")}
      {select("city_id", "City", city.items.map((item) => [item.id, item.name]), city.status !== "ready")}
      {select("locality_id", "Locality", locality.items.map((item) => [item.id, item.name]), draft.city_id === "" || locality.status !== "ready")}
      {date("created_from", "Created from")}
      {date("created_to", "Created to")}
      {listFailed && (
        <p className="muted">
          Some filter choices could not be loaded.{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => {
              if (registry.status === "error") registry.retry();
              if (city.status === "error") city.retry();
              if (locality.status === "error") locality.retry();
            }}
          >
            Load them again
          </button>
        </p>
      )}
      <p role="alert" className={problem ? "field-error" : "sr-only"}>
        {problem}
      </p>
      <button type="submit" className="primary-button">
        Apply filters
      </button>{" "}
      <button
        type="button"
        className="secondary-button"
        onClick={() => {
          setDraft(EMPTY);
          setProblem("");
          onApply({});
        }}
      >
        Clear filters
      </button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { clearFlash, peekFlash } from "@/lib/flash";
import { withTimeout } from "@/lib/forms";
import { label, readListing, summaryOf, type ListingView } from "@/lib/listing-labels";
import {
  SHOWING_TAB,
  noTabListings,
  LISTINGS_NOT_AVAILABLE_NOW,
  LISTINGS_PATH,
  LISTINGS_UNAVAILABLE,
  LOAD_MORE_FAILED,
  NEW_LISTING_PATH,
  signInPathFor,
} from "@/lib/listing-messages";
import { TAB_LABELS, TAB_ORDER, defaultTab, isListingStatus, readCounts, totalOf, type Counts, type ListingStatus } from "@/lib/listing-status";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useFormFeedback } from "@/lib/use-form-feedback";
import { usePageshowRecheck } from "@/lib/use-pageshow-recheck";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";

const HEADING_ID = "listings-title";
const itemId = (id: string) => `listing-${id}`;
const NO_MORE = "No more listings to show.";
/** One load more follows at most this many cursors when a page only repeats what is shown. */
const MAX_PAGES_PER_CLICK = 4;

/** A page as read: the status it lists, the items and the cursor inside the server's `next` link (null at the end). */
type Page = { status: ListingStatus; items: ListingView[]; next: string | null };
/** What a load answers: the first page of the tab and the counts of every status (null when they could not be read). */
type Loaded = { page: Page; counts: Counts | null };
type Answer = { kind: "page"; page: Page } | { kind: "gone" } | { kind: "forbidden" } | { kind: "error"; message: string; status: number };

/** The cursor inside the server's `next` link; null when there is none. */
function cursorOf(next: string): string | null {
  try {
    return new URL(next, window.location.origin).searchParams.get("cursor") || null;
  } catch {
    return null;
  }
}

/** Reads a page, skipping any malformed item and repeats of an id. A `next` link without a usable cursor makes the page unusable. */
function readPage(data: unknown, status: ListingStatus): Page | null {
  if (typeof data !== "object" || data === null) return null;
  const { results, next } = data as Record<string, unknown>;
  if (!Array.isArray(results)) return null;
  const seen = new Set<string>();
  const items = results.map(readListing).filter((item): item is ListingView => {
    if (item === null || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  if (typeof next === "string" && next) {
    const cursor = cursorOf(next);
    return cursor ? { status, items, next: cursor } : null;
  }
  return { status, items, next: null };
}

async function fetchPage(status: ListingStatus, cursor?: string): Promise<Answer> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) =>
      api.GET("/api/v1/me/listings", { params: { query: cursor ? { status, cursor } : { status } }, cache: "no-store", signal }),
    );
    if (response.ok) {
      const page = readPage(data, status);
      return page ? { kind: "page", page } : { kind: "error", message: LOAD_MORE_FAILED, status: 0 };
    }
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")), status: response.status };
  } catch (error) {
    return { kind: "error", message: thrownMessage(error), status: 0 };
  }
}

/** The counts of every status. A failure is never fatal here (the tabs just show no numbers), except a session that is gone or a refused account. */
async function fetchCounts(): Promise<{ kind: "counts"; counts: Counts | null } | { kind: "gone" } | { kind: "forbidden" }> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/listings/counts", { cache: "no-store", signal }));
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "counts", counts: response.ok ? readCounts(data) : null };
  } catch {
    return { kind: "counts", counts: null };
  }
}

const noun = (count: number) => (count === 1 ? "listing" : "listings");

/** What load more added to the first page it started from. */
type More = { source: Page; items: ListingView[]; next: string | null };

/**
 * Loads the signed-in account's own Listings on the client (the page stays behind the server guard), grouped by status (Story 2.17): a tab
 * per status with the live counts, the chosen tab kept in the address (`?status=`, so back, forward and reload keep it), the first page of
 * the tab, then load more with the server cursor (appended, deduplicated by id). The tab opened without a choice is the first that is not
 * empty, in the order Published, Draft, Archived, Sold, Rented, Removed. The frontend only renders what the backend returns; labels come
 * from the ids (`src/lib/listing-labels.ts`). Nothing about a Listing is stored or logged.
 */
export function ListingsClient({ admin }: { admin: boolean }) {
  const signInPath = signInPathFor(LISTINGS_PATH, admin);
  // The type-based wording is only for an administrator; an owner type that is refused (Suspended, Deactivated) gets a neutral one.
  const unavailable = admin ? LISTINGS_UNAVAILABLE : LISTINGS_NOT_AVAILABLE_NOW;
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get("status");
  const urlStatus = isListingStatus(rawStatus) ? rawStatus : null;
  // The tab chosen by default (no usable `status` in the address), known once the counts have been read.
  const [fallback, setFallback] = useState<ListingStatus | null>(null);
  // The counts of the last successful read: the tabs stay on screen (with these numbers) when a later tab fails to load.
  const [known, setKnown] = useState<Counts | null | undefined>(undefined);
  const active = urlStatus ?? fallback;
  // What the reads below use: the tab the address names (an effect keeps it so, before any read it starts). Without one the default is worked
  // out again from the counts at every read, so a Retry or a restore from the cache opens what is first non-empty now.
  const wanted = useRef<ListingStatus | null>(urlStatus);
  // The tab the last read asked for: a failure belongs to it, and choosing another tab reads again.
  const requested = useRef<ListingStatus | null>(null);
  const { load, read, retry, sessionGone } = useResourceLoad<Loaded>(
    async (): Promise<ProfileFetch<Loaded>> => {
      const counting = fetchCounts();
      let status = wanted.current;
      let counted = null as Awaited<typeof counting> | null;
      if (status === null) {
        // No tab named: the counts say which one to open.
        counted = await counting;
        if (counted.kind === "counts") status = defaultTab(counted.counts);
      }
      requested.current = status ?? "published";
      const answer = await fetchPage(status ?? "published");
      counted = counted ?? (await counting);
      if (answer.kind === "gone" || counted.kind === "gone") {
        clearFlash(); // a message that was not shown must not wait for a later visit
        return "gone";
      }
      if (answer.kind === "forbidden" || counted.kind === "forbidden") return { kind: "forbidden" };
      if (answer.kind === "error") return { kind: "error", message: answer.status === 429 ? answer.message : undefined };
      if (wanted.current === null) setFallback(answer.page.status);
      setKnown(counted.counts);
      return { kind: "ready", profile: { page: answer.page, counts: counted.counts } };
    },
    HEADING_ID,
    { signInPath, refreshOnFocus: false },
  );
  usePageshowRecheck(signInPath, () => void read(false));
  const { announcement, announce, resetAnnouncement } = useFormFeedback();
  // A confirmation handed over by the page that sent the person here (for example "Draft deleted."), read once after mounting.
  // The status region is rendered empty first and filled after mounting, so a screen reader announces the change.
  const [flash, setFlashText] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      const text = peekFlash(LISTINGS_PATH);
      clearFlash();
      if (text) setFlashText(text);
    }, 150);
    return () => clearTimeout(timer);
  }, []);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState<More | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const focusTarget = useRef<string | null>(null);

  // What is shown: the first page of the tab plus what load more added to that very page (a fresh first page starts over).
  const loaded = load.kind === "ready" ? load.profile : null;
  const first = loaded && active !== null && loaded.page.status === active ? loaded.page : null;
  const counts = loaded?.counts ?? null;
  const added = more && more.source === first ? more : null;
  const items = first ? [...first.items, ...(added?.items ?? [])] : [];
  const next = first ? (added ? added.next : first.next) : null;

  // The first page on screen now: a load more that started on another tab's page stops when this changes.
  const shownFirst = useRef<Page | null>(null);
  useEffect(() => {
    shownFirst.current = first;
  }, [first]);
  useEffect(() => {
    wanted.current = urlStatus;
    // The address names another tab than the one on screen: read it (the earlier read of another tab is superseded).
    if (loaded && active !== null && loaded.page.status !== active) void read(false);
    // A tab failed to load and another one is chosen: read that one (the failure stays only for its own tab).
    else if (!loaded && load.kind === "error" && !load.retrying && active !== null && requested.current !== active) void read(false);
  }, [active, urlStatus, loaded, load, read]);

  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    document.getElementById(target)?.focus();
  }, [more]);

  async function loadMore() {
    if (!first || !next || loadingMoreRef.current) return;
    const source = first;
    let cursor: string | null = next;
    const known = new Set([...source.items, ...(added?.items ?? [])].map((item) => item.id));
    const fresh: ListingView[] = [];
    let following: string | null = next;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setFailed(false);
    resetAnnouncement();
    try {
      // A page that only repeats known items but moves the cursor on is followed (a few times at most).
      for (let pages = 0; cursor && pages < MAX_PAGES_PER_CLICK; pages += 1) {
        const answer = await fetchPage(source.status, cursor);
        if (shownFirst.current !== source) return; // another tab (or a fresh first page) is shown now: this answer is not for it
        if (answer.kind === "gone") {
          void sessionGone().catch(() => undefined);
          return;
        }
        if (answer.kind !== "page") {
          setFailed(true);
          announce(answer.kind === "forbidden" ? unavailable : answer.status === 429 ? answer.message : LOAD_MORE_FAILED);
          if (fresh.length === 0) return;
          following = cursor; // resume from the page that failed
          break;
        }
        const unseen = answer.page.items.filter((item) => !known.has(item.id));
        for (const item of unseen) known.add(item.id);
        fresh.push(...unseen);
        const advanced: boolean = answer.page.next !== null && answer.page.next !== cursor;
        following = advanced ? answer.page.next : null;
        cursor = unseen.length === 0 && advanced ? answer.page.next : null;
      }
      focusTarget.current = fresh.length > 0 ? itemId(fresh[0].id) : HEADING_ID;
      setMore({ source, items: [...(added?.items ?? []), ...fresh], next: following });
      if (fresh.length > 0) announce(`${fresh.length} more ${noun(fresh.length)} loaded.`);
      else if (!following) announce(NO_MORE);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  /** Opens a tab: the address changes (a history entry, so Back returns to the tab before) and the tab's list is read. */
  function choose(status: ListingStatus) {
    if (status === active) return;
    window.history.pushState(null, "", `${LISTINGS_PATH}?status=${status}`);
    setFailed(false);
    resetAnnouncement();
    announce(SHOWING_TAB(TAB_LABELS[status]));
  }

  /** Arrow keys move the focus between the tabs; Enter and Space open the focused one (the button's own click). */
  function onTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: Number.NEGATIVE_INFINITY, End: Number.POSITIVE_INFINITY };
    if (!Object.hasOwn(keys, event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    const step = keys[event.key];
    const target = Number.isFinite(step) ? (at + step + tabs.length) % tabs.length : step < 0 ? 0 : tabs.length - 1;
    tabs[target].focus();
  }

  const heading = (
    <h1 id={HEADING_ID} tabIndex={-1} className="page-title">
      My listings
    </h1>
  );
  if (load.kind === "forbidden") {
    return (
      <>
        {heading}
        <p className="card" data-testid="listings-unavailable">
          {unavailable}
        </p>
      </>
    );
  }
  const moreButton = next && (
    <button type="button" className="secondary-button" aria-disabled={loadingMore ? true : undefined} onClick={() => void loadMore()}>
      {loadingMore ? "Loading more…" : "Load more"}
    </button>
  );
  const tabCounts = counts ?? (known ?? null);
  const nothingAtAll = load.kind === "ready" && counts !== null && totalOf(counts) === 0;
  const tabLoading = loaded !== null && !first;
  return (
    <>
      {heading}
      <p role="status" aria-live="polite" className={flash ? "muted" : "sr-only"} data-testid="listings-flash">
        {flash}
      </p>
      {load.kind === "ready" && (
        <>
          <p>
            <Link href={NEW_LISTING_PATH} className="primary-button button-link">
              Create listing
            </Link>
          </p>
          {/* The one live region of this page: the tab shown and the results and failures of loading more. */}
          <p role="status" aria-live="polite" className={failed ? "state-note" : announcement ? "muted" : "sr-only"} data-testid="listings-status">
            {announcement}
          </p>
        </>
      )}
      {load.kind !== "ready" && !(load.kind === "error" && known !== undefined) ? (
        <ProfileLoadState load={load} onRetry={retry} noun="listings" />
      ) : nothingAtAll ? (
        <div className="card" data-testid="listings-empty">
          <p>You have no listings yet.</p>
          <p>
            <Link href={NEW_LISTING_PATH} className="text-link">
              Create listing
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Listing status" className="status-tabs" data-testid="listing-tabs" onKeyDown={onTabKeyDown}>
            {TAB_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                id={`tab-${status}`}
                aria-selected={status === active}
                aria-controls="listings-panel"
                tabIndex={status === active ? 0 : -1}
                className="status-tab"
                data-testid={`tab-${status}`}
                onClick={() => choose(status)}
              >
                {TAB_LABELS[status]}
                {tabCounts && (
                  <span className="tab-count" data-testid={`tab-count-${status}`}>
                    {" "}
                    ({tabCounts[status]})
                  </span>
                )}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="listings-panel" aria-labelledby={active ? `tab-${active}` : undefined} aria-busy={tabLoading ? true : undefined} data-testid="listings-panel">
            {load.kind !== "ready" ? (
              <ProfileLoadState load={load} onRetry={retry} noun="listings" />
            ) : tabLoading ? (
              <p className="muted" data-testid="listings-tab-loading">
                Loading {active ? TAB_LABELS[active].toLowerCase() : ""} listings…
              </p>
            ) : items.length === 0 && !next ? (
              <p className="card" data-testid="listings-tab-empty">
                {noTabListings(TAB_LABELS[first?.status ?? "published"])}
              </p>
            ) : (
              <>
                {items.length === 0 ? (
                  <p className="card" data-testid="listings-nothing-yet">
                    Nothing to show on this page yet.
                  </p>
                ) : (
                  <ul className="listing-list" aria-label="My listings">
                    {items.map((item) => (
                      <li key={item.id} id={itemId(item.id)} tabIndex={-1} className="card listing-item" data-testid="listing">
                        <Link href={`${LISTINGS_PATH}/${encodeURIComponent(item.id)}`} className="text-link listing-link">
                          {summaryOf(item.fields)}
                        </Link>
                        <span className="status-marker">{label(item.status)}</span>
                        <Link href={`${LISTINGS_PATH}/${encodeURIComponent(item.id)}/preview`} className="text-link" data-testid="listing-preview-link">
                          Preview<span className="sr-only">: {summaryOf(item.fields)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {moreButton}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

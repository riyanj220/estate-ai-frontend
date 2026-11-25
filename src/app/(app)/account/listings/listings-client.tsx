"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { clearFlash, peekFlash } from "@/lib/flash";
import { withTimeout } from "@/lib/forms";
import { label, readListing, summaryOf, type ListingView } from "@/lib/listing-labels";
import {
  LISTINGS_NOT_AVAILABLE_NOW,
  LISTINGS_PATH,
  LISTINGS_UNAVAILABLE,
  LOAD_MORE_FAILED,
  NEW_LISTING_PATH,
  signInPathFor,
} from "@/lib/listing-messages";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useFormFeedback } from "@/lib/use-form-feedback";
import { usePageshowRecheck } from "@/lib/use-pageshow-recheck";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";

const HEADING_ID = "listings-title";
const itemId = (id: string) => `listing-${id}`;
const NO_MORE = "No more listings to show.";
/** One load more follows at most this many cursors when a page only repeats what is shown. */
const MAX_PAGES_PER_CLICK = 4;

/** A page as read: the items and the cursor inside the server's `next` link (null at the end). */
type Page = { items: ListingView[]; next: string | null };
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
function readPage(data: unknown): Page | null {
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
    return cursor ? { items, next: cursor } : null;
  }
  return { items, next: null };
}

async function fetchPage(cursor?: string): Promise<Answer> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) =>
      api.GET("/api/v1/me/listings", { params: { query: cursor ? { cursor } : {} }, cache: "no-store", signal }),
    );
    if (response.ok) {
      const page = readPage(data);
      return page ? { kind: "page", page } : { kind: "error", message: LOAD_MORE_FAILED, status: 0 };
    }
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")), status: response.status };
  } catch (error) {
    return { kind: "error", message: thrownMessage(error), status: 0 };
  }
}

const noun = (count: number) => (count === 1 ? "listing" : "listings");

/** What load more added to the first page it started from. */
type More = { source: Page; items: ListingView[]; next: string | null };

/**
 * Loads the signed-in account's own Listings on the client (the page stays behind the server guard): the first page, then
 * load more with the server cursor (appended, deduplicated by id). The frontend only renders what the backend returns;
 * labels come from the ids (`src/lib/listing-labels.ts`). Nothing about a Listing is stored or logged.
 */
export function ListingsClient({ admin }: { admin: boolean }) {
  const signInPath = signInPathFor(LISTINGS_PATH, admin);
  // The type-based wording is only for an administrator; an owner type that is refused (Suspended, Deactivated) gets a neutral one.
  const unavailable = admin ? LISTINGS_UNAVAILABLE : LISTINGS_NOT_AVAILABLE_NOW;
  const { load, read, retry, sessionGone } = useResourceLoad<Page>(
    async (): Promise<ProfileFetch<Page>> => {
      const answer = await fetchPage();
      if (answer.kind === "gone") {
        clearFlash(); // a message that was not shown must not wait for a later visit
        return "gone";
      }
      if (answer.kind === "forbidden") return { kind: "forbidden" };
      if (answer.kind === "error") return { kind: "error", message: answer.status === 429 ? answer.message : undefined };
      return { kind: "ready", profile: answer.page };
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

  // What is shown: the first page plus what load more added to that very page (a fresh first page starts over).
  const first = load.kind === "ready" ? load.profile : null;
  const added = more && more.source === first ? more : null;
  const items = first ? [...first.items, ...(added?.items ?? [])] : [];
  const next = first ? (added ? added.next : first.next) : null;

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
        const answer = await fetchPage(cursor);
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
          {/* The one live region of this page: the results and failures of loading more. */}
          <p role="status" aria-live="polite" className={failed ? "state-note" : announcement ? "muted" : "sr-only"} data-testid="listings-status">
            {announcement}
          </p>
        </>
      )}
      {load.kind !== "ready" ? (
        <ProfileLoadState load={load} onRetry={retry} noun="listings" />
      ) : items.length === 0 && !next ? (
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
    </>
  );
}

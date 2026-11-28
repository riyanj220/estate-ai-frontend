"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { withTimeout } from "@/lib/forms/forms";
import { describeNotification } from "@/lib/messaging/notification-kinds";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";
import { ProfileLoadState, useProfileLoad, type ProfileFetch } from "@/lib/account/use-profile-load";
import { useUnreadCount } from "@/lib/messaging/use-unread-count";

type Item = components["schemas"]["Notification"];
type Filter = "all" | "unread";
type Tone = "info" | "error";
/** A page as the server answered it, tagged with the filter it was asked for. `next` is the cursor, not the link. */
type Page = { items: Item[]; next: string | null; filter: Filter };
/** What is shown: the loaded first page (`source`) plus the edits made since. `extra` is true once load more added pages. */
type List = { source: Page | null; items: Item[]; next: string | null; extra: boolean };
type Answer =
  | { kind: "page"; items: Item[]; next: string | null }
  | { kind: "gone" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string; status: number };

const HEADING_ID = "notifications-title";
const itemId = (id: string) => `notification-${id}`;
const LOAD_MORE_FAILED = "We could not load more notifications. Try again.";
const NOT_AVAILABLE = "Notifications are not available for this account.";
const NO_UNREAD = "No unread notifications.";
const NO_MORE = "No more notifications to show.";
/** How many pages the Unread filter reads to refill a list its own edits emptied. */
const REFILL_PAGES = 5;
/** Page re-reads on focus are coalesced to one per this long. */
const FOCUS_INTERVAL_MS = 5000;

/** The cursor inside the server's `next` link; null when there is none. */
function cursorOf(next: string): string | null {
  try {
    return new URL(next, window.location.origin).searchParams.get("cursor") || null;
  } catch {
    return null;
  }
}

function readItem(value: unknown): Item | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, kind, payload, created_at, read } = value as Record<string, unknown>;
  if (typeof id !== "string" || !id || typeof kind !== "string" || typeof created_at !== "string" || typeof read !== "boolean") return null;
  const values = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? (payload as Item["payload"]) : {};
  return { id, kind, payload: values, created_at, read };
}

/** Reads a page, skipping any one malformed item. A `next` link without a usable cursor makes the whole page unusable (null). */
function readPage(data: unknown): { items: Item[]; next: string | null } | null {
  if (typeof data !== "object" || data === null) return null;
  const { results, next } = data as Record<string, unknown>;
  if (!Array.isArray(results)) return null;
  const items = results.map(readItem).filter((item): item is Item => item !== null);
  if (typeof next === "string" && next) {
    const cursor = cursorOf(next);
    return cursor ? { items, next: cursor } : null;
  }
  return { items, next: null };
}

async function fetchPage(state: Filter, cursor?: string): Promise<Answer> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) =>
      api.GET("/api/v1/notifications", { params: { query: { state, ...(cursor ? { cursor } : {}) } }, cache: "no-store", signal }),
    );
    if (response.ok) {
      const page = readPage(data);
      return page ? { kind: "page", ...page } : { kind: "error", message: LOAD_MORE_FAILED, status: 0 };
    }
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")), status: response.status };
  } catch (error) {
    return { kind: "error", message: thrownMessage(error), status: 0 };
  }
}

/** A readable local time for the `<time>` element; empty when the server's timestamp cannot be read. */
function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const noun = (count: number) => (count === 1 ? "notification" : "notifications");

/**
 * Loads the signed-in account's notifications on the client (the page stays behind the server guard): the list, the
 * All/Unread filter, load more with the server cursor, mark one read and mark all read. The frontend only renders what the
 * backend returns; kinds map to text in `src/lib/messaging/notification-kinds.ts`. Nothing about a notification is stored or logged.
 *
 * State: the loaded list is the authority for what the buttons do (the header count is only a hint). `listRef` and
 * `filterRef` mirror state and are assigned in the same step as it (`commit`, `chooseFilter`). Every request that edits the
 * list remembers the list it started from (`source`) and a re-read counter (`epoch`); an answer that arrives after the list
 * was replaced edits nothing and has the current filter's first page re-read instead.
 */
export function NotificationsClient({ admin }: { admin: boolean }) {
  const signInPath = admin ? "/admin/sign-in?next=%2Fadmin" : "/sign-in?next=%2Faccount%2Fnotifications";
  const [filter, setFilter] = useState<Filter>("all");
  const filterRef = useRef<Filter>("all");
  const { count, refresh: refreshCount } = useUnreadCount();
  const { announcement, announce, resetAnnouncement } = useFormFeedback();
  const [tone, setTone] = useState<Tone>("info");

  const { load, read, retry, sessionGone } = useProfileLoad<Page>(
    async (): Promise<ProfileFetch<Page>> => {
      const asked = filterRef.current;
      const answer = await fetchPage(asked);
      if (answer.kind === "gone") return "gone";
      if (answer.kind === "forbidden") return { kind: "forbidden" };
      if (answer.kind === "error") return { kind: "error", message: answer.status === 429 ? answer.message : undefined };
      return { kind: "ready", profile: { items: answer.items, next: answer.next, filter: asked } };
    },
    HEADING_ID,
    { signInPath, refreshOnFocus: false },
  );
  const gone = useCallback(() => {
    void sessionGone().catch(() => undefined);
  }, [sessionGone]);

  // Every read of the first page goes through here so edits that raced it can tell.
  const epoch = useRef(0);
  const reread = useCallback(
    (quiet: boolean) => {
      epoch.current += 1;
      return read(quiet);
    },
    [read],
  );

  // What is shown. A fresh load of the current filter starts a new list (done while rendering, not in an effect).
  const [list, setList] = useState<List>({ source: null, items: [], next: null, extra: false });
  if (load.kind === "ready" && list.source !== load.profile && load.profile.filter === filter) {
    setList({ source: load.profile, items: load.profile.items, next: load.profile.next, extra: false });
  }
  const listRef = useRef(list);
  const focusTarget = useRef<string | null>(null);
  const loadKind = useRef(load.kind);
  useEffect(() => {
    listRef.current = list;
    loadKind.current = load.kind;
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    document.getElementById(target)?.focus();
  }, [list, load.kind]);

  /** Applies an edit to the list in the same step as the mirror. Nothing is applied when `source` is no longer the list. */
  function commit(source: Page | null, update: (prev: List) => List, focus?: string | null): boolean {
    if (listRef.current.source !== source) {
      focusTarget.current = null;
      return false;
    }
    const next = update(listRef.current);
    listRef.current = next;
    focusTarget.current = focus ?? null;
    setList(next);
    return true;
  }

  const [reloading, setReloadingState] = useState(false);
  const reloadingRef = useRef(false);
  const reloads = useRef(0);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const busy = useRef(new Set<string>());
  const [markingAll, setMarkingAll] = useState(false);
  const markingAllRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [filling, setFilling] = useState(false);
  const fillingRef = useRef(false);
  const showLoading = reloading || (load.kind === "ready" && load.profile.filter !== filter);

  function say(message: string, kind: Tone = "info") {
    setTone(kind);
    announce(message);
  }

  function setReloading(on: boolean) {
    reloadingRef.current = on;
    setReloadingState(on);
  }

  function chooseFilter(next: Filter) {
    if (next === filterRef.current) return;
    filterRef.current = next;
    setFilter(next);
    resetAnnouncement();
    const mine = ++reloads.current;
    setReloading(true);
    void reread(false).finally(() => {
      if (mine === reloads.current) setReloading(false);
    });
  }

  function setBusy(id: string, on: boolean) {
    if (on) busy.current.add(id);
    else busy.current.delete(id);
    setBusyIds(new Set(busy.current));
  }

  /** The item to focus once `id` has left the list: the one after it, else before it, else the heading; null if `id` is not listed. */
  function neighbourOf(id: string): string | null {
    const items = listRef.current.items;
    const at = items.findIndex((item) => item.id === id);
    if (at < 0) return null;
    const neighbour = items[at + 1] ?? items[at - 1];
    return neighbour ? itemId(neighbour.id) : HEADING_ID;
  }

  /** Reads further pages until the Unread list has something to show again (its own edits can empty it while `next` is set). */
  async function refill() {
    if (fillingRef.current) return;
    fillingRef.current = true;
    setFilling(true);
    try {
      for (let pages = 0; pages < REFILL_PAGES; pages += 1) {
        const current = listRef.current;
        if (current.items.length > 0 || !current.next) return;
        const { source, next: cursor } = current;
        const asked = filterRef.current;
        const answer = await fetchPage(asked, cursor);
        if (answer.kind === "gone") {
          gone();
          return;
        }
        if (listRef.current.source !== source || filterRef.current !== asked) return; // the list was replaced meanwhile
        if (answer.kind !== "page") {
          say(answer.kind === "error" ? answer.message : NOT_AVAILABLE, "error");
          return;
        }
        const known = new Set(current.items.map((item) => item.id));
        const fresh = answer.items.filter((item) => !known.has(item.id));
        commit(source, (prev) => ({ ...prev, items: [...prev.items, ...fresh], next: answer.next === cursor ? null : answer.next }));
      }
    } finally {
      fillingRef.current = false;
      setFilling(false);
    }
  }

  /** The item is read (`removeIt`: also gone from this view). Edits the list only if it is still the one the request started from. */
  function settleItem(id: string, source: Page | null, epochAtStart: number, removeIt: boolean) {
    void refreshCount();
    const raced = epoch.current !== epochAtStart || listRef.current.source !== source;
    if (raced) {
      // The list was replaced while the request ran: take the server's current first page instead of guessing.
      void reread(true);
      return;
    }
    if (!listRef.current.items.some((item) => item.id === id)) return; // no longer listed: only the count matters
    if (removeIt || filterRef.current === "unread") {
      commit(source, (prev) => ({ ...prev, items: prev.items.filter((other) => other.id !== id) }), neighbourOf(id));
      if (listRef.current.items.length === 0 && listRef.current.next) void refill();
    } else {
      commit(source, (prev) => ({ ...prev, items: prev.items.map((other) => (other.id === id ? { ...other, read: true } : other)) }), itemId(id));
    }
  }

  async function markRead(item: Item) {
    if (reloadingRef.current || busy.current.has(item.id)) return;
    const source = listRef.current.source;
    const started = epoch.current;
    setBusy(item.id, true);
    resetAnnouncement();
    try {
      const api = await getApi();
      const { response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.POST("/api/v1/notifications/{notification_id}/read", {
            params: { path: { notification_id: item.id } },
            headers: { "X-CSRFToken": csrf },
            signal,
          }),
        ),
      );
      if (response.ok) {
        settleItem(item.id, source, started, false);
        say("Notification marked as read.");
      } else if (response.status === 404) {
        // Already gone (removed elsewhere): leave quietly.
        settleItem(item.id, source, started, true);
      } else if (response.status === 401) {
        gone();
      } else {
        say(failureMessage(response.status, response.headers.get("Retry-After")), "error");
      }
    } catch (error) {
      say(thrownMessage(error), "error");
    } finally {
      setBusy(item.id, false);
    }
  }

  async function markAll() {
    if (markingAllRef.current || reloadingRef.current) return;
    markingAllRef.current = true;
    setMarkingAll(true);
    resetAnnouncement();
    const source = listRef.current.source;
    const started = epoch.current;
    try {
      const api = await getApi();
      const { data, response } = await withCsrf((csrf) =>
        withTimeout((signal) => api.POST("/api/v1/notifications/read-all", { headers: { "X-CSRFToken": csrf }, signal })),
      );
      if (response.ok) {
        const marked = data?.marked;
        const known = typeof marked === "number" && Number.isFinite(marked) && marked >= 0;
        say(!known ? "Notifications marked as read." : marked === 0 ? NO_UNREAD : `${Math.floor(marked)} ${noun(marked)} marked as read.`);
        void refreshCount();
        if (epoch.current !== started || listRef.current.source !== source) {
          void reread(true);
        } else {
          // The server marked everything read: so is every loaded item (the loaded pages stay).
          const unread = filterRef.current === "unread";
          commit(source, (prev) => ({
            ...prev,
            items: unread ? [] : prev.items.map((other) => ({ ...other, read: true })),
            next: unread ? null : prev.next,
          }));
        }
      } else if (response.status === 401) {
        gone();
      } else {
        say(failureMessage(response.status, response.headers.get("Retry-After")), "error");
      }
    } catch (error) {
      say(thrownMessage(error), "error");
    } finally {
      markingAllRef.current = false;
      setMarkingAll(false);
    }
  }

  async function loadMore() {
    const current = listRef.current;
    if (!current.next || loadingMoreRef.current || reloadingRef.current) return;
    const { source, next: cursor } = current;
    const asked = filterRef.current;
    const started = epoch.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    resetAnnouncement();
    try {
      const answer = await fetchPage(asked, cursor);
      if (answer.kind === "gone") {
        gone();
        return;
      }
      // The filter or the list changed while this ran: its answer belongs to something no longer shown.
      if (epoch.current !== started || listRef.current.source !== source || filterRef.current !== asked) return;
      if (answer.kind !== "page") {
        say(answer.kind === "error" ? answer.message : NOT_AVAILABLE, "error");
        return;
      }
      const known = new Set(listRef.current.items.map((item) => item.id));
      const fresh = answer.items.filter((item) => !known.has(item.id));
      const advanced = answer.next !== null && answer.next !== cursor;
      commit(
        source,
        (prev) => ({ ...prev, items: [...prev.items, ...fresh], next: fresh.length === 0 && !advanced ? null : answer.next, extra: true }),
        fresh.length > 0 ? itemId(fresh[0].id) : null,
      );
      if (fresh.length > 0) say(`${fresh.length} more ${noun(fresh.length)} loaded.`);
      else if (!advanced) say(NO_MORE);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  // Back on the tab: re-read the first page quietly, but only when that cannot throw anything away (no extra pages loaded,
  // nothing pending).
  const lastFocusRead = useRef(0);
  useEffect(() => {
    const again = () => {
      const now = Date.now();
      const idle = busy.current.size === 0 && !markingAllRef.current && !loadingMoreRef.current && !reloadingRef.current && !fillingRef.current;
      if (loadKind.current !== "ready" || listRef.current.extra || !idle || now - lastFocusRead.current < FOCUS_INTERVAL_MS) return;
      lastFocusRead.current = now;
      void reread(true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") again();
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reread]);

  const hasUnread = list.items.some((item) => !item.read) || (count ?? 0) > 0;
  const markAllBlocked = !hasUnread || markingAll || showLoading;

  const heading = (
    <h1 id={HEADING_ID} tabIndex={-1} className="page-title mb-6 tracking-[-0.02em]">
      Notifications
    </h1>
  );
  if (load.kind === "forbidden") {
    return (
      <>
        {heading}
        <p className="card" data-testid="notifications-forbidden">
          {NOT_AVAILABLE}
        </p>
      </>
    );
  }

  return (
    <>
      {heading}
      {load.kind !== "loading" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Show notifications" className="flex gap-1 rounded-full bg-sand p-1">
              {(["all", "unread"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className="min-h-11 min-w-24 cursor-pointer rounded-full px-5 text-[0.9375rem] font-semibold aria-pressed:bg-accent aria-pressed:text-white"
                  aria-pressed={filter === value}
                  onClick={() => chooseFilter(value)}
                >
                  {value === "all" ? "All" : "Unread"}
                </button>
              ))}
            </div>
            {load.kind === "ready" && (
              <div className="flex flex-wrap items-center gap-3">
                {count !== null && (
                  <span className="text-[0.875rem] font-semibold text-muted" data-testid="unread-summary">
                    {count} unread
                  </span>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  aria-disabled={markAllBlocked ? true : undefined}
                  onClick={() => {
                    if (markingAllRef.current || reloadingRef.current) return;
                    if (!hasUnread) say(NO_UNREAD);
                    else void markAll();
                  }}
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
          {/* The one live region of this page: results and failures of marking read and loading more. */}
          <p role="status" aria-live="polite" className={announcement ? (tone === "error" ? "state-note" : "muted") : "sr-only"} data-testid="notifications-status">
            {announcement}
          </p>
        </>
      )}
      {load.kind !== "ready" ? (
        <ProfileLoadState load={load} onRetry={retry} noun="notifications" />
      ) : showLoading || (filling && list.items.length === 0) ? (
        <p className="muted" data-testid="notifications-reloading">
          Loading notifications…
        </p>
      ) : (
        <>
          {list.items.length === 0 ? (
            <p className="card py-12 text-center text-muted" data-testid="notifications-empty">
              {filter === "unread" ? "You have no unread notifications." : "You have no notifications."}
            </p>
          ) : (
            <ul className="card mb-4 list-none divide-y divide-line overflow-hidden p-0" aria-label="Notifications">
              {list.items.map((item) => {
                const view = describeNotification(item.kind, item.payload);
                const time = formatTime(item.created_at);
                return (
                  <li
                    key={item.id}
                    id={itemId(item.id)}
                    tabIndex={-1}
                    className={`notification-item grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 p-5${item.read ? "" : " notification-item-unread bg-accent-soft/60"}`}
                    data-testid="notification"
                  >
                    <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-full ${item.read ? "bg-sand text-muted" : "bg-accent text-white"}`}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 16V10a6 6 0 0 1 12 0v6l2 2H4zM10 21h4" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <strong className="notification-title">{view.title}</strong>
                        {time && (
                          <time dateTime={item.created_at} className="text-[0.8125rem] text-muted">
                            {time}
                          </time>
                        )}
                      </div>
                      {view.text && <p className="mt-1 text-[0.9375rem] text-muted">{view.text}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
                        {view.href && (
                          <Link href={view.href} className="text-link inline-flex min-h-11 items-center font-semibold" data-testid="notification-link">
                            {view.linkText}
                            <span className="sr-only">: {view.title}</span>
                          </Link>
                        )}
                        {!item.read && <span className="rounded-full border border-accent px-2 text-[0.75rem] font-bold text-accent">Unread</span>}
                        {!item.read && (
                          <button
                            type="button"
                            className="text-link min-h-11 cursor-pointer text-[0.875rem] font-semibold aria-disabled:cursor-not-allowed aria-disabled:text-muted"
                            aria-disabled={busyIds.has(item.id) ? true : undefined}
                            onClick={() => void markRead(item)}
                          >
                            Mark as read<span className="sr-only">: {view.title}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {list.next && (
            <button type="button" className="secondary-button" aria-disabled={loadingMore ? true : undefined} onClick={() => void loadMore()}>
              {loadingMore ? "Loading more…" : "Load more"}
            </button>
          )}
        </>
      )}
    </>
  );
}

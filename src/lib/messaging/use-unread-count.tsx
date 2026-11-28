"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getApi } from "../http/api";
import { withTimeout } from "../forms/forms";
import { useSession } from "../auth/session";

type UnreadValue = {
  /** The last known unread count; null until it is known, and always null for a Visitor. A hint: the page is the truth. */
  count: number | null;
  /** Re-reads the count now (never a loading state; a failure keeps the last known count). Used after the page changes something. */
  refresh: () => Promise<void>;
};

const UnreadContext = createContext<UnreadValue | null>(null);

/** Focus and visibility events within this window of the last one share its answer (one request per return to the tab). */
const EVENT_INTERVAL_MS = 5000;
/** The one retry of a failed first read after sign-in. */
const FIRST_RETRY_MS = 2000;

/**
 * Holds the unread notification count for the header and the notifications page, in memory only, for one account at a time
 * (keyed by the account id: an account switch without a signed-out step drops the old count and reads the new one). Read once
 * when the account appears (one retry after a short delay if that first read fails), quietly on window focus and tab
 * visibility (coalesced: one request in flight, at most one per 5 seconds), and when the page calls `refresh` after marking
 * something read. A `403` or `429` stops further reads until the next sign-in; a `401` asks the session provider to check. No
 * timer polls. Mounted inside the `SessionProvider`.
 */
export function UnreadCountProvider({ children }: { children: React.ReactNode }) {
  const { status, account, refresh: checkSession } = useSession();
  const accountId = status === "signed_in" ? (account?.id ?? null) : null;
  const [held, setHeld] = useState<{ owner: string; count: number } | null>(null);
  const accountRef = useRef<string | null>(null);
  const ticket = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const stopped = useRef(false);
  const lastEvent = useRef(0);
  const firstRead = useRef(true);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const checkRef = useRef(checkSession);
  useEffect(() => {
    checkRef.current = checkSession;
  });

  // A count that belongs to another account (or to a session that has ended) is never shown.
  const count = held && held.owner === accountId ? held.count : null;

  const start = useCallback((): Promise<void> => {
    const owner = accountRef.current;
    if (!owner || stopped.current) return Promise.resolve();
    const mine = ++ticket.current;
    const run: Promise<void> = getApi()
      .then((api) => withTimeout((signal) => api.GET("/api/v1/notifications/unread-count", { cache: "no-store", signal })))
      .then(({ data, response }) => {
        if (mine !== ticket.current || accountRef.current !== owner) return;
        if (response.ok && typeof data?.unread === "number" && Number.isFinite(data.unread) && data.unread >= 0) {
          firstRead.current = false;
          setHeld({ owner, count: Math.floor(data.unread) });
          return;
        }
        if (response.status === 403 || response.status === 429) stopped.current = true;
        else if (response.status === 401) void checkRef.current().catch(() => undefined);
        else retryFirst();
      })
      .catch(() => {
        // A failure keeps the last known count and shows nothing.
        if (mine === ticket.current && accountRef.current === owner) retryFirst();
      })
      .finally(() => {
        if (inFlight.current === run) inFlight.current = null;
      });
    inFlight.current = run;
    return run;

    function retryFirst() {
      if (!firstRead.current) return;
      firstRead.current = false; // once
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void start(), FIRST_RETRY_MS);
    }
  }, []);

  /** A read the page asks for: always goes out; behind one already in flight it waits, so it never reports an older answer. */
  const refresh = useCallback((): Promise<void> => {
    const running = inFlight.current;
    return running ? running.then(() => start()) : start();
  }, [start]);

  useEffect(() => {
    accountRef.current = accountId;
    stopped.current = false;
    firstRead.current = true;
    inFlight.current = null;
    clearTimeout(retryTimer.current);
    if (accountId) void start();
    else ticket.current += 1; // an answer still in flight must not repopulate the count
    return () => clearTimeout(retryTimer.current);
  }, [accountId, start]);

  useEffect(() => {
    const again = () => {
      const now = Date.now();
      if (inFlight.current || now - lastEvent.current < EVENT_INTERVAL_MS) return;
      lastEvent.current = now;
      void start();
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
  }, [start]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnreadCount(): UnreadValue {
  const value = useContext(UnreadContext);
  if (!value) throw new Error("useUnreadCount must be used inside UnreadCountProvider");
  return value;
}

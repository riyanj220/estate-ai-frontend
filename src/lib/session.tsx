"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Account } from "./account";
import { getApi } from "./api";
import { CsrfFetchError, clearCsrfToken, withCsrf } from "./csrf";
import { readErrorBody, rateLimitMessage, withTimeout } from "./forms";

export type { Account } from "./account";
export type SessionStatus = "loading" | "signed_out" | "signed_in" | "error";

export type SignInResult =
  | { kind: "ok" }
  | { kind: "invalid_credentials" }
  | { kind: "validation"; fields: Record<string, string[]>; message: string }
  | { kind: "rate_limited"; message: string }
  | { kind: "forbidden" | "server" | "rejected" | "timeout" | "network" };

export type SignOutResult = { kind: "ok" } | { kind: "failed" };

type SessionValue = {
  status: SessionStatus;
  account: Account | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<SignOutResult>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Maps a thrown error (a failed CSRF fetch, an abort or a network failure) to a sign-in outcome. */
function failureFrom(error: unknown): SignInResult {
  if (error instanceof CsrfFetchError) {
    if (error.status >= 500) return { kind: "server" };
    if (error.status === 429) return { kind: "rate_limited", message: rateLimitMessage(error.retryAfter) };
    return { kind: "rejected" };
  }
  return { kind: isTimeout(error) ? "timeout" : "network" };
}

function parseAccount(text: string): Account | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === "object" && value !== null && "id" in value && "state" in value) return value as Account;
  } catch {
    // fall through
  }
  return null;
}

/** Holds who is signed in, in memory only. The session itself is an HttpOnly cookie that script never touches. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [account, setAccount] = useState<Account | null>(null);
  const latest = useRef(0);
  const statusRef = useRef<SessionStatus>("loading");
  const signingOut = useRef(false);
  const pathname = usePathname();
  const checked = useRef(false);

  const apply = useCallback((next: SessionStatus, nextAccount: Account | null) => {
    statusRef.current = next;
    setAccount(nextAccount);
    setStatus(next);
  }, []);

  /**
   * Asks `me`. A silent check (focus, tab visible, navigation) never flips a known state to "loading", and a failed
   * silent check keeps what was known instead of claiming anything new.
   */
  const check = useCallback(
    async (silent: boolean) => {
      const mine = ++latest.current;
      if (!silent) {
        statusRef.current = "loading";
        setStatus("loading");
      }
      let next: { status: SessionStatus; account: Account | null } | null;
      try {
        const api = await getApi();
        const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me", { signal }));
        if (response.ok && data) next = { status: "signed_in", account: data };
        else if (response.status === 401) next = { status: "signed_out", account: null };
        else next = { status: "error", account: null };
      } catch {
        next = { status: "error", account: null };
      }
      if (mine !== latest.current) return; // a newer check or a sign-in/out superseded this one
      const known = statusRef.current === "signed_in" || statusRef.current === "signed_out";
      if (silent && next.status === "error" && known) return;
      apply(next.status, next.account);
    },
    [apply],
  );

  const refresh = useCallback(() => check(false), [check]);

  useEffect(() => {
    // The first run restores the session; later runs (navigation) re-check it silently.
    const silent = checked.current;
    checked.current = true;
    void check(silent);
  }, [check, pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(true);
    };
    const onFocus = () => void check(true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        const api = await getApi();
        const { error, response, data } = await withCsrf((csrf) =>
          withTimeout((signal) =>
            api.POST("/api/v1/session", {
              body: { email, password },
              headers: { "X-CSRFToken": csrf },
              parseAs: "text", // a 200 whose body cannot be read is still a success: the cookie was set
              signal,
            }),
          ),
        );
        if (response.ok) {
          clearCsrfToken(); // the backend rotated the CSRF secret with the new session
          const parsed = typeof data === "string" ? parseAccount(data) : null;
          if (parsed) {
            latest.current += 1;
            apply("signed_in", parsed);
          } else {
            await check(false); // ask `me` instead
          }
          return { kind: "ok" };
        }
        if (response.status === 401) return { kind: "invalid_credentials" };
        if (response.status === 400) {
          let body = null;
          try {
            body = readErrorBody(typeof error === "string" ? JSON.parse(error) : error);
          } catch {
            body = null;
          }
          if (body) return { kind: "validation", fields: body.fields, message: body.message };
          return { kind: "rejected" };
        }
        if (response.status === 429) return { kind: "rate_limited", message: rateLimitMessage(response.headers.get("Retry-After")) };
        if (response.status === 403) return { kind: "forbidden" };
        if (response.status >= 500) return { kind: "server" };
        return { kind: "rejected" };
      } catch (error) {
        return failureFrom(error);
      }
    },
    [apply, check],
  );

  const signOut = useCallback(async (): Promise<SignOutResult> => {
    if (signingOut.current) return { kind: "failed" };
    signingOut.current = true;
    try {
      const api = await getApi();
      const { response } = await withCsrf((csrf) =>
        withTimeout((signal) => api.DELETE("/api/v1/session", { headers: { "X-CSRFToken": csrf }, signal })),
      );
      // 401 means the session was already gone, which is the state the user asked for.
      if (response.status === 204 || response.status === 401) {
        clearCsrfToken();
        latest.current += 1;
        apply("signed_out", null);
        return { kind: "ok" };
      }
      signingOut.current = false;
      return { kind: "failed" };
    } catch {
      signingOut.current = false;
      return { kind: "failed" };
    }
    // On success the guard stays set: the caller leaves the page with a hard navigation.
  }, [apply]);

  const value = useMemo(() => ({ status, account, signIn, signOut, refresh }), [status, account, signIn, signOut, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

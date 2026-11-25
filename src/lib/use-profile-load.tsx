"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";

/** What a profile fetch answers: the profile, a failure, a wrong account type, or a session that is gone (401). */
export type ProfileFetch<T> = { kind: "ready"; profile: T } | { kind: "error"; message?: string } | { kind: "forbidden" } | "gone";
export type ProfileLoad<T> =
  | { kind: "loading" }
  | { kind: "ready"; profile: T }
  | { kind: "error"; retrying?: boolean; message?: string }
  | { kind: "forbidden" };

export const PROFILE_PATH = "/account/profile";

/**
 * The load handling shared by the Individual and Agency profile pages: the initial read, quiet re-reads (after an email
 * change request, on focus and visibility), a Retry that keeps its button mounted, focus to `headingId` after a Retry
 * succeeds, and the session-gone redirect (to `signInPath`, the profile sign-in by default). `refreshOnFocus: false` leaves
 * out the quiet re-read on focus (a page with load-more state, like the notification list, keeps what it shows).
 * `fetchProfile` must not depend on render state.
 */
export function useProfileLoad<T>(
  fetchProfile: () => Promise<ProfileFetch<T>>,
  headingId: string,
  {
    signInPath = `/sign-in?next=${encodeURIComponent(PROFILE_PATH)}`,
    refreshOnFocus = true,
    focusIntervalMs = 0,
  }: { signInPath?: string; refreshOnFocus?: boolean; focusIntervalMs?: number } = {},
) {
  const { refresh } = useSession();
  const router = useRouter();
  const [load, setLoad] = useState<ProfileLoad<T>>({ kind: "loading" });
  const ticket = useRef(0);
  const started = useRef(false);
  const loadKind = useRef<ProfileLoad<T>["kind"]>("loading");
  const retried = useRef(false);
  const lastFocusRead = useRef(0);
  // True while the numbers on screen come from an earlier read and the latest quiet re-read failed.
  const [stale, setStale] = useState(false);
  const fetcher = useRef(fetchProfile);
  useEffect(() => {
    fetcher.current = fetchProfile;
  });

  // The session is gone: flip the provider to signed out, then sign in again and come back here.
  const sessionGone = useCallback(async () => {
    await refresh();
    router.replace(signInPath);
  }, [refresh, router, signInPath]);

  // A quiet load (after an email change request, on focus) keeps what is on screen when it fails and never shows
  // "loading". It resolves true when a fresh profile was applied.
  // "superseded" means a newer read took over (its answer is the one that applies); "failed" means nothing was applied.
  const readDetailed = useCallback(
    (quiet: boolean): Promise<"applied" | "superseded" | "failed"> => {
      const mine = ++ticket.current;
      return fetcher.current().then(async (next) => {
        if (mine !== ticket.current) return "superseded";
        if (next === "gone") {
          await sessionGone();
          return "failed";
        }
        if (quiet && next.kind !== "ready") {
          setStale(true);
          return "failed";
        }
        setStale(false);
        // A Retry that did not end in a form must not leave the focus hand-over armed for a later quiet success.
        if (!quiet && next.kind !== "ready") retried.current = false;
        setLoad(next);
        return next.kind === "ready" ? "applied" : "failed";
      });
    },
    [sessionGone],
  );
  const read = useCallback((quiet: boolean) => readDetailed(quiet).then((outcome) => outcome === "applied"), [readDetailed]);

  useEffect(() => {
    // The ref guard keeps strict mode and re-renders to one initial read.
    if (started.current) return;
    started.current = true;
    void read(false);
  }, [read]);

  // Silent refresh when the person comes back to the tab, so a change made elsewhere does not leave the page stale.
  useEffect(() => {
    if (!refreshOnFocus) return;
    const again = () => {
      if (loadKind.current !== "ready") return;
      const now = Date.now();
      if (focusIntervalMs > 0 && now - lastFocusRead.current < focusIntervalMs) return; // focus and visibility fire together
      lastFocusRead.current = now;
      void read(true);
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
  }, [read, refreshOnFocus, focusIntervalMs]);

  useEffect(() => {
    loadKind.current = load.kind;
    // After a Retry succeeds, move focus to the form heading (the Retry button is gone).
    if (load.kind === "ready" && retried.current) {
      retried.current = false;
      document.getElementById(headingId)?.focus();
    }
  }, [load.kind, headingId]);

  function retry() {
    if (load.kind === "error" && load.retrying) return;
    retried.current = true;
    setLoad({ kind: "error", retrying: true }); // the heading and the button stay mounted while reloading
    void read(false);
  }

  return { load, read, readDetailed, retry, sessionGone, stale };
}

/** The loading and load-failure states of a profile page (the heading and Retry button stay mounted while retrying). */
export function ProfileLoadState({ load, onRetry, noun }: { load: ProfileLoad<unknown>; onRetry: () => void; noun: string }) {
  if (load.kind === "loading") {
    return (
      <p role="status" className="muted" data-testid="profile-loading">
        Loading your {noun}…
      </p>
    );
  }
  if (load.kind !== "error") return null;
  return (
    <section className="card" aria-labelledby="load-error-title">
      <h2 id="load-error-title" className="section-title">
        We could not load your {noun}
      </h2>
      <p className="muted" data-testid="load-error-message">
        {load.message ?? "Check your connection and try again."}
      </p>
      <p role="status" className={load.retrying ? "muted" : "sr-only"}>
        {load.retrying ? "Retrying…" : ""}
      </p>
      <button type="button" className="primary-button" aria-disabled={load.retrying ? true : undefined} onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}

/** A neutral name for the same loader: the listing pages use it (the hook is not specific to profiles). */
export { useProfileLoad as useResourceLoad };

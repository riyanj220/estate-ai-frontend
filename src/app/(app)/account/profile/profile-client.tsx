"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { useSession } from "@/lib/session";
import { DetailsForm } from "./details-form";
import { EmailChangeForm } from "./email-change-form";

export type Profile = components["schemas"]["Profile"];
type Load =
  | { kind: "loading" }
  | { kind: "ready"; profile: Profile }
  | { kind: "error"; retrying?: boolean }
  | { kind: "forbidden" };

const PROFILE_PATH = "/account/profile";

function readProfile(data: unknown): Profile | null {
  if (typeof data !== "object" || data === null) return null;
  const { full_name, phone, email, pending_email } = data as Record<string, unknown>;
  if (typeof full_name !== "string" || typeof phone !== "string" || typeof email !== "string") return null;
  if (pending_email !== null && typeof pending_email !== "string") return null;
  return { full_name, phone, email, pending_email };
}

async function fetchProfile(): Promise<Load | "gone"> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/profile", { signal }));
    if (response.ok) {
      const profile = readProfile(data);
      return profile ? { kind: "ready", profile } : { kind: "error" };
    }
    if (response.status === 401) return "gone";
    return response.status === 403 ? { kind: "forbidden" } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** Loads the profile on the client (the page stays behind the server guard) and lays out the two independent forms. */
export function ProfileClient() {
  const { refresh } = useSession();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const ticket = useRef(0);
  const started = useRef(false);
  const loadKind = useRef<Load["kind"]>("loading");
  const retried = useRef(false);

  // The session is gone: flip the provider to signed out, then sign in again and come back here.
  const sessionGone = useCallback(async () => {
    await refresh();
    router.replace(`/sign-in?next=${encodeURIComponent(PROFILE_PATH)}`);
  }, [refresh, router]);

  // A quiet load (after an email change request, on focus) keeps what is on screen when it fails and never shows
  // "loading". It resolves true when a fresh profile was applied.
  const read = useCallback(
    (quiet: boolean) => {
      const mine = ++ticket.current;
      return fetchProfile().then(async (next) => {
        if (mine !== ticket.current) return false;
        if (next === "gone") {
          await sessionGone();
          return false;
        }
        if (quiet && next.kind !== "ready") return false;
        setLoad(next);
        return next.kind === "ready";
      });
    },
    [sessionGone],
  );

  useEffect(() => {
    // The ref guard keeps strict mode and re-renders to one initial read.
    if (started.current) return;
    started.current = true;
    void read(false);
  }, [read]);

  // Silent refresh when the person comes back to the tab, so a change made elsewhere does not leave the page stale.
  useEffect(() => {
    const again = () => {
      if (loadKind.current === "ready") void read(true);
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
  }, [read]);

  useEffect(() => {
    loadKind.current = load.kind;
    // After a Retry succeeds, move focus to the form heading (the Retry button is gone).
    if (load.kind === "ready" && retried.current) {
      retried.current = false;
      document.getElementById("details-title")?.focus();
    }
  }, [load.kind]);

  function retry() {
    if (load.kind === "error" && load.retrying) return;
    retried.current = true;
    setLoad({ kind: "error", retrying: true }); // the heading and the button stay mounted while reloading
    void read(false);
  }

  if (load.kind === "loading") {
    return (
      <p role="status" className="muted" data-testid="profile-loading">
        Loading your profile…
      </p>
    );
  }
  if (load.kind === "forbidden") {
    return (
      <p className="card" data-testid="profile-forbidden">
        Profile editing is available for individual accounts.
      </p>
    );
  }
  if (load.kind === "error") {
    return (
      <section className="card" aria-labelledby="load-error-title">
        <h2 id="load-error-title" className="section-title">
          We could not load your profile
        </h2>
        <p className="muted">Check your connection and try again.</p>
        <p role="status" className={load.retrying ? "muted" : "sr-only"}>
          {load.retrying ? "Retrying…" : ""}
        </p>
        <button type="button" className="primary-button" aria-disabled={load.retrying ? true : undefined} onClick={retry}>
          Retry
        </button>
      </section>
    );
  }
  return (
    <>
      <DetailsForm initial={load.profile} onSessionGone={sessionGone} onSaved={() => void read(true)} />
      <EmailChangeForm
        email={load.profile.email}
        pendingEmail={load.profile.pending_email}
        onRequested={() => read(true)}
        onSessionGone={sessionGone}
      />
    </>
  );
}

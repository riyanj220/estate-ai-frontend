"use client";

import { useRef, useState } from "react";
import { fetchClosure, requestClosure, type Closure, type ClosureKind } from "@/lib/account/closure";
import { formatResetDate as formatDate } from "@/lib/account/publication-allowance";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/account/use-profile-load";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";

const HEADING_ID = "closure-title";
const SIGN_IN_PATH = `/sign-in?next=${encodeURIComponent("/account/closure")}`;
const STATUS = { pending: "Pending", approved: "Approved", rejected: "Rejected" } as const;
const KINDS: Record<ClosureKind, string> = { deactivation: "Deactivate my account", deletion: "Delete my account" };

async function load(): Promise<ProfileFetch<Closure>> {
  const result = await fetchClosure();
  if (result.kind === "ok") return { kind: "ready", profile: result.view };
  if (result.kind === "gone") return "gone";
  return result.kind === "forbidden" ? { kind: "forbidden" } : { kind: "error", message: result.message };
}

/** The latest closure request and, when none is pending, the form to send one (Story 10.1). Suspended accounts may use it. */
export function ClosureClient() {
  const { load: state, read, retry, sessionGone } = useResourceLoad<Closure>(load, HEADING_ID, { signInPath: SIGN_IN_PATH });
  const { announcement, announce, resetAnnouncement, notice, setNotice, showNotice, noticeRef } = useFormFeedback();
  const [kind, setKind] = useState<ClosureKind>("deactivation");
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  /** The answer of the latest change; it replaces what was loaded. */
  const [changed, setChanged] = useState<Closure | null>(null);

  if (state.kind === "forbidden") {
    return <p className="card">Closure requests are available for individual and agency accounts.</p>;
  }
  if (state.kind !== "ready") return <ProfileLoadState load={state} onRetry={retry} noun="closure request" />;
  const view = changed ?? state.profile;
  const request = view.request;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (running.current) return;
    running.current = true;
    setWorking(true);
    resetAnnouncement();
    setNotice("");
    const result = await requestClosure(kind);
    running.current = false;
    setWorking(false);
    if (result.kind === "ok") {
      setChanged(result.view);
      announce("Your request was sent.");
      requestAnimationFrame(() => document.getElementById(HEADING_ID)?.focus());
      return;
    }
    if (result.kind === "gone") return sessionGone();
    if (result.kind === "conflict") {
      setChanged(null);
      void read(true);
      return showNotice("A request is already pending. It has been reloaded.");
    }
    showNotice(result.kind === "failed" && result.message ? result.message : "This request could not be submitted. Please try again.");
  }

  return (
    <>
      <p role="status" aria-live="polite" className={announcement && !notice ? "col-span-full rounded-xl bg-accent-soft p-4 font-semibold text-accent" : "sr-only"} data-testid="closure-announcement">
        {announcement}
      </p>
      {notice && (
        <p ref={noticeRef} tabIndex={-1} className="state-note col-span-full" data-testid="closure-notice">
          {notice}
        </p>
      )}
      <section className="card" aria-labelledby={HEADING_ID}>
        <h2 id={HEADING_ID} tabIndex={-1} className="section-title">
          Request status
        </h2>
        {request ? (
          <dl className="account-details grid grid-cols-[minmax(8rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-2">
            <dt>Request</dt>
            <dd>{KINDS[request.kind]}</dd>
            <dt>Status</dt>
            <dd data-testid="closure-state">{STATUS[request.status]}</dd>
            <dt>Sent on</dt>
            <dd>{formatDate(request.submitted_at)}</dd>
            {request.decision_reason && (
              <>
                <dt>Reason</dt>
                <dd className="account-text" data-testid="closure-reason">
                  {request.decision_reason}
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p className="rounded-xl bg-sand px-4 py-8 text-center text-muted" data-testid="closure-state">No request</p>
        )}
      </section>
      {view.can_submit && (
        <form className="card" noValidate onSubmit={submit} aria-label="Request account closure">
          <h2 className="section-title mb-3">Request account closure</h2>
          <p className="muted">
            An administrator reviews your request; your account stays as it is until then. If it is approved you can no longer sign in, your personal details are removed and your listings are
            archived. Messages you sent stay with the people who received them. This cannot be undone.
          </p>
          <fieldset className="field grid gap-2">
            <legend className="mb-2 font-semibold">What do you want?</legend>
            {(Object.keys(KINDS) as ClosureKind[]).map((value) => (
              <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 has-checked:border-accent has-checked:bg-accent-soft">
                <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="size-4 accent-accent" /> {KINDS[value]}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="primary-button min-h-12 px-8" aria-disabled={working || undefined}>
            {working ? "Sending…" : "Send request"}
          </button>
        </form>
      )}
    </>
  );
}

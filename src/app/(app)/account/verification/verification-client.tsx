"use client";

import { useRef, useState } from "react";
import { Field } from "@/components/ui/form-field";
import { changeVerification, fetchVerification, type Draft, type FieldCodes, type Verification } from "@/lib/account/agency-verification";
import { formatResetDate as formatDate } from "@/lib/account/publication-allowance";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/account/use-profile-load";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";

const HEADING_ID = "verification-title";
const SIGN_IN_PATH = `/sign-in?next=${encodeURIComponent("/account/verification")}`;
const LABELS: Record<Verification["status"], string> = {
  unverified: "Not verified",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  revoked: "Revoked",
  withdrawn: "Withdrawn",
};
const ORDER: (keyof Draft)[] = ["business_name", "registration_number", "note"];
const LIMITS: Record<keyof Draft, string> = {
  business_name: "Enter a business name of 2 to 100 characters.",
  registration_number: "Use 3 to 60 letters, digits, spaces, dots, slashes or hyphens.",
  note: "Use at most 500 characters.",
};

async function load(): Promise<ProfileFetch<Verification>> {
  const result = await fetchVerification();
  if (result.kind === "ok") return { kind: "ready", profile: result.view };
  if (result.kind === "gone") return "gone";
  return result.kind === "forbidden" ? { kind: "forbidden" } : { kind: "error", message: result.message };
}

/** Status of the Agency's Verification and, when allowed, the request form (Story 8.3). No document is uploaded. */
export function VerificationClient({ agencyName }: { agencyName: string }) {
  const { load: state, read, retry, sessionGone } = useResourceLoad<Verification>(load, HEADING_ID, { signInPath: SIGN_IN_PATH });
  const { announcement, announce, resetAnnouncement, notice, setNotice, showNotice, noticeRef } = useFormFeedback();
  const [draft, setDraft] = useState<Draft>({ business_name: agencyName, registration_number: "", note: "" });
  const [errors, setErrors] = useState<FieldCodes>({});
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  /** The answer of the latest change; it replaces what was loaded. */
  const [changed, setChanged] = useState<Verification | null>(null);

  if (state.kind === "forbidden") {
    return <p className="card">Verification is available for agency accounts.</p>;
  }
  if (state.kind !== "ready") return <ProfileLoadState load={state} onRetry={retry} noun="verification status" />;
  const view = changed ?? state.profile;
  const request = view.request;

  async function send(body: Draft | null) {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    resetAnnouncement();
    setNotice("");
    setErrors({});
    const result = await changeVerification(body);
    running.current = false;
    setWorking(false);
    if (result.kind === "ok") {
      setChanged(result.view);
      announce(body ? "Your request was sent." : "Your request was withdrawn.");
      requestAnimationFrame(() => document.getElementById(HEADING_ID)?.focus());
      return;
    }
    if (result.kind === "gone") return sessionGone();
    if (result.kind === "invalid") {
      setErrors(result.fields);
      const first = ORDER.find((name) => result.fields[name]);
      requestAnimationFrame(() => first && document.getElementById(first)?.focus());
      return;
    }
    if (result.kind === "conflict") {
      setChanged(null);
      void read(true);
      return showNotice("Your verification status has changed. It has been reloaded.");
    }
    showNotice(result.kind === "failed" && result.message ? result.message : "This request could not be submitted. Please try again.");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  const field = (name: keyof Draft, label: string, hint: string) => (
    <Field name={name} label={label} hint={hint} errors={errors[name] ? [errors[name] === "required" ? "This field is required." : LIMITS[name]] : undefined}>
      {(props) => <input {...props} type="text" autoComplete="off" value={draft[name]} onChange={(event) => setDraft({ ...draft, [name]: event.target.value })} />}
    </Field>
  );

  return (
    <>
      <p role="status" aria-live="polite" className={announcement && !notice ? "muted" : "sr-only"} data-testid="verification-announcement">
        {announcement}
      </p>
      {notice && (
        <p ref={noticeRef} tabIndex={-1} className="state-note" data-testid="verification-notice">
          {notice}
        </p>
      )}
      <section className="card" aria-labelledby={HEADING_ID} style={{ marginBottom: "var(--space)" }}>
        <h2 id={HEADING_ID} tabIndex={-1} className="section-title">
          Status
        </h2>
        <p data-testid="verification-state">{LABELS[view.status] ?? "Unknown"}</p>
        <p className="muted">Verified agencies show a mark on their public profile and listings. You can publish and message without it.</p>
        {request && (
          <dl className="account-details" data-testid="verification-request">
            <dt>Business name</dt>
            <dd className="account-text">{request.business_name}</dd>
            <dt>Registration or licence number</dt>
            <dd className="account-text">{request.registration_number}</dd>
            {request.note && (
              <>
                <dt>Note</dt>
                <dd className="account-text">{request.note}</dd>
              </>
            )}
            <dt>Sent on</dt>
            <dd>{formatDate(request.submitted_at)}</dd>
            {request.decision_reason && (
              <>
                <dt>Reason</dt>
                <dd className="account-text" data-testid="verification-reason">
                  {request.decision_reason}
                </dd>
              </>
            )}
          </dl>
        )}
        {view.can_withdraw && (
          <button type="button" className="secondary-button" aria-disabled={working || undefined} onClick={() => void send(null)}>
            Withdraw request
          </button>
        )}
      </section>
      {view.can_submit && (
        <form className="card" noValidate onSubmit={submit} aria-label="Request verification">
          <h2 className="section-title">Request verification</h2>
          {field("business_name", "Business name", "The name your business is registered under.")}
          {field("registration_number", "Registration or licence number", "No document is needed.")}
          {field("note", "Note for the reviewer (optional)", "Up to 500 characters.")}
          <button type="submit" className="primary-button" aria-disabled={working || undefined}>
            {working ? "Sending…" : "Send request"}
          </button>
        </form>
      )}
    </>
  );
}

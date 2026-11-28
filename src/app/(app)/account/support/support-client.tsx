"use client";

import { useRef, useState } from "react";
import { Field } from "@/components/ui/form-field";
import { formatResetDate as formatDate } from "@/lib/account/publication-allowance";
import { SUPPORT_CATEGORIES, fetchSupportRequests, sendSupportRequest, type SupportCategory, type SupportRequest } from "@/lib/account/support";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/account/use-profile-load";

const HEADING_ID = "support-title";
const SIGN_IN_PATH = `/sign-in?next=${encodeURIComponent("/account/support")}`;
const STATUS = { open: "Open", closed: "Closed" } as const;
const MIN = 10;
const MAX = 2000;
const PROBLEMS: Record<string, string> = {
  required: "Enter your message.",
  too_short: `Write at least ${MIN} characters.`,
  too_long: `Use at most ${MAX} characters.`,
};

async function load(): Promise<ProfileFetch<SupportRequest[]>> {
  const result = await fetchSupportRequests();
  if (result.kind === "ok") return { kind: "ready", profile: result.requests };
  if (result.kind === "gone") return "gone";
  return result.kind === "forbidden" ? { kind: "forbidden" } : { kind: "error", message: result.message };
}

/** The form to write to the platform team and the requests sent before (Story 10.9). Suspended accounts may use it. */
export function SupportClient() {
  const { load: state, retry, sessionGone } = useResourceLoad<SupportRequest[]>(load, HEADING_ID, { signInPath: SIGN_IN_PATH });
  const { announcement, announce, resetAnnouncement, notice, setNotice, showNotice, noticeRef } = useFormFeedback();
  const [category, setCategory] = useState<SupportCategory>("account");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  const [sent, setSent] = useState<SupportRequest[]>([]);

  if (state.kind === "forbidden") {
    return <p className="card">Support requests are available for individual and agency accounts.</p>;
  }
  if (state.kind !== "ready") return <ProfileLoadState load={state} onRetry={retry} noun="support requests" />;
  const requests = [...sent.filter((row) => !state.profile.some((known) => known.id === row.id)), ...state.profile];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (running.current) return;
    const text = message.trim();
    const local = !text ? "required" : text.length < MIN ? "too_short" : "";
    setProblem(local ? PROBLEMS[local] : "");
    if (local) return document.getElementById("support-message")?.focus();
    running.current = true;
    setWorking(true);
    resetAnnouncement();
    setNotice("");
    const result = await sendSupportRequest(category, text);
    running.current = false;
    setWorking(false);
    if (result.kind === "ok") {
      setSent((rows) => [result.request, ...rows]);
      setMessage("");
      announce("Your request was recorded.");
      return;
    }
    if (result.kind === "gone") return sessionGone();
    if (result.kind === "invalid") return setProblem(PROBLEMS[result.code] ?? "Enter a valid message.");
    showNotice(result.kind === "failed" ? result.message : "This request could not be submitted.");
  }

  return (
    <>
      <p role="status" aria-live="polite" className={announcement && !notice ? "col-span-full rounded-xl bg-accent-soft p-4 font-semibold text-accent" : "sr-only"} data-testid="support-announcement">
        {announcement}
      </p>
      {notice && (
        <p ref={noticeRef} tabIndex={-1} className="state-note col-span-full" data-testid="support-notice">
          {notice}
        </p>
      )}
      <form className="card" noValidate onSubmit={submit} aria-label="Contact support">
        <h2 className="section-title mb-3">Contact support</h2>
        <p className="muted">Ask for help or contest a decision. You can send up to 5 requests a day.</p>
        <Field name="support-category" label="Topic">
          {(props) => (
            <select {...props} value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)}>
              {Object.entries(SUPPORT_CATEGORIES).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field name="support-message" label="Message" hint={`${MIN} to ${MAX} characters.`} errors={problem ? [problem] : undefined}>
          {(props) => <textarea {...props} rows={6} maxLength={MAX} value={message} onChange={(event) => setMessage(event.target.value)} />}
        </Field>
        <button type="submit" className="primary-button min-h-12 px-8" aria-disabled={working || undefined}>
          {working ? "Sending…" : "Send message"}
        </button>
      </form>
      <section className="card" aria-labelledby={HEADING_ID}>
        <h2 id={HEADING_ID} tabIndex={-1} className="section-title">
          Your requests
        </h2>
        {requests.length === 0 && <p className="rounded-xl bg-sand px-4 py-8 text-center text-muted">No requests.</p>}
        {requests.length > 0 && (
          <ul className="list-none divide-y divide-line p-0" aria-label="Your support requests">
            {requests.map((row) => (
              <li key={row.id} className="py-3" data-testid="support-row">
                <p className="muted">
                  {[SUPPORT_CATEGORIES[row.category], STATUS[row.status], `Sent ${formatDate(row.submitted_at)}`].join(" · ")}
                </p>
                <p className="account-text" style={{ whiteSpace: "pre-wrap" }}>
                  {row.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

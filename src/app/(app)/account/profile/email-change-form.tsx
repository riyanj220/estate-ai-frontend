"use client";

import { useRef, useState } from "react";
import { ErrorSummary } from "@/components/error-summary";
import { Field, PasswordField } from "@/components/form-field";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { REJECTED_ERROR, readErrorBody, withTimeout } from "@/lib/forms";
import { CURRENT_PASSWORD_MESSAGES, mapKnownCodes } from "@/lib/password-messages";
import { GENERAL_FIELD_MESSAGES, PROFILE_MESSAGES } from "@/lib/registration-messages";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useFormFeedback } from "@/lib/use-form-feedback";

type Fields = Record<string, string[]>;

const FIELD_ORDER = ["new_email", "current_password"];
const FIELD_LABELS: Record<string, string> = { new_email: "New email address", current_password: "Current password" };
const SENT =
  "If that address can be used, we have sent it a confirmation link. Your sign-in address does not change until you open it.";

/** Requests an email change. Whatever the address, a 202 gets the one neutral confirmation. */
export function EmailChangeForm({
  email,
  pendingEmail,
  onRequested,
  onSessionGone,
}: {
  email: string;
  pendingEmail: string | null;
  /** Re-reads the profile quietly; true when the fresh profile arrived. */
  onRequested: () => Promise<boolean>;
  onSessionGone: () => Promise<void>;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  // The address typed for the last accepted request: shown as the pending note while the profile re-read has not arrived.
  const [requested, setRequested] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const { announcement, setAnnouncement, resetAnnouncement, announce, notice, setNotice, showNotice, focusSummary, summaryRef, noticeRef } =
    useFormFeedback();
  const submitting = useRef(false);

  const hasErrors = formErrors.length > 0 || Object.keys(fieldErrors).length > 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setSent(false);
    setNotice("");
    const address = newEmail.trim();
    // Required fields are checked here so an empty form sends nothing; every other rule is the server's.
    const missing: Fields = {};
    if (newEmail.trim() === "") missing.new_email = [PROFILE_MESSAGES.new_email.required];
    if (password === "") missing.current_password = [CURRENT_PASSWORD_MESSAGES.required];
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setFormErrors([]);
      focusSummary();
      announce("The form has errors. Review the list at the top of the page.");
      return;
    }
    setFieldErrors({});
    setFormErrors([]);
    submitting.current = true;
    setPending(true);
    resetAnnouncement();
    setAnnouncement("Requesting the email change.");
    try {
      const api = await getApi();
      const { error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.POST("/api/v1/me/email-change", {
            body: { new_email: address, current_password: password },
            headers: { "X-CSRFToken": csrf },
            signal,
          }),
        ),
      );
      if (response.status === 202) {
        setPassword("");
        resetAnnouncement();
        setSent(true);
        // Re-read so the pending address comes from the server; if that fails the typed address stands in.
        void onRequested().then((fresh) => setRequested(fresh ? "" : address));
        return;
      }
      if (response.status === 401) return await onSessionGone();
      const parsed = response.status === 400 ? readErrorBody(error) : null;
      if (parsed) {
        const fields: Fields = {};
        const general: string[] = [];
        for (const [key, messages] of Object.entries(parsed.fields)) {
          if (messages.length === 0) continue;
          if (key === "new_email") {
            // Only known codes are shown, so no server sentence can hint at whether an address is registered.
            fields.new_email = mapKnownCodes(messages, PROFILE_MESSAGES.new_email, PROFILE_MESSAGES.new_email.invalid_email);
          } else if (key === "current_password") fields.current_password = mapKnownCodes(messages, CURRENT_PASSWORD_MESSAGES);
          else general.push(...mapKnownCodes(messages, GENERAL_FIELD_MESSAGES, REJECTED_ERROR));
        }
        if (Object.keys(fields).length === 0 && general.length === 0) general.push(REJECTED_ERROR);
        general.splice(0, general.length, ...new Set(general));
        setPassword("");
        setFieldErrors(fields);
        setFormErrors(general);
        focusSummary();
        announce("The form has errors. Review the list at the top of the page.");
        return;
      }
      // A second 403 is generic on purpose. A CSRF rejection happens before the backend service runs, so the one CSRF
      // retry in `withCsrf` cannot double-count the password throttle.
      showNotice(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (error) {
      showNotice(thrownMessage(error));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="email-title" className="card">
      <h2 id="email-title" className="section-title">
        Sign-in email address
      </h2>
      <p>
        Your current address is <strong data-testid="current-email">{email}</strong>.
      </p>
      {(pendingEmail ?? (requested || null)) && (
        <p className="muted" data-testid="pending-email">
          We received a request to change to {pendingEmail ?? requested}. If that address can be used, we sent it a
          confirmation link. Your sign-in address stays {email} until you open the link.
        </p>
      )}
      {/* The one live region of this form: the visible confirmation when there is one, else the busy and error announcements. */}
      <p role="status" aria-live="polite" className={sent ? "muted" : "sr-only"} data-testid={sent ? "email-sent" : undefined}>
        {sent ? SENT : announcement}
      </p>
      {hasErrors && (
        <ErrorSummary
          ref={summaryRef}
          order={FIELD_ORDER}
          labels={FIELD_LABELS}
          fieldErrors={fieldErrors}
          formErrors={formErrors}
          titleId="email-error-summary-title"
        />
      )}
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="alert" className="notice" data-testid="email-notice">
          {notice}
        </p>
      )}
      <form method="post" onSubmit={onSubmit} noValidate aria-busy={pending}>
        <Field name="new_email" label="New email address" errors={fieldErrors.new_email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="off"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setSent(false);
              }}
            />
          )}
        </Field>
        <PasswordField
          name="current_password"
          label="Current password"
          autoComplete="current-password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setSent(false);
          }}
          errors={fieldErrors.current_password}
        />
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Requesting…" : "Change email address"}
        </button>
      </form>
    </section>
  );
}

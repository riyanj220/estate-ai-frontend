"use client";

import { useRef, useState } from "react";
import { ErrorSummary } from "@/components/error-summary";
import { Field } from "@/components/form-field";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { REJECTED_ERROR, readErrorBody, withTimeout } from "@/lib/forms";
import { mapKnownCodes } from "@/lib/password-messages";
import { GENERAL_FIELD_MESSAGES, PROFILE_MESSAGES } from "@/lib/registration-messages";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useSession } from "@/lib/session";
import { useFormFeedback } from "@/lib/use-form-feedback";
import type { Profile } from "./profile-client";

type FieldName = "full_name" | "phone";
type Values = Record<FieldName, string>;
type Fields = Record<string, string[]>;

const FIELD_ORDER: FieldName[] = ["full_name", "phone"];
const FIELD_LABELS: Record<string, string> = { full_name: "Full name", phone: "Phone number" };
const SAVED = "Your profile was saved.";
const NO_CHANGES = "No changes to save.";
const SAVED_RELOAD = "Your profile was saved. We could not read the updated values back; reload the page to see them.";

function readValues(data: unknown): Values | null {
  if (typeof data !== "object" || data === null) return null;
  const { full_name, phone } = data as Record<string, unknown>;
  return typeof full_name === "string" && typeof phone === "string" ? { full_name, phone } : null;
}

function isFieldName(key: string): key is FieldName {
  return (FIELD_ORDER as string[]).includes(key);
}

/** Name and phone. Only the fields that changed are sent; every rule other than "required" is the server's. */
export function DetailsForm({
  initial,
  onSessionGone,
  onSaved,
}: {
  initial: Profile;
  onSessionGone: () => Promise<void>;
  /** Asks the page to re-read the profile quietly (used when the save answer could not be read). */
  onSaved: () => void;
}) {
  const { refresh } = useSession();
  // The values the server last confirmed: the baseline for "what changed".
  const [saved, setSaved] = useState<Values>({ full_name: initial.full_name, phone: initial.phone });
  const [values, setValues] = useState<Values>(saved);
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<"" | "saved" | "unchanged" | "reload">("");
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const { announcement, setAnnouncement, resetAnnouncement, announce, notice, setNotice, showNotice, focusSummary, summaryRef, noticeRef } =
    useFormFeedback();
  const submitting = useRef(false);

  const hasErrors = formErrors.length > 0 || Object.keys(fieldErrors).length > 0;

  function setValue(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setInfo("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setInfo("");
    setNotice("");
    // Required fields are checked here so a blank field sends nothing; every other rule is the server's.
    const missing: Fields = {};
    for (const name of FIELD_ORDER) if (values[name].trim() === "") missing[name] = [PROFILE_MESSAGES[name].required];
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setFormErrors([]);
      focusSummary();
      announce("The form has errors. Review the list at the top of the page.");
      return;
    }
    // What this submit sends; later typing is compared against `submitted` so it is never overwritten by the answer.
    const submitted: Values = { ...values };
    const trimmed: Values = { full_name: values.full_name.trim(), phone: values.phone.trim() };
    const body: Partial<Values> = {};
    for (const name of FIELD_ORDER) if (trimmed[name] !== saved[name]) body[name] = trimmed[name];
    setFieldErrors({});
    setFormErrors([]);
    if (Object.keys(body).length === 0) {
      resetAnnouncement();
      setValues(trimmed); // a trim-only difference must not stay in the field next to "No changes to save."
      setInfo("unchanged");
      return;
    }
    submitting.current = true;
    setPending(true);
    resetAnnouncement();
    setAnnouncement("Saving your profile.");
    try {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) => api.PATCH("/api/v1/me/profile", { body, headers: { "X-CSRFToken": csrf }, signal })),
      );
      if (response.ok) {
        const next = readValues(data);
        resetAnnouncement();
        if (next) {
          setSaved(next);
          // Only fields the person has not touched since submitting take the server's value.
          setValues((current) => ({
            full_name: current.full_name === submitted.full_name ? next.full_name : current.full_name,
            phone: current.phone === submitted.phone ? next.phone : current.phone,
          }));
          setInfo("saved");
        } else {
          // A success whose body cannot be read: the save happened, so say so politely and re-read instead of failing.
          setSaved((current) => ({ ...current, ...body }));
          setValues((current) => ({
            full_name: current.full_name === submitted.full_name ? trimmed.full_name : current.full_name,
            phone: current.phone === submitted.phone ? trimmed.phone : current.phone,
          }));
          setInfo("reload");
          onSaved();
        }
        refresh().catch(() => undefined); // the header name comes from the session provider
        return;
      }
      if (response.status === 401) return await onSessionGone();
      const parsed = response.status === 400 ? readErrorBody(error) : null;
      if (parsed) {
        const fields: Fields = {};
        const general: string[] = [];
        for (const [key, messages] of Object.entries(parsed.fields)) {
          if (messages.length === 0) continue;
          // Known codes only: any other sentence or key is generic, never the server's text.
          if (isFieldName(key)) fields[key] = mapKnownCodes(messages, PROFILE_MESSAGES[key]);
          else general.push(...mapKnownCodes(messages, GENERAL_FIELD_MESSAGES, REJECTED_ERROR));
        }
        if (Object.keys(fields).length === 0 && general.length === 0) general.push(REJECTED_ERROR);
        general.splice(0, general.length, ...new Set(general));
        setFieldErrors(fields);
        setFormErrors(general);
        focusSummary();
        announce("The form has errors. Review the list at the top of the page.");
        return;
      }
      // A second 403 is generic on purpose. A CSRF rejection happens before the backend service runs, so the one CSRF
      // retry in `withCsrf` cannot double-count any throttle.
      showNotice(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (error) {
      showNotice(thrownMessage(error));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="details-title" className="card" style={{ marginBottom: "var(--space)" }}>
      <h2 id="details-title" tabIndex={-1} className="section-title">
        Your details
      </h2>
      {/* The one live region of this form: the visible success or "no changes" text when there is one, else the busy and error announcements. */}
      <p
        role="status"
        aria-live="polite"
        className={info ? "muted" : "sr-only"}
        data-testid={info === "saved" || info === "reload" ? "details-success" : info === "unchanged" ? "details-unchanged" : undefined}
      >
        {info === "saved" ? SAVED : info === "reload" ? SAVED_RELOAD : info === "unchanged" ? NO_CHANGES : announcement}
      </p>
      {hasErrors && (
        <ErrorSummary
          ref={summaryRef}
          order={FIELD_ORDER}
          labels={FIELD_LABELS}
          fieldErrors={fieldErrors}
          formErrors={formErrors}
          titleId="details-error-summary-title"
        />
      )}
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="alert" className="notice" data-testid="details-notice">
          {notice}
        </p>
      )}
      <form method="post" onSubmit={onSubmit} noValidate aria-busy={pending}>
        <Field name="full_name" label="Full name" errors={fieldErrors.full_name}>
          {(props) => (
            <input
              {...props}
              type="text"
              autoComplete="name"
              required
              value={values.full_name}
              onChange={(e) => setValue("full_name", e.target.value)}
            />
          )}
        </Field>
        <Field name="phone" label="Phone number" hint="Private: only you see it." errors={fieldErrors.phone}>
          {(props) => (
            <input
              {...props}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              value={values.phone}
              onChange={(e) => setValue("phone", e.target.value)}
            />
          )}
        </Field>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </section>
  );
}

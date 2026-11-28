"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/http/api";
import {
  NETWORK_ERROR,
  REJECTED_ERROR,
  SERVER_ERROR,
  TIMEOUT_ERROR,
  isTimeoutError,
  rateLimitMessage,
  readErrorBody,
  withTimeout,
} from "@/lib/forms/forms";
import { EMAIL_MESSAGES, mapFieldMessages } from "@/lib/forms/password-messages";

// One confirmation for every address: nothing here says whether the address has an account.
const SENT = "If that address has an account, we have sent a link. It works once and expires in 1 hour.";

type Target = "summary" | "notice" | "sent";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  // The counter makes a repeated identical outcome move focus again once the new content has rendered.
  const [focus, setFocus] = useState<{ target: Target; count: number } | null>(null);
  const submitting = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const sentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!focus) return;
    const refs = { summary: summaryRef, notice: noticeRef, sent: sentRef };
    refs[focus.target].current?.focus();
  }, [focus]);

  function show(target: Target) {
    setFocus((current) => ({ target, count: (current?.count ?? 0) + 1 }));
  }

  // The request is anonymous: the backend view ignores the session cookie, so no CSRF token is needed (no withCsrf).
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setSent(false);
    setNotice("");
    setFieldErrors([]);
    setFormErrors([]);
    const trimmed = email.trim();
    try {
      // The required check is the client's; every other rule is the server's.
      if (!trimmed) {
        setFieldErrors(["Enter your email address."]);
        return show("summary");
      }
      const api = await getApi();
      const { error, response } = await withTimeout((signal) =>
        api.POST("/api/v1/password-reset-requests", { body: { email: trimmed }, signal }),
      );
      if (response.status === 202) {
        setEmail(trimmed);
        setSent(true);
        return show("sent");
      }
      const body = response.status === 400 ? readErrorBody(error) : null;
      if (body) {
        const own = mapFieldMessages(body.fields.email ?? [], EMAIL_MESSAGES);
        const general = Object.entries(body.fields).flatMap(([key, messages]) =>
          key === "email" ? [] : mapFieldMessages(messages, {}),
        );
        if (own.length === 0 && general.length === 0) general.push(REJECTED_ERROR);
        setFieldErrors(own);
        setFormErrors(general);
        return show("summary");
      }
      setNotice(
        response.status === 429
          ? rateLimitMessage(response.headers.get("Retry-After"))
          : response.status >= 500
            ? SERVER_ERROR
            : REJECTED_ERROR,
      );
      show("notice");
    } catch (error) {
      setNotice(isTimeoutError(error) ? TIMEOUT_ERROR : NETWORK_ERROR);
      show("notice");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const hasErrors = fieldErrors.length > 0 || formErrors.length > 0;

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {pending ? "Sending the link." : ""}
      </div>
      {sent && (
        <p ref={sentRef} tabIndex={-1} role="status" className="card" data-testid="form-sent">
          {SENT}
        </p>
      )}
      {hasErrors && (
        <div ref={summaryRef} tabIndex={-1} role="group" className="error-summary" aria-labelledby="error-summary-title">
          <h2 id="error-summary-title" className="summary-title">
            There is a problem
          </h2>
          <ul>
            {fieldErrors.length > 0 && (
              <li>
                <a
                  href="#email"
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById("email")?.focus();
                  }}
                >
                  Email address: {fieldErrors.join(" ")}
                </a>
              </li>
            )}
            {formErrors.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="alert" className="notice" data-testid="form-notice">
          {notice}
        </p>
      )}
      <form method="post" onSubmit={onSubmit} noValidate className="card" aria-busy={pending} style={sent ? { marginTop: "var(--space)" } : undefined}>
        <div className="field">
          <label htmlFor="email">Email address</label>
          {fieldErrors.length > 0 && (
            <p id="email-error" className="field-error">
              <span className="sr-only">Error: </span>
              {fieldErrors.join(" ")}
            </p>
          )}
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={fieldErrors.length ? true : undefined}
            aria-describedby={fieldErrors.length ? "email-error" : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSent(false); // an old confirmation must not sit next to a different address
            }}
          />
        </div>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: "var(--space)" }}>
        Remembered it?{" "}
        <Link href="/sign-in" className="text-link">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

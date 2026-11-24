"use client";

import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { NETWORK_ERROR, SERVER_ERROR, rateLimitMessage, readErrorBody, withTimeout } from "@/lib/forms";

const SENT = "If that address needs verification, we have sent a new link. Check your inbox and spam folder.";
const REJECTED = "We could not send a new link. Please try again.";

export function RequestLinkForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  // The counter makes a repeated identical outcome move focus again once the new content has rendered.
  const [focus, setFocus] = useState<{ target: "summary" | "notice" | "sent"; count: number } | null>(null);
  const submitting = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const sentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!focus) return;
    const refs = { summary: summaryRef, notice: noticeRef, sent: sentRef };
    refs[focus.target].current?.focus();
  }, [focus]);

  function show(target: "summary" | "notice" | "sent") {
    setFocus((current) => ({ target, count: (current?.count ?? 0) + 1 }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setSent(false);
    setNotice("");
    setFieldErrors([]);
    setFormErrors([]);
    try {
      const api = await getApi();
      const { error, response } = await withTimeout((signal) =>
        api.POST("/api/v1/email-verification-requests", { body: { email: email.trim() }, signal }),
      );
      if (response.status === 202) {
        setSent(true);
        return show("sent");
      }
      const body = response.status === 400 ? readErrorBody(error, true) : null;
      if (body) {
        const own = body.fields.email ?? [];
        const general = Object.entries(body.fields).flatMap(([key, messages]) => (key === "email" ? [] : messages));
        if (own.length === 0 && general.length === 0) general.push(body.message);
        setFieldErrors(own);
        setFormErrors(general);
        return show("summary");
      }
      setNotice(
        response.status === 429
          ? rateLimitMessage(response.headers.get("Retry-After"))
          : response.status >= 500
            ? SERVER_ERROR
            : REJECTED,
      );
      show("notice");
    } catch {
      setNotice(NETWORK_ERROR);
      show("notice");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const hasErrors = fieldErrors.length > 0 || formErrors.length > 0;
  const describedBy = fieldErrors.length ? "email-error" : undefined;

  return (
    <section className="card" aria-labelledby="request-title" style={{ marginTop: "var(--space)" }}>
      <h2 id="request-title" className="section-title">
        Request a new link
      </h2>
      {sent && (
        <p ref={sentRef} tabIndex={-1} role="status" className="muted" data-testid="form-sent">
          {SENT}
        </p>
      )}
      {hasErrors && (
        <div ref={summaryRef} tabIndex={-1} role="group" className="error-summary" aria-labelledby="error-summary-title">
          <h3 id="error-summary-title" className="summary-title">
            There is a problem
          </h3>
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
      <form method="post" onSubmit={onSubmit} noValidate aria-busy={pending}>
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
            aria-describedby={describedBy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Sending…" : "Send a new link"}
        </button>
        <div role="status" aria-live="polite" className="sr-only">
          {pending ? "Sending a new link." : ""}
        </div>
      </form>
    </section>
  );
}

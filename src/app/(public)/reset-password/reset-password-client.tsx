"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/http/api";
import { clearCsrfToken } from "@/lib/http/csrf";
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
import { RESET_PASSWORD_MESSAGES, mapFieldMessages } from "@/lib/forms/password-messages";
import { scrubTokenFromHistory } from "@/lib/auth/scrub-token";
import { useSession } from "@/lib/auth/session";
import { StatusScreen } from "@/components/auth/status-screen";

type LinkFailure = "link_expired" | "link_used" | "link_invalid" | "missing";
type State = "init" | "form" | "success" | LinkFailure;
type Target = "summary" | "notice";

const FAILURES: Record<LinkFailure, { title: string; text: string }> = {
  link_expired: { title: "This link has expired", text: "Reset links work for 1 hour." },
  link_used: {
    title: "This link was already used or replaced",
    text: "Each link works once, and only the newest link works.",
  },
  link_invalid: { title: "This link is not valid", text: "The link may be incomplete or mistyped." },
  missing: {
    title: "This link is not valid",
    text: "The link has no reset code. If you reloaded this page, open the link from your email again.",
  },
};

export function ResetPasswordClient() {
  const { refresh } = useSession();
  const [state, setState] = useState<State>("init");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [focus, setFocus] = useState<{ target: Target; count: number } | null>(null);
  // The token lives only here: never in state that renders, storage, logs or the address bar.
  const token = useRef<string | null>(null);
  const started = useRef(false);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // The ref guard keeps strict mode and re-renders to one read. Nothing is sent until the person submits.
    if (started.current) return;
    started.current = true;
    token.current = scrubTokenFromHistory() || null; // the address bar and the router state lose the token at once
    setState(token.current === null ? "missing" : "form");
  }, []);

  useEffect(() => {
    if (state !== "init" && state !== "form") headingRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (!focus) return;
    (focus.target === "summary" ? summaryRef : noticeRef).current?.focus();
  }, [focus]);

  function show(target: Target) {
    setFocus((current) => ({ target, count: (current?.count ?? 0) + 1 }));
  }

  function end(next: State) {
    token.current = null; // a spent, expired or invalid link is never kept
    setPassword("");
    setShowPassword(false);
    setState(next);
  }

  // The confirm is anonymous: the backend view ignores the session cookie, so no CSRF token is needed (no withCsrf).
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || token.current === null) return;
    setFieldErrors([]);
    setFormErrors([]);
    setNotice("");
    // The required check is the client's and sends nothing; every other rule is the server's.
    if (!password) {
      setFieldErrors(["Enter a new password."]);
      return show("summary");
    }
    submitting.current = true;
    setPending(true);
    try {
      const api = await getApi();
      const { error, response } = await withTimeout((signal) =>
        api.POST("/api/v1/password-resets/confirm", { body: { token: token.current ?? "", password }, signal }),
      );
      if (response.ok) {
        end("success");
        clearCsrfToken(); // every session ended, so any cached token is stale
        void refresh(); // every session of the account ended on the server
        return;
      }
      const body = readErrorBody(error);
      if (response.status === 400 && body?.code === "validation_error") {
        // Only a valid link reaches password validation; a token problem or no password field means the link is bad.
        if ("token" in body.fields || !("password" in body.fields)) return end("link_invalid");
        const own = mapFieldMessages(body.fields.password ?? [], RESET_PASSWORD_MESSAGES);
        const general = Object.entries(body.fields).flatMap(([key, messages]) =>
          key === "password" ? [] : mapFieldMessages(messages, {}),
        );
        if (own.length === 0 && general.length === 0) general.push(REJECTED_ERROR);
        setFieldErrors(own);
        setFormErrors(general);
        return show("summary");
      }
      const code = body?.code;
      if (
        (response.status === 410 && code === "link_expired") ||
        (response.status === 409 && code === "link_used") ||
        (response.status === 400 && code === "link_invalid")
      ) {
        return end(code);
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

  const heading = <h1 className="page-title">Choose a new password</h1>;

  if (state === "init") {
    return (
      <>
      {heading}
      <section className="card" aria-labelledby="result-title">
        <h2 id="result-title" className="section-title">
          Checking your link
        </h2>
        <p className="muted">
          Please wait a moment.
        </p>
      </section>
      </>
    );
  }

  if (state === "success") {
    return (
      <StatusScreen icon="done" title="Password changed" headingRef={headingRef} action={{ href: "/sign-in", label: "Sign in" }}>
        <p>Your password has been changed. Sign in with your new password.</p>
      </StatusScreen>
    );
  }

  if (state !== "form") {
    const failure = FAILURES[state];
    return (
      <>
      {heading}
      <section className="card" aria-labelledby="result-title">
        <h2 id="result-title" tabIndex={-1} ref={headingRef} className="section-title">
          {failure.title}
        </h2>
        <p className="muted">
          {failure.text}
        </p>
        <Link href="/forgot-password" className="text-link">
          Request a new link
        </Link>
      </section>
      </>
    );
  }

  const hasErrors = fieldErrors.length > 0 || formErrors.length > 0;
  return (
    <>
      {heading}
      <div role="status" aria-live="polite" className="sr-only">
        {pending ? "Saving your new password." : ""}
      </div>
      {hasErrors && (
        <div ref={summaryRef} tabIndex={-1} role="group" className="error-summary" aria-labelledby="error-summary-title">
          <h2 id="error-summary-title" className="summary-title">
            There is a problem
          </h2>
          <ul>
            {fieldErrors.length > 0 && (
              <li>
                <a
                  href="#password"
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById("password")?.focus();
                  }}
                >
                  New password: {fieldErrors.join(" ")}
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
      <form method="post" onSubmit={onSubmit} noValidate className="card" aria-busy={pending}>
        <div className="field">
          <label htmlFor="password">New password</label>
          {fieldErrors.length > 0 && (
            <p id="password-error" className="field-error">
              <span className="sr-only">Error: </span>
              {fieldErrors.join(" ")}
            </p>
          )}
          <div className="password-row">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              aria-invalid={fieldErrors.length ? true : undefined}
              aria-describedby={fieldErrors.length ? "password-error" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="secondary-button"
              aria-pressed={showPassword}
              aria-controls="password"
              onClick={() => setShowPassword((shown) => !shown)}
            >
              Show password
            </button>
          </div>
        </div>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </button>
      </form>
    </>
  );
}

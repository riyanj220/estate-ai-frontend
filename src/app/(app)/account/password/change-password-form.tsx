"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { CsrfFetchError, withCsrf } from "@/lib/csrf";
import {
  NETWORK_ERROR,
  REJECTED_ERROR,
  SERVER_ERROR,
  TIMEOUT_ERROR,
  isTimeoutError,
  rateLimitMessage,
  readErrorBody,
  withTimeout,
} from "@/lib/forms";
import { CURRENT_PASSWORD_MESSAGES, NEW_PASSWORD_MESSAGES, mapFieldMessages } from "@/lib/password-messages";
import { useSession } from "@/lib/session";

type FieldName = "current_password" | "new_password";
type Fields = Partial<Record<FieldName, string[]>>;
type Target = "summary" | "notice" | "success";

const FIELD_ORDER: FieldName[] = ["current_password", "new_password"];
const FIELD_LABELS: Record<FieldName, string> = { current_password: "Current password", new_password: "New password" };
const FIELD_MAPS: Record<FieldName, Record<string, string>> = {
  current_password: CURRENT_PASSWORD_MESSAGES,
  new_password: NEW_PASSWORD_MESSAGES,
};
const MAYBE_CHANGED = " If this keeps failing, your password may already have changed; try signing in again.";
const SUCCESS = "Your password was changed. Your other devices were signed out.";

/**
 * `signInPath` is where a lost session goes (the administrator door for an administrator, else the ordinary one) and
 * `returnTo` the place to come back to afterwards (an administrator returns to the admin area, the only place the
 * admin sign-in honours).
 */
export function ChangePasswordForm({
  signInPath = "/sign-in",
  returnTo = "/account/password",
}: {
  signInPath?: string;
  returnTo?: string;
}) {
  const { refresh } = useSession();
  const router = useRouter();
  const [values, setValues] = useState<Record<FieldName, string>>({ current_password: "", new_password: "" });
  const [shown, setShown] = useState<Record<FieldName, boolean>>({ current_password: false, new_password: false });
  const [pending, setPending] = useState(false);
  const [changed, setChanged] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [focus, setFocus] = useState<{ target: Target; count: number } | null>(null);
  const submitting = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!focus) return;
    const refs = { summary: summaryRef, notice: noticeRef, success: successRef };
    refs[focus.target].current?.focus();
  }, [focus]);

  function show(target: Target) {
    setFocus((current) => ({ target, count: (current?.count ?? 0) + 1 }));
  }

  function failure(message: string) {
    setNotice(message);
    show("notice");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setChanged(false);
    setFieldErrors({});
    setFormErrors([]);
    setNotice("");
    // Required fields are checked here so an empty form sends nothing; every other rule is the server's.
    const missing: Fields = {};
    if (!values.current_password) missing.current_password = ["Enter your current password."];
    if (!values.new_password) missing.new_password = ["Enter a new password."];
    if (missing.current_password || missing.new_password) {
      setFieldErrors(missing);
      return show("summary");
    }
    submitting.current = true;
    setPending(true);
    try {
      const api = await getApi();
      const { error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.POST("/api/v1/me/password", {
            body: { current_password: values.current_password, new_password: values.new_password },
            headers: { "X-CSRFToken": csrf },
            signal,
          }),
        ),
      );
      if (response.ok) {
        setValues({ current_password: "", new_password: "" });
        setShown({ current_password: false, new_password: false });
        setChanged(true);
        show("success");
        void refresh(); // the session stays signed in; the provider just re-reads who it is
        return;
      }
      if (response.status === 401) {
        // The session is gone: flip to signed out, then sign in again and come back here.
        await refresh();
        router.replace(`${signInPath}?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      const body = response.status === 400 ? readErrorBody(error) : null;
      if (body) {
        const fields: Fields = {};
        const general: string[] = [];
        for (const [key, messages] of Object.entries(body.fields)) {
          const name = FIELD_ORDER.find((candidate) => candidate === key);
          if (name) {
            const mapped = mapFieldMessages(messages, FIELD_MAPS[name]);
            if (mapped.length > 0) fields[name] = mapped;
          } else general.push(...mapFieldMessages(messages, {}));
        }
        if (Object.keys(fields).length === 0 && general.length === 0) general.push(REJECTED_ERROR);
        setFieldErrors(fields);
        setFormErrors(general);
        return show("summary");
      }
      failure(
        response.status === 429
          ? rateLimitMessage(response.headers.get("Retry-After"))
          : response.status >= 500
            ? SERVER_ERROR
            : REJECTED_ERROR,
      );
    } catch (error) {
      if (error instanceof CsrfFetchError) {
        failure(
          error.status === 429 ? rateLimitMessage(error.retryAfter) : error.status >= 500 ? SERVER_ERROR : REJECTED_ERROR,
        );
      } else failure((isTimeoutError(error) ? TIMEOUT_ERROR : NETWORK_ERROR) + MAYBE_CHANGED);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const invalidFields = FIELD_ORDER.filter((name) => fieldErrors[name]?.length);
  const hasErrors = invalidFields.length > 0 || formErrors.length > 0;

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {pending ? "Changing your password." : ""}
      </div>
      {changed && (
        <p ref={successRef} tabIndex={-1} role="status" className="card" data-testid="form-success">
          {SUCCESS}
        </p>
      )}
      {hasErrors && (
        <div ref={summaryRef} tabIndex={-1} role="group" className="error-summary" aria-labelledby="error-summary-title">
          <h2 id="error-summary-title" className="summary-title">
            There is a problem
          </h2>
          <ul>
            {invalidFields.map((name) => (
              <li key={name}>
                <a
                  href={`#${name}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(name)?.focus();
                  }}
                >
                  {FIELD_LABELS[name]}: {fieldErrors[name]?.join(" ")}
                </a>
              </li>
            ))}
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
      <form method="post" onSubmit={onSubmit} noValidate className="card" aria-busy={pending} style={changed ? { marginTop: "var(--space)" } : undefined}>
        {FIELD_ORDER.map((name) => {
          const errors = fieldErrors[name];
          const errorId = `${name}-error`;
          return (
            <div className="field" key={name}>
              <label htmlFor={name}>{FIELD_LABELS[name]}</label>
              {errors?.length ? (
                <p id={errorId} className="field-error">
                  <span className="sr-only">Error: </span>
                  {errors.join(" ")}
                </p>
              ) : null}
              <div className="password-row">
                <input
                  id={name}
                  name={name}
                  type={shown[name] ? "text" : "password"}
                  autoComplete={name === "current_password" ? "current-password" : "new-password"}
                  required
                  aria-invalid={errors?.length ? true : undefined}
                  aria-describedby={errors?.length ? errorId : undefined}
                  value={values[name]}
                  onChange={(e) => {
                    setValues((current) => ({ ...current, [name]: e.target.value }));
                    setChanged(false);
                  }}
                />
                <button
                  type="button"
                  className="secondary-button"
                  aria-pressed={shown[name]}
                  aria-controls={name}
                  onClick={() => setShown((current) => ({ ...current, [name]: !current[name] }))}
                >
                  Show {name === "current_password" ? "current" : "new"} password
                </button>
              </div>
            </div>
          );
        })}
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </button>
      </form>
    </>
  );
}

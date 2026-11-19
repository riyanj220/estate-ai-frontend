"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import {
  NETWORK_ERROR,
  REJECTED_ERROR,
  SERVER_ERROR,
  rateLimitMessage,
  readErrorBody,
  withTimeout,
} from "@/lib/forms";

type FieldName = "full_name" | "email" | "password" | "phone";
type Fields = Record<string, string[]>;
type Status = "idle" | "pending" | "success";

const FIELD_ORDER: FieldName[] = ["full_name", "email", "password", "phone"];
const FIELD_LABELS: Record<FieldName, string> = {
  full_name: "Full name",
  email: "Email address",
  password: "Password",
  phone: "Phone number",
};

function isFieldName(key: string): key is FieldName {
  return (FIELD_ORDER as string[]).includes(key);
}

export function RegisterForm() {
  const [values, setValues] = useState<Record<FieldName, string>>({ full_name: "", email: "", password: "", phone: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const submitting = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const [summaryTick, setSummaryTick] = useState(0);
  const [noticeTick, setNoticeTick] = useState(0);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const focusEmail = useRef(false);

  const hasErrors = formErrors.length > 0 || Object.keys(fieldErrors).length > 0;

  useEffect(() => {
    if (summaryTick > 0) summaryRef.current?.focus();
  }, [summaryTick]);

  useEffect(() => {
    if (noticeTick > 0) noticeRef.current?.focus();
  }, [noticeTick]);

  useEffect(() => {
    if (status === "idle" && focusEmail.current) {
      focusEmail.current = false;
      document.getElementById("email")?.focus();
    }
  }, [status]);

  // Clearing first makes a repeated identical message announce again.
  function announce(message: string) {
    setAnnouncement("");
    setTimeout(() => setAnnouncement(message), 50);
  }

  function showNotice(message: string) {
    setNotice(message);
    setNoticeTick((tick) => tick + 1);
    announce(message);
  }

  function useDifferentEmail() {
    setValues((current) => ({ ...current, email: "", password: "" }));
    setSubmittedEmail("");
    setAnnouncement("");
    focusEmail.current = true;
    setStatus("idle");
  }

  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  function setValue(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setStatus("pending");
    setFieldErrors({});
    setFormErrors([]);
    setNotice("");
    setAnnouncement("Creating your account.");

    const email = values.email.trim();
    try {
      const api = await getApi();
      const { error, response } = await withTimeout((signal) =>
        api.POST("/api/v1/registrations/individuals", {
          body: { full_name: values.full_name, email, password: values.password, phone: values.phone },
          signal,
        }),
      );

      if (response.ok) {
        setSubmittedEmail(email);
        setValues((current) => ({ ...current, email, password: "", phone: "" }));
        setShowPassword(false);
        setStatus("success");
        announce("Check your email. We have sent the next steps.");
        return;
      }

      setStatus("idle");
      const body = response.status === 400 ? readErrorBody(error) : null;
      if (body) {
        const fields: Fields = {};
        const general: string[] = [];
        for (const [key, messages] of Object.entries(body.fields)) {
          if (isFieldName(key) && messages.length > 0) fields[key] = messages;
          else general.push(...messages);
        }
        if (Object.keys(fields).length === 0 && general.length === 0) general.push(body.message);
        setFieldErrors(fields);
        setFormErrors(general);
        setSummaryTick((tick) => tick + 1);
        announce("The form has errors. Review the list at the top of the page.");
      } else if (response.status === 429) {
        showNotice(rateLimitMessage(response.headers.get("Retry-After")));
      } else if (response.status >= 500) {
        showNotice(SERVER_ERROR);
      } else {
        showNotice(REJECTED_ERROR);
      }
    } catch {
      setStatus("idle");
      showNotice(NETWORK_ERROR);
    } finally {
      submitting.current = false;
    }
  }

  const live = (
    <div role="status" aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );

  if (status === "success") {
    return (
      <>
        {live}
        <section className="card" aria-labelledby="success-title">
          <h2 id="success-title" tabIndex={-1} ref={successRef} className="section-title">
            Check your email
          </h2>
          <p>
            If we can use <strong>{submittedEmail}</strong>, we have sent a message with the next steps. It can take a few
            minutes; look in your spam folder if you do not see it.
          </p>
          <p>
            Already verified your email address?{" "}
            <Link href="/sign-in" className="text-link">
              Sign in
            </Link>
          </p>
          <button type="button" className="secondary-button" onClick={useDifferentEmail}>
            Use a different email address
          </button>
        </section>
      </>
    );
  }

  const pending = status === "pending";
  const invalidFields = FIELD_ORDER.filter((name) => fieldErrors[name]?.length);

  return (
    <>
      {live}
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
                  {FIELD_LABELS[name]}: {fieldErrors[name].join(" ")}
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
      <form onSubmit={onSubmit} noValidate className="card" aria-busy={pending}>
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
        <Field name="email" label="Email address" errors={fieldErrors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={values.email}
              onChange={(e) => setValue("email", e.target.value)}
            />
          )}
        </Field>
        <Field name="password" label="Password" errors={fieldErrors.password}>
          {(props) => (
            <div className="password-row">
              <input
                {...props}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={values.password}
                onChange={(e) => setValue("password", e.target.value)}
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
          )}
        </Field>
        <Field
          name="phone"
          label="Phone number"
          hint="Pakistani mobile like 0300 1234567, or an international number starting with +. Your phone number stays private and is never shown to other people."
          errors={fieldErrors.phone}
        >
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
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </>
  );
}

type InputProps = {
  id: string;
  name: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
};

function Field({
  name,
  label,
  hint,
  errors,
  children,
}: {
  name: FieldName;
  label: string;
  hint?: string;
  errors?: string[];
  children: (props: InputProps) => React.ReactNode;
}) {
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  const describedBy = [hint ? hintId : null, errors?.length ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={errorId} className="field-error">
          <span className="sr-only">Error: </span>
          {errors.join(" ")}
        </p>
      ) : null}
      {children({
        id: name,
        name,
        "aria-invalid": errors?.length ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
    </div>
  );
}

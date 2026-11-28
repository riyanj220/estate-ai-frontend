"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormErrors, focusFirstError } from "@/components/form-errors";
import {
  NETWORK_ERROR,
  REJECTED_ERROR,
  SERVER_ERROR,
  TIMEOUT_ERROR,
} from "@/lib/forms";
import { useSession } from "@/lib/session";

type FieldName = "email" | "password";
type Fields = Record<string, string[]>;

const FIELD_ORDER: FieldName[] = ["email", "password"];
// One message for every credential failure: wrong password, unknown email, deactivated and locked out look alike.
const STUCK_MESSAGE = "We could not open the next page. Please try again.";
const SAFETY_TIMEOUT_MS = 10_000;
const INVALID_CREDENTIALS = "The email or password is not correct.";

function isFieldName(key: string): key is FieldName {
  return (FIELD_ORDER as string[]).includes(key);
}

export function SignInForm({ target }: { target: string }) {
  const { signIn } = useSession();
  const router = useRouter();
  const [values, setValues] = useState<Record<FieldName, string>>({ email: "", password: "" });
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const submitting = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const [summaryTick, setSummaryTick] = useState(0);
  const [noticeTick, setNoticeTick] = useState(0);

  useEffect(() => {
    if (summaryTick > 0) focusFirstError(summaryRef.current);
  }, [summaryTick]);

  useEffect(() => {
    if (noticeTick > 0) noticeRef.current?.focus();
  }, [noticeTick]);

  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function release() {
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = null;
    submitting.current = false;
    setPending(false);
  }

  useEffect(() => {
    // Back from a restored (bfcache) page must not leave the form busy for ever.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) release();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  // Failures are announced by exactly one mechanism: the focused alert (or the field that takes focus).
  // The live region only carries progress.
  function showNotice(message: string) {
    setAnnouncement("");
    setNotice(message);
    setNoticeTick((tick) => tick + 1);
  }

  function setValue(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFieldErrors({});
    setFormErrors([]);
    setNotice("");
    setAnnouncement("Signing you in.");

    const email = values.email.trim();
    // Required fields are checked here so an empty form sends nothing; every other rule is the server's.
    const missing: Fields = {};
    if (!email) missing.email = ["Enter your email address."];
    if (!values.password) missing.password = ["Enter your password."];
    if (Object.keys(missing).length > 0) {
      release();
      setAnnouncement("");
      setFieldErrors(missing);
      setSummaryTick((tick) => tick + 1);
      return;
    }
    const result = await signIn(email, values.password);

    if (result.kind === "ok") {
      // Stay busy until the navigation replaces this page, so a second submit cannot happen; if the navigation
      // never happens, the safety timer frees the form again.
      setValues({ email: "", password: "" });
      setAnnouncement("Signed in.");
      safetyTimer.current = setTimeout(() => {
        release();
        showNotice(STUCK_MESSAGE);
      }, SAFETY_TIMEOUT_MS);
      router.replace(target);
      return;
    }

    release();
    setAnnouncement("");
    setValues((current) => ({ ...current, email, password: "" }));
    if (result.kind === "validation") {
      const fields: Fields = {};
      const general: string[] = [];
      for (const [key, messages] of Object.entries(result.fields)) {
        if (isFieldName(key) && messages.length > 0) fields[key] = messages;
        else general.push(...messages);
      }
      if (Object.keys(fields).length === 0 && general.length === 0) general.push(result.message);
      setFieldErrors(fields);
      setFormErrors(general);
      setSummaryTick((tick) => tick + 1);
    } else if (result.kind === "rate_limited") {
      showNotice(result.message);
    } else if (result.kind === "invalid_credentials") {
      showNotice(INVALID_CREDENTIALS);
    } else if (result.kind === "server") {
      showNotice(SERVER_ERROR);
    } else if (result.kind === "timeout") {
      showNotice(TIMEOUT_ERROR);
    } else if (result.kind === "network") {
      showNotice(NETWORK_ERROR);
    } else {
      showNotice(REJECTED_ERROR);
    }
  }

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <FormErrors ref={summaryRef} messages={formErrors} />
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="alert" className="notice" data-testid="form-notice">
          {notice}
        </p>
      )}
      <form method="post" onSubmit={onSubmit} noValidate className="card" aria-busy={pending}>
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
                autoComplete="current-password"
                required
                value={values.password}
                onChange={(e) => setValue("password", e.target.value)}
              />
              <button
                type="button"
                className="secondary-button"
                aria-controls="password"
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
            </div>
          )}
        </Field>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: "var(--space)" }}>
        <Link href="/forgot-password" className="text-link">
          Forgot your password?
        </Link>
      </p>
      <p className="muted">
        New here?{" "}
        <Link href="/register" className="text-link">
          Create an account
        </Link>
      </p>
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
  errors,
  children,
}: {
  name: FieldName;
  label: string;
  errors?: string[];
  children: (props: InputProps) => React.ReactNode;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
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
        "aria-describedby": errors?.length ? errorId : undefined,
      })}
    </div>
  );
}

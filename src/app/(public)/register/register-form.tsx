"use client";

import { useEffect, useRef, useState } from "react";
import { CheckYourEmail } from "@/components/auth/check-your-email";
import { FormErrors } from "@/components/ui/form-errors";
import { Field, PasswordField } from "@/components/ui/form-field";
import { getApi } from "@/lib/http/api";
import {
  NETWORK_ERROR,
  REJECTED_ERROR,
  SERVER_ERROR,
  rateLimitMessage,
  readErrorBody,
  withTimeout,
} from "@/lib/forms/forms";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";

type FieldName = "full_name" | "email" | "password" | "phone";
type Fields = Record<string, string[]>;
type Status = "idle" | "pending" | "success";

const FIELD_ORDER: FieldName[] = ["full_name", "email", "password", "phone"];

function isFieldName(key: string): key is FieldName {
  return (FIELD_ORDER as string[]).includes(key);
}

export function RegisterForm({ intro }: { intro: React.ReactNode }) {
  const [values, setValues] = useState<Record<FieldName, string>>({ full_name: "", email: "", password: "", phone: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const { announcement, setAnnouncement, resetAnnouncement, announce, notice, setNotice, showNotice, focusErrors, summaryRef, noticeRef } =
    useFormFeedback();
  const [submittedEmail, setSubmittedEmail] = useState("");
  const submitting = useRef(false);
  const successRef = useRef<HTMLHeadingElement>(null);
  const focusEmail = useRef(false);

  useEffect(() => {
    if (status === "idle" && focusEmail.current) {
      focusEmail.current = false;
      document.getElementById("email")?.focus();
    }
  }, [status]);

  function useDifferentEmail() {
    setValues((current) => ({ ...current, email: "", password: "" }));
    setSubmittedEmail("");
    resetAnnouncement();
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
    resetAnnouncement();
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

      if (response.status === 202) {
        setSubmittedEmail(email);
        setValues((current) => ({ ...current, email, password: "", phone: "" }));
        setStatus("success");
        announce("Check your email. We have sent the next steps.");
        return;
      }

      setStatus("idle");
      const body = response.status === 400 ? readErrorBody(error, true) : null;
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
        focusErrors();
        announce("Check the highlighted fields.");
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
        <CheckYourEmail email={submittedEmail} headingRef={successRef} onUseDifferent={useDifferentEmail} />
      </>
    );
  }

  const pending = status === "pending";

  return (
    <>
      {intro}
      {live}
      <FormErrors ref={summaryRef} messages={formErrors} />
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="alert" className="notice" data-testid="form-notice">
          {notice}
        </p>
      )}
      <form method="post" onSubmit={onSubmit} noValidate className="card" aria-busy={pending}>
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
        <PasswordField
          value={values.password}
          onChange={(value) => setValue("password", value)}
          errors={fieldErrors.password}
        />
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

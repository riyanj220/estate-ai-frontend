"use client";

import { useEffect, useRef, useState } from "react";
import { CheckYourEmail } from "@/components/auth/check-your-email";
import { FormErrors } from "@/components/ui/form-errors";
import { CityField } from "@/components/reference/city-field";
import { Field, PasswordField } from "@/components/ui/form-field";
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
import { mapFieldMessages } from "@/lib/forms/password-messages";
import { AGENCY_FIELD_MESSAGES, GENERAL_FIELD_MESSAGES } from "@/lib/forms/registration-messages";
import { cityRequiredMessage, useCities } from "@/lib/reference/use-cities";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";

type FieldName = "agency_name" | "email" | "phone" | "office_address" | "city_id" | "password";
type Fields = Record<string, string[]>;
type Status = "idle" | "pending" | "success";

const FIELD_ORDER: FieldName[] = ["agency_name", "email", "phone", "office_address", "city_id", "password"];
const ADDRESS_MAX_LENGTH = 300; // the server limit
const SIGNED_IN = "You are already signed in. Sign out to register another account.";

function isFieldName(key: string): key is FieldName {
  return (FIELD_ORDER as string[]).includes(key);
}

const EMPTY: Record<FieldName, string> = {
  agency_name: "",
  email: "",
  phone: "",
  office_address: "",
  city_id: "",
  password: "",
};

export function AgencyRegisterForm() {
  const [values, setValues] = useState<Record<FieldName, string>>(EMPTY);
  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const { announcement, setAnnouncement, resetAnnouncement, announce, notice, setNotice, showNotice, focusErrors, summaryRef, noticeRef } =
    useFormFeedback();
  const { cities, reload } = useCities({
    announce,
    // A choice that is no longer in a freshly loaded list is dropped.
    onLoaded: (items) =>
      setValues((current) =>
        current.city_id !== "" && !items.some((city) => city.id === current.city_id) ? { ...current, city_id: "" } : current,
      ),
  });
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

  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  function setValue(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function useDifferentEmail() {
    setValues((current) => ({ ...current, email: "", password: "" }));
    setSubmittedEmail("");
    resetAnnouncement();
    focusEmail.current = true;
    setStatus("idle");
  }

  // Required checks only: the server owns every other rule.
  function requiredErrors(): Fields {
    const errors: Fields = {};
    for (const name of FIELD_ORDER) {
      const empty = name === "password" ? values.password === "" : values[name].trim() === "";
      if (!empty) continue;
      errors[name] = [name === "city_id" ? cityRequiredMessage(cities, AGENCY_FIELD_MESSAGES.city_id.required) : AGENCY_FIELD_MESSAGES[name].required];
    }
    return errors;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setNotice("");
    const missing = requiredErrors();
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setFormErrors([]);
      focusErrors();
      announce("Check the highlighted fields.");
      return;
    }
    submitting.current = true;
    setStatus("pending");
    setFieldErrors({});
    setFormErrors([]);
    resetAnnouncement();
    setAnnouncement("Creating your agency account.");

    const email = values.email.trim();
    try {
      const api = await getApi();
      const { error, response } = await withTimeout((signal) =>
        api.POST("/api/v1/registrations/agencies", {
          body: {
            agency_name: values.agency_name,
            email,
            phone: values.phone,
            office_address: values.office_address,
            city_id: values.city_id,
            password: values.password,
          },
          signal,
        }),
      );

      if (response.status === 202) {
        setSubmittedEmail(email);
        setValues((current) => ({ ...current, email, password: "" }));
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
          if (messages.length === 0) continue;
          // The email field only ever shows known codes, so no server sentence can hint at an existing address.
          if (key === "email") {
            const known = AGENCY_FIELD_MESSAGES.email;
            fields.email = [...new Set(messages.map((message) => known[message] ?? known.invalid_email))];
          } else if (isFieldName(key)) fields[key] = mapFieldMessages(messages, AGENCY_FIELD_MESSAGES[key]);
          else general.push(...mapFieldMessages(messages, GENERAL_FIELD_MESSAGES));
        }
        if (Object.keys(fields).length === 0 && general.length === 0) general.push(body.message);
        // The likely cause is a city deactivated since the page loaded, so drop the choice and reload the list.
        const cityGone = body.fields.city_id?.includes("invalid_city") ?? false;
        setValues((current) => ({ ...current, password: "", city_id: cityGone ? "" : current.city_id }));
        if (cityGone) reload("select", "The city list was refreshed. Select a city.");
        setFieldErrors(fields);
        setFormErrors(general);
        focusErrors();
        announce("Check the highlighted fields.");
      } else if (response.status === 429) {
        showNotice(rateLimitMessage(response.headers.get("Retry-After")));
      } else if (response.status === 403) {
        showNotice(SIGNED_IN);
      } else if (response.status >= 500) {
        showNotice(SERVER_ERROR);
      } else {
        showNotice(REJECTED_ERROR);
      }
    } catch (error) {
      setStatus("idle");
      showNotice(isTimeoutError(error) ? TIMEOUT_ERROR : NETWORK_ERROR);
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
      {live}
      <FormErrors ref={summaryRef} messages={formErrors} />
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="alert" className="notice" data-testid="form-notice">
          {notice}
        </p>
      )}
      <form method="post" onSubmit={onSubmit} noValidate className="card" aria-busy={pending}>
        <Field name="agency_name" label="Agency name" hint="Shown publicly." errors={fieldErrors.agency_name}>
          {(props) => (
            <input
              {...props}
              type="text"
              autoComplete="organization"
              required
              value={values.agency_name}
              onChange={(e) => setValue("agency_name", e.target.value)}
            />
          )}
        </Field>
        <Field name="email" label="Business email" errors={fieldErrors.email}>
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
        <Field
          name="phone"
          label="Business phone"
          hint="Pakistani mobile like 0300 1234567, or an international number starting with +. The phone number stays private and is never shown to other people."
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
        <Field
          name="office_address"
          label="Office address"
          hint="The office address stays private and is never shown to other people."
          errors={fieldErrors.office_address}
        >
          {(props) => (
            <textarea
              {...props}
              autoComplete="street-address"
              required
              rows={3}
              maxLength={ADDRESS_MAX_LENGTH}
              value={values.office_address}
              onChange={(e) => setValue("office_address", e.target.value.replace(/[\r\n\t]+/g, " "))}
            />
          )}
        </Field>
        <CityField
          cities={cities}
          value={values.city_id}
          onChange={(value) => setValue("city_id", value)}
          errors={fieldErrors.city_id}
          onRetry={() => reload("retry", "Cities loaded. Select a city.")}
        />
        <PasswordField
          value={values.password}
          onChange={(value) => setValue("password", value)}
          errors={fieldErrors.password}
        />
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Creating account…" : "Create agency account"}
        </button>
      </form>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CheckYourEmail } from "@/components/check-your-email";
import { ErrorSummary } from "@/components/error-summary";
import { Field, PasswordField } from "@/components/form-field";
import { getApi } from "@/lib/api";
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
import { mapFieldMessages } from "@/lib/password-messages";
import { AGENCY_FIELD_MESSAGES, GENERAL_FIELD_MESSAGES } from "@/lib/registration-messages";
import { useFormFeedback } from "@/lib/use-form-feedback";

type FieldName = "agency_name" | "email" | "phone" | "office_address" | "city_id" | "password";
type Fields = Record<string, string[]>;
type Status = "idle" | "pending" | "success";
type City = { id: string; name: string };
// `result` is null until the first load completes; `loading` is true during any load.
type Cities = { loading: boolean; result: "ready" | "error" | "empty" | null; items: City[] };
type CityResult = { result: "ready" | "error" | "empty"; items: City[] };

// The order of the form, and so of the summary.
const FIELD_ORDER: FieldName[] = ["agency_name", "email", "phone", "office_address", "city_id", "password"];
const FIELD_LABELS: Record<FieldName, string> = {
  agency_name: "Agency name",
  email: "Business email",
  phone: "Business phone",
  office_address: "Office address",
  city_id: "City",
  password: "Password",
};
const ADDRESS_MAX_LENGTH = 300; // the server limit
const NO_CITIES = "No cities are available right now.";
const CITIES_ERROR = "We could not load the list of cities.";
const CITIES_ERROR_REQUIRED = "Cities could not be loaded. Retry above.";
const CITIES_LOADING_REQUIRED = "Cities are still loading. Try again in a moment.";
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
  const [cities, setCities] = useState<Cities>({ loading: true, result: null, items: [] });
  const { announcement, setAnnouncement, resetAnnouncement, announce, notice, setNotice, showNotice, focusSummary, summaryRef, noticeRef } =
    useFormFeedback();
  const [submittedEmail, setSubmittedEmail] = useState("");
  const submitting = useRef(false);
  const successRef = useRef<HTMLHeadingElement>(null);
  const focusEmail = useRef(false);
  const citiesRequest = useRef(0);
  const pendingFocus = useRef<"retry" | "select" | null>(null);

  const hasErrors = formErrors.length > 0 || Object.keys(fieldErrors).length > 0;

  // Keeps only well-formed, unique cities; a 200 with items that are all malformed is a failed load.
  function readCities(data: unknown): CityResult {
    const raw = typeof data === "object" && data !== null ? (data as { items?: unknown }).items : undefined;
    if (!Array.isArray(raw)) return { result: "error", items: [] };
    if (raw.length === 0) return { result: "empty", items: [] };
    const seen = new Set<string>();
    const items: City[] = [];
    for (const item of raw) {
      const { id, name } = (typeof item === "object" && item !== null ? item : {}) as { id?: unknown; name?: unknown };
      if (typeof id !== "string" || id === "" || typeof name !== "string" || name.trim() === "" || seen.has(id)) continue;
      seen.add(id);
      items.push({ id, name });
    }
    return items.length > 0 ? { result: "ready", items } : { result: "error", items: [] };
  }

  async function requestCities(): Promise<CityResult> {
    try {
      const api = await getApi();
      const { data, response } = await withTimeout((signal) => api.GET("/api/v1/reference/cities", { signal }));
      return response.ok ? readCities(data) : { result: "error", items: [] };
    } catch {
      return { result: "error", items: [] };
    }
  }

  // Only the latest request may set the state, so a slow earlier answer cannot overwrite a newer one.
  function applyCities(ticket: number, next: CityResult, readyMessage?: string) {
    if (ticket !== citiesRequest.current) return;
    // A failed load keeps the previous list; any other answer replaces it and drops a choice that is no longer in it.
    setCities((current) => ({ loading: false, result: next.result, items: next.result === "error" ? current.items : next.items }));
    if (next.result !== "error") {
      setValues((current) =>
        current.city_id !== "" && !next.items.some((city) => city.id === current.city_id) ? { ...current, city_id: "" } : current,
      );
    }
    if (next.result === "error") announce(CITIES_ERROR);
    else if (next.result === "empty") announce(NO_CITIES);
    else if (readyMessage) announce(readyMessage);
  }

  function reloadCities(focus: "retry" | "select", readyMessage: string) {
    pendingFocus.current = focus;
    setCities((current) => ({ ...current, loading: true }));
    announce("Loading cities.");
    const ticket = ++citiesRequest.current;
    void requestCities().then((next) => applyCities(ticket, next, readyMessage));
  }

  useEffect(() => {
    const ticket = ++citiesRequest.current;
    void requestCities().then((next) => applyCities(ticket, next));
    // Runs once on mount; the functions use only state setters and refs, so the first render's copies are fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After a reload the focused Retry button may be gone, so focus moves to the select (or stays on Retry on failure).
  useEffect(() => {
    if (cities.loading || !pendingFocus.current) return;
    const target = pendingFocus.current === "retry" && cities.result === "error" ? "city-retry" : "city_id";
    pendingFocus.current = null;
    document.getElementById(target)?.focus();
  }, [cities]);

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

  function cityRequiredMessage() {
    if (cities.result === "error") return CITIES_ERROR_REQUIRED;
    if (cities.result === "empty") return NO_CITIES;
    if (cities.result === null) return CITIES_LOADING_REQUIRED;
    return AGENCY_FIELD_MESSAGES.city_id.required;
  }

  // Required checks only: the server owns every other rule.
  function requiredErrors(): Fields {
    const errors: Fields = {};
    for (const name of FIELD_ORDER) {
      const empty = name === "password" ? values.password === "" : values[name].trim() === "";
      if (!empty) continue;
      errors[name] = [name === "city_id" ? cityRequiredMessage() : AGENCY_FIELD_MESSAGES[name].required];
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
      focusSummary();
      announce("The form has errors. Review the list at the top of the page.");
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
        if (cityGone) reloadCities("select", "The city list was refreshed. Select a city.");
        setFieldErrors(fields);
        setFormErrors(general);
        focusSummary();
        announce("The form has errors. Review the list at the top of the page.");
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
  const initialLoad = cities.loading && cities.result === null;
  const reloading = cities.loading && cities.result !== null;
  const cityDescribedBy = ["city-status", fieldErrors.city_id?.length ? "city_id-error" : null].filter(Boolean);
  // The select is the right target unless it is disabled (first load) or the list failed (the Retry button is).
  const cityTarget = initialLoad ? "city-status" : cities.result === "error" ? "city-retry" : "city_id";

  return (
    <>
      {live}
      {hasErrors && (
        <ErrorSummary
          ref={summaryRef}
          order={FIELD_ORDER}
          labels={FIELD_LABELS}
          fieldErrors={fieldErrors}
          formErrors={formErrors}
          targets={{ city_id: cityTarget }}
        />
      )}
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
        <Field name="city_id" label="City" errors={fieldErrors.city_id}>
          {(props) => (
            <>
              {/* Always mounted so a focused Retry button never disappears; announcements use the form's live region. */}
              <p id="city-status" tabIndex={-1} className="hint">
                {cities.result === "error" && (
                  <>
                    {CITIES_ERROR}{" "}
                    <button
                      type="button"
                      id="city-retry"
                      className="secondary-button"
                      aria-disabled={reloading}
                      onClick={() => {
                        if (!reloading) reloadCities("retry", "Cities loaded. Select a city.");
                      }}
                    >
                      Retry
                    </button>
                  </>
                )}
                {cities.result === "empty" && NO_CITIES}
              </p>
              <select
                {...props}
                aria-describedby={cityDescribedBy.join(" ") || undefined}
                required
                disabled={initialLoad}
                value={values.city_id}
                onChange={(e) => setValue("city_id", e.target.value)}
              >
                {initialLoad ? (
                  <option value="">Loading cities</option>
                ) : (
                  <>
                    <option value="" disabled>
                      Select a city
                    </option>
                    {cities.items.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </>
          )}
        </Field>
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

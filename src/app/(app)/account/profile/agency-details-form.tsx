"use client";

import { useEffect, useRef, useState } from "react";
import { CityField } from "@/components/reference/city-field";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Field } from "@/components/ui/form-field";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { REJECTED_ERROR, readErrorBody, withTimeout } from "@/lib/forms/forms";
import { markProfileSaving } from "@/lib/listing/image-lock";
import { SAVE_PAUSED, SAVE_WAIT } from "@/lib/listing/listing-messages";
import { mapKnownCodes } from "@/lib/forms/password-messages";
import { AGENCY_PROFILE_MESSAGES, GENERAL_FIELD_MESSAGES } from "@/lib/forms/registration-messages";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { useSession } from "@/lib/auth/session";
import { cityFocusTarget, cityRequiredMessage, useCities } from "@/lib/reference/use-cities";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";
import type { AgencyProfile } from "./agency-profile-client";

type FieldName = "agency_name" | "description" | "city_id" | "business_phone" | "office_address";
type Values = Record<FieldName, string>;
type Fields = Record<string, string[]>;

// The order of the form, and so of the summary.
const FIELD_ORDER: FieldName[] = ["agency_name", "description", "city_id", "business_phone", "office_address"];
const REQUIRED: FieldName[] = ["agency_name", "city_id", "business_phone", "office_address"];
const FIELD_LABELS: Record<FieldName, string> = {
  agency_name: "Agency name",
  description: "Description",
  city_id: "City",
  business_phone: "Business phone",
  office_address: "Office address",
};
const DESCRIPTION_MAX_LENGTH = 1000; // the server limits
const DESCRIPTION_OVER = "That is over the limit. Shorten it before saving.";
const CITY_DROPPED = "Your selected city is no longer available. Select a city.";
const ADDRESS_MAX_LENGTH = 300;
const SAVED = "Your business profile was saved.";
const NO_CHANGES = "No changes to save.";
const SAVED_RELOAD =
  "Your business profile was saved. We could not read the updated values back; reload the page to see them.";

/** The characters the server counts: whitespace collapsed to single spaces, trimmed, counted by code point. */
function descriptionLength(value: string): number {
  return Array.from(value.replace(/\s+/g, " ").trim()).length;
}

// Strict on purpose: the OpenAPI schema declares these five fields as strings, never null, so a null or missing value
// is an unreadable answer rather than an empty field.
function readValues(data: unknown): Values | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const out = {} as Values;
  for (const name of FIELD_ORDER) {
    const value = record[name];
    if (typeof value !== "string") return null;
    out[name] = value;
  }
  return out;
}

function isFieldName(key: string): key is FieldName {
  return (FIELD_ORDER as string[]).includes(key);
}

function pick(profile: AgencyProfile): Values {
  return {
    agency_name: profile.agency_name,
    description: profile.description,
    city_id: profile.city_id,
    business_phone: profile.business_phone,
    office_address: profile.office_address,
  };
}

/** Name, description, city, phone and address. Only the fields that changed are sent; every rule other than "required" is the server's. */
export function AgencyDetailsForm({
  initial,
  onSessionGone,
  onSaved,
  imageBusy,
  onPendingChange,
}: {
  initial: AgencyProfile;
  onSessionGone: () => Promise<void>;
  /** Asks the page to re-read the profile quietly (used when the save answer could not be read). */
  onSaved: () => void;
  /** The picture or logo is being changed: Save waits. */
  imageBusy: boolean;
  /** Tells the page whether a save is in flight (the picture or logo actions wait meanwhile). */
  onPendingChange: (pending: boolean) => void;
}) {
  const { refresh } = useSession();
  // The values the server last confirmed: the baseline for "what changed".
  const [saved, setSaved] = useState<Values>(() => pick(initial));
  const [values, setValues] = useState<Values>(saved);
  // Set when a save succeeded but its answer could not be read: `saved` is then not trusted for those fields (the next
  // submit sends every edited field again) until a re-read reconciles. Holds the values that were submitted.
  const [unverified, setUnverified] = useState<Values | null>(null);
  const [seen, setSeen] = useState(initial);
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<"" | "saved" | "unchanged" | "reload">("");
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const { announcement, setAnnouncement, resetAnnouncement, announce, notice, setNotice, showNotice, focusSummary, summaryRef, noticeRef } =
    useFormFeedback();
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  });
  const { cities, reload } = useCities({
    announce,
    // A freshly loaded list drops a choice that is not in it, except the stored city (kept as "Current city").
    onLoaded: (items) => {
      const chosen = valuesRef.current.city_id;
      if (chosen === "" || chosen === saved.city_id || items.some((city) => city.id === chosen)) return;
      setValues((current) => (current.city_id === chosen ? { ...current, city_id: "" } : current));
      announce(CITY_DROPPED);
    },
  });
  const submitting = useRef(false);
  // The save lock is set in the submit itself (not through a render); leaving the page drops it.
  useEffect(
    () => () => {
      markProfileSaving(false);
      onPendingChange(false);
    },
    [onPendingChange],
  );
  const unchangedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(unchangedTimer.current), []);

  // A re-read (focus, visibility, after a save whose answer was unreadable) hands this form a new `initial`: the
  // baseline moves to the server's values, and so does every field the person has not touched since the last
  // baseline. Fields they edited keep their text.
  if (initial !== seen) {
    setSeen(initial);
    const server = pick(initial);
    const next = { ...values };
    for (const name of FIELD_ORDER) {
      if (values[name] === saved[name] || (unverified !== null && values[name] === unverified[name])) next[name] = server[name];
    }
    setValues(next);
    setSaved(server);
    setUnverified(null);
  }

  const hasErrors = formErrors.length > 0 || Object.keys(fieldErrors).length > 0;

  function setValue(name: FieldName, value: string) {
    clearTimeout(unchangedTimer.current);
    setValues((current) => ({ ...current, [name]: value }));
    setInfo("");
    // Editing a field answers its error.
    setFieldErrors((current) => {
      if (!(name in current)) return current;
      const rest = { ...current };
      delete rest[name];
      return rest;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (imageBusy) {
      announce(SAVE_WAIT);
      return;
    }
    clearTimeout(unchangedTimer.current);
    setInfo("");
    setNotice("");
    // Required fields are checked here so a blank field sends nothing; every other rule is the server's.
    const missing: Fields = {};
    for (const name of REQUIRED) {
      if (values[name].trim() !== "") continue;
      missing[name] = [
        name === "city_id" ? cityRequiredMessage(cities, AGENCY_PROFILE_MESSAGES.city_id.required) : AGENCY_PROFILE_MESSAGES[name].required,
      ];
    }
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setFormErrors([]);
      focusSummary();
      announce("The form has errors. Review the list at the top of the page.");
      return;
    }
    // What this submit sends; later typing is compared against `submitted` so it is never overwritten by the answer.
    const submitted: Values = { ...values };
    const trimmed = Object.fromEntries(FIELD_ORDER.map((name) => [name, values[name].trim()])) as Values;
    const body: Partial<Values> = {};
    for (const name of FIELD_ORDER) if (trimmed[name] !== saved[name]) body[name] = trimmed[name];
    setFieldErrors({});
    setFormErrors([]);
    if (Object.keys(body).length === 0) {
      resetAnnouncement();
      setValues(trimmed); // a trim-only difference must not stay in the field next to "No changes to save."
      // Cleared first, set a moment later, so pressing Save again re-announces the same text.
      unchangedTimer.current = setTimeout(() => setInfo("unchanged"), 50);
      return;
    }
    submitting.current = true;
    markProfileSaving(true);
    onPendingChange(true);
    setPending(true);
    resetAnnouncement();
    setAnnouncement("Saving your business profile.");
    try {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) => api.PATCH("/api/v1/me/agency-profile", { body, headers: { "X-CSRFToken": csrf }, signal })),
      );
      if (response.ok) {
        const next = readValues(data);
        resetAnnouncement();
        // Only fields the person has not touched since submitting take the answer's value.
        const merge = (answer: Values) =>
          setValues((current) => {
            const out = { ...current };
            for (const name of FIELD_ORDER) if (current[name] === submitted[name]) out[name] = answer[name];
            return out;
          });
        if (next) {
          setSaved(next);
          setUnverified(null);
          merge(next);
          setInfo("saved");
        } else {
          // A success whose body cannot be read: the save happened, so say so politely and re-read instead of failing.
          // The baseline is not set from what this client sent (the server may have normalised it): the re-read
          // reconciles it, and until then the next submit sends every edited field again.
          setUnverified(submitted);
          setInfo("reload");
          onSaved();
        }
        refresh().catch(() => undefined); // the header agency name comes from the session provider
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
          if (isFieldName(key)) fields[key] = mapKnownCodes(messages, AGENCY_PROFILE_MESSAGES[key]);
          else general.push(...mapKnownCodes(messages, GENERAL_FIELD_MESSAGES, REJECTED_ERROR));
        }
        if (Object.keys(fields).length === 0 && general.length === 0) general.push(REJECTED_ERROR);
        general.splice(0, general.length, ...new Set(general));
        // The likely cause is a city deactivated since the page loaded, so drop the choice and reload the list.
        const cityGone = parsed.fields.city_id?.includes("invalid_city") ?? false;
        if (cityGone) {
          setValues((current) => ({ ...current, city_id: "" }));
          reload("select", "The city list was refreshed. Select a city.");
        }
        setFieldErrors(fields);
        setFormErrors(general);
        focusSummary();
        announce("The form has errors. Review the list at the top of the page.");
        return;
      }
      // A 403 that survives the one CSRF retry (a real permission refusal included) is generic on purpose. A CSRF
      // rejection happens before the backend service runs, so the retry in `withCsrf` cannot double-count anything.
      showNotice(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (error) {
      showNotice(thrownMessage(error));
    } finally {
      submitting.current = false;
      markProfileSaving(false);
      onPendingChange(false);
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="details-title" className="card" style={{ marginBottom: "var(--space)" }}>
      <h2 id="details-title" tabIndex={-1} className="section-title">
        Business details
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
          targets={{ city_id: cityFocusTarget(cities) }}
        />
      )}
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="alert" className="notice" data-testid="details-notice">
          {notice}
        </p>
      )}
      <p className="muted" data-testid="privacy-note">
        Your business phone and office address are private. Only your agency name, description and city are shown publicly.
      </p>
      <form method="post" onSubmit={onSubmit} noValidate aria-busy={pending}>
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
        <Field
          name="description"
          label="Description (optional)"
          hint="Shown publicly. Do not include phone numbers, email addresses or street addresses."
          errors={fieldErrors.description}
        >
          {(props) => (
            <>
              <textarea
                {...props}
                aria-describedby={[props["aria-describedby"], "description-count"].filter(Boolean).join(" ")}
                rows={4}
                value={values.description}
                onChange={(e) => setValue("description", e.target.value)}
              />
              {/* Plain text, not a live region: it must not be announced on every keystroke. */}
              <p id="description-count" className="hint" data-testid="description-count">
                {descriptionLength(values.description)} of {DESCRIPTION_MAX_LENGTH} characters
                {descriptionLength(values.description) > DESCRIPTION_MAX_LENGTH && ` ${DESCRIPTION_OVER}`}
              </p>
            </>
          )}
        </Field>
        <CityField
          cities={cities}
          value={values.city_id}
          onChange={(value) => setValue("city_id", value)}
          errors={fieldErrors.city_id}
          onRetry={() => reload("retry", "Cities loaded. Select a city.")}
          current={saved.city_id}
        />
        <Field name="business_phone" label="Business phone" hint="Private: only you see it." errors={fieldErrors.business_phone}>
          {(props) => (
            <input
              {...props}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              value={values.business_phone}
              onChange={(e) => setValue("business_phone", e.target.value)}
            />
          )}
        </Field>
        <Field name="office_address" label="Office address" hint="Private: only you see it." errors={fieldErrors.office_address}>
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
        {imageBusy && (
          <p id="save-paused" className="hint" data-testid="save-paused">
            {SAVE_PAUSED}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={pending} aria-disabled={imageBusy ? true : undefined} aria-describedby={imageBusy ? "save-paused" : undefined}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </section>
  );
}

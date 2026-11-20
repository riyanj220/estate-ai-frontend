"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { ErrorSummary } from "@/components/error-summary";
import { Field } from "@/components/form-field";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { REJECTED_ERROR, readErrorBody, withTimeout } from "@/lib/forms";
import { label } from "@/lib/listing-labels";
import {
  CREATE_FORBIDDEN,
  DRAFT_CAP,
  LISTINGS_PATH,
  LISTING_FIELD_MESSAGES,
  NEW_LISTING_PATH,
  signInPathFor,
} from "@/lib/listing-messages";
import { mapKnownCodes } from "@/lib/password-messages";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useSession } from "@/lib/session";
import { useFormFeedback } from "@/lib/use-form-feedback";
import { usePageshowRecheck } from "@/lib/use-pageshow-recheck";
import { useRegistry, type Registry } from "@/lib/use-registry";

type FieldName = "purpose" | "category" | "subtype";
type Values = Record<FieldName, string>;
type Fields = Record<string, string[]>;
type Notice = { text: string; link: boolean };

const FIELD_ORDER: FieldName[] = ["purpose", "category", "subtype"];
const FIELD_LABELS: Record<string, string> = { purpose: "Purpose", category: "Category", subtype: "Subtype" };
const HEADING_ID = "create-listing-title";
const SIGN_IN_PATH = signInPathFor(NEW_LISTING_PATH, false);
/** How long the Draft page may take to open before the person is pointed at My listings instead. */
const NAVIGATION_TIMEOUT_MS = 8000;
const NOT_OPENED = "Your draft was created, but we could not open it. Check My listings.";

const isFieldName = (key: string): key is FieldName => (FIELD_ORDER as string[]).includes(key);

/** Keeps only the choices a registry still offers (a stale registry is the likely cause of a refused choice). */
function sanitize(values: Values, registry: Registry): Values {
  const purpose = registry.purposes.includes(values.purpose) ? values.purpose : "";
  const category = registry.categories.includes(values.category) ? values.category : "";
  const subtype = category && registry.subtypesOf(category).includes(values.subtype) ? values.subtype : "";
  return { purpose, category, subtype };
}

/**
 * The "Create listing" form (manual path only). Purpose, Category and Subtype are rendered from the registry
 * (`useRegistry`); the form owns no taxonomy. Only "required" is checked here, every other rule is the server's.
 * After a Draft is created the form never accepts another submit: it opens the Draft page (or points at My listings).
 */
export function CreateListingForm() {
  const router = useRouter();
  const { refresh, account } = useSession();
  const { status, registry, retry, retrying, refetch } = useRegistry(SIGN_IN_PATH);
  const [values, setValues] = useState<Values>({ purpose: "", category: "", subtype: "" });
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState<"created" | "unopened" | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const [noticeTick, setNoticeTick] = useState(0);
  const { announcement, setAnnouncement, resetAnnouncement, announce, focusSummary, summaryRef, noticeRef } = useFormFeedback();
  const submitting = useRef(false);
  const lockedRef = useRef(false);
  const retried = useRef(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(navTimer.current), []);

  // The notice is the one live region while it shows (role="alert"): it takes focus and nothing else announces it.
  useEffect(() => {
    if (noticeTick > 0) noticeRef.current?.focus();
  }, [noticeTick, noticeRef]);
  function showNotice(next: Notice) {
    resetAnnouncement();
    setNoticeState(next);
    setNoticeTick((tick) => tick + 1);
  }

  // After a Retry succeeds the Retry button is gone: move focus to the heading.
  useEffect(() => {
    if (status === "error" && retrying) retried.current = true;
    if (status === "ready" && retried.current) {
      retried.current = false;
      document.getElementById(HEADING_ID)?.focus();
    }
  }, [status, retrying]);

  // A page restored from the back-forward cache must not stay frozen in a busy or created state.
  usePageshowRecheck(SIGN_IN_PATH, () => {
    clearTimeout(navTimer.current);
    submitting.current = false;
    lockedRef.current = false;
    setPending(false);
    setLocked(null);
    setNoticeState(null);
    resetAnnouncement();
  });

  const hasErrors = formErrors.length > 0 || Object.keys(fieldErrors).length > 0;
  const subtypes = registry && values.category ? registry.subtypesOf(values.category) : [];

  function clearErrors(...names: FieldName[]) {
    setFieldErrors((current) => {
      if (!names.some((name) => current[name])) return current;
      const next = { ...current };
      for (const name of names) delete next[name];
      return next;
    });
  }

  function setValue(name: FieldName, value: string) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      // Changing the Category clears a Subtype that does not belong to the new one (a Subtype it also lists is kept).
      if (name === "category" && registry && !registry.subtypesOf(value).includes(current.subtype)) next.subtype = "";
      return next;
    });
    clearErrors(...(name === "category" ? (["category", "subtype"] as FieldName[]) : [name]));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || lockedRef.current) return;
    setNoticeState(null);
    // Required fields are checked here so a missing choice sends nothing; every other rule is the server's.
    const missing: Fields = {};
    for (const name of FIELD_ORDER) if (values[name] === "") missing[name] = [LISTING_FIELD_MESSAGES[name].required];
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setFormErrors([]);
      focusSummary();
      announce("The form has errors. Review the list at the top of the page.");
      return;
    }
    setFieldErrors({});
    setFormErrors([]);
    submitting.current = true;
    setPending(true);
    resetAnnouncement();
    setAnnouncement("Creating your draft.");
    // Exactly the three fields this form owns; the server decides the owner, status and revision.
    const body = { purpose: values.purpose, category: values.category, subtype: values.subtype } as components["schemas"]["DraftCreateRequest"];
    let done = false;
    try {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) => api.POST("/api/v1/listings", { body, headers: { "X-CSRFToken": csrf }, signal })),
      );
      if (response.status === 201) {
        // The Draft exists: this form never submits again.
        done = true;
        lockedRef.current = true;
        const id = typeof data === "object" && data !== null ? (data as { id?: unknown }).id : undefined;
        if (typeof id === "string" && id) {
          setLocked("created");
          setAnnouncement("Draft created. Opening it.");
          router.push(`${LISTINGS_PATH}/${encodeURIComponent(id)}`);
          // If the Draft page does not open in time, point at My listings instead of freezing.
          navTimer.current = setTimeout(() => {
            if (window.location.pathname !== NEW_LISTING_PATH) return;
            setLocked("unopened");
            showNotice({ text: NOT_OPENED, link: true });
          }, NAVIGATION_TIMEOUT_MS);
          return;
        }
        // A success whose body cannot be read: do not guess where the Draft is.
        setLocked("unopened");
        showNotice({ text: NOT_OPENED, link: true });
        return;
      }
      if (response.status === 401) {
        done = true;
        await refresh();
        router.replace(SIGN_IN_PATH);
        return;
      }
      const parsed = response.status === 400 ? readErrorBody(error) : null;
      if (parsed) {
        const fields: Fields = {};
        const general: string[] = [];
        let stale = false;
        for (const [key, messages] of Object.entries(parsed.fields)) {
          if (messages.length === 0) continue;
          if (messages.some((code) => code === "invalid_choice" || code === "subtype_not_in_category")) stale = true;
          // Known codes only: any other sentence or key is generic, never the server's text.
          if (isFieldName(key)) fields[key] = mapKnownCodes(messages, LISTING_FIELD_MESSAGES[key]);
          else general.push(...mapKnownCodes(messages, {}, REJECTED_ERROR));
        }
        if (Object.keys(fields).length === 0 && general.length === 0) general.push(REJECTED_ERROR);
        general.splice(0, general.length, ...new Set(general));
        resetAnnouncement();
        setFieldErrors(fields);
        setFormErrors(general);
        focusSummary();
        announce("The form has errors. Review the list at the top of the page.");
        // A refused choice may mean the registry changed since this page loaded: read it again once, keep what is still valid.
        if (stale) void refetch().then((next) => next && setValues((current) => sanitize(current, next)));
        return;
      }
      const code = response.status === 429 ? readErrorBody(error)?.code : undefined;
      if (response.status === 403) {
        // A CSRF rejection and a Suspended account both answer 403 `forbidden`, so the session decides: only a Suspended
        // account is told so; every other persistent 403 (after the one CSRF retry) is the generic message.
        showNotice({ text: account?.state === "suspended" ? CREATE_FORBIDDEN : failureMessage(403, null), link: false });
      } else if (response.status === 429 && code === "throttled" && !response.headers.get("Retry-After")) {
        // The open-Draft cap answers a throttled 429 without Retry-After.
        showNotice({ text: DRAFT_CAP, link: true });
      } else {
        showNotice({ text: failureMessage(response.status, response.headers.get("Retry-After")), link: false });
      }
    } catch (error) {
      showNotice({ text: thrownMessage(error), link: false });
    } finally {
      if (!done) submitting.current = false;
      setPending(false); // after a created Draft the form stays locked, not busy
    }
  }

  const heading = (
    <h1 id={HEADING_ID} tabIndex={-1} className="page-title">
      Create listing
    </h1>
  );

  if (status !== "ready") {
    return (
      <>
        {heading}
        {status === "loading" ? (
          <p role="status" className="muted" data-testid="registry-loading">
            Loading the listing choices…
          </p>
        ) : (
          <section className="card" aria-labelledby="registry-error-title" data-testid="registry-error">
            <h2 id="registry-error-title" className="section-title">
              We could not load the listing choices
            </h2>
            <p className="muted">Check your connection and try again.</p>
            <p role="status" className={retrying ? "muted" : "sr-only"}>
              {retrying ? "Retrying…" : ""}
            </p>
            <button type="button" className="primary-button" aria-disabled={retrying ? true : undefined} onClick={retry}>
              Retry
            </button>
          </section>
        )}
      </>
    );
  }

  const purposeErrors = fieldErrors.purpose;
  const purposeDescribedBy = purposeErrors?.length ? "purpose-error" : undefined;
  const busy = pending || locked !== null;
  return (
    <>
      {heading}
      <p className="muted" data-testid="create-note">
        You are starting a listing manually. An AI-assisted way to start will be added later.
      </p>
      {/* The one live region of this form: the busy and error announcements (an open notice announces itself). */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="create-status">
        {announcement}
      </p>
      {locked === "created" && (
        <p className="muted" data-testid="create-created">
          Draft created. <Link href={LISTINGS_PATH} className="text-link">My listings</Link>
        </p>
      )}
      {hasErrors && (
        <ErrorSummary
          ref={summaryRef}
          order={FIELD_ORDER}
          labels={FIELD_LABELS}
          fieldErrors={fieldErrors}
          formErrors={formErrors}
          titleId="create-error-summary-title"
          // The summary never points at a control that cannot be reached: with no Category chosen, a Subtype error goes to the Category.
          targets={{ purpose: `purpose-${registry.purposes[0]}`, ...(values.category ? {} : { subtype: "category" }) }}
        />
      )}
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="alert" className="notice" data-testid="create-notice">
          {notice.text}
          {notice.link && (
            <>
              {" "}
              <Link href={LISTINGS_PATH} className="text-link">
                My listings
              </Link>
            </>
          )}
        </p>
      )}
      <form method="post" onSubmit={onSubmit} noValidate aria-busy={pending} className="card">
        <fieldset className="radio-group" aria-describedby={purposeDescribedBy}>
          <legend>Purpose</legend>
          {purposeErrors?.length ? (
            <p id="purpose-error" className="field-error">
              <span className="sr-only">Error: </span>
              {purposeErrors.join(" ")}
            </p>
          ) : null}
          {registry.purposes.map((purpose) => (
            <label key={purpose} className="radio-option">
              <input
                type="radio"
                id={`purpose-${purpose}`}
                name="purpose"
                value={purpose}
                checked={values.purpose === purpose}
                onChange={() => setValue("purpose", purpose)}
              />
              {label(purpose)}
            </label>
          ))}
        </fieldset>
        <Field name="category" label="Category" errors={fieldErrors.category}>
          {(props) => (
            <select {...props} required value={values.category} onChange={(e) => setValue("category", e.target.value)}>
              <option value="">Select a category</option>
              {registry.categories.map((category) => (
                <option key={category} value={category}>
                  {label(category)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field name="subtype" label="Subtype" hint={values.category ? undefined : "Choose a category first."} errors={fieldErrors.subtype}>
          {(props) => (
            // Not `disabled`: it stays reachable (and a summary link may focus it); with no Category it offers nothing to choose.
            <select {...props} required aria-disabled={values.category ? undefined : true} value={values.subtype} onChange={(e) => setValue("subtype", e.target.value)}>
              <option value="">Select a subtype</option>
              {subtypes.map((subtype) => (
                <option key={subtype} value={subtype}>
                  {label(subtype)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <button type="submit" className="primary-button" aria-disabled={busy ? true : undefined}>
          {pending ? "Creating…" : locked ? "Draft created" : "Create draft"}
        </button>
      </form>
    </>
  );
}

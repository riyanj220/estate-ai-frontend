"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { ErrorSummary } from "@/components/error-summary";
import { Field } from "@/components/form-field";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms";
import { acquireImageLock, imageLockHeld, releaseImageLock } from "@/lib/image-lock";
import { readEligibility, type Eligibility } from "@/lib/listing-correction";
import { NOT_ANSWERED } from "@/lib/listing-details";
import { areaKey, choiceLabel, isMarlaUnit, readListing, type ListingView } from "@/lib/listing-labels";
import {
  CORRECTION_BASIS_ONLY,
  CORRECTION_CHECK_FAILED,
  CORRECTION_CONFIRM,
  CORRECTION_CONFLICT,
  CORRECTION_DIALOG_TEXT,
  CORRECTION_DIALOG_TITLE,
  CORRECTION_FAILED,
  CORRECTION_FORBIDDEN,
  CORRECTION_FORM_LOADING,
  CORRECTION_INTRO,
  CORRECTION_LABEL,
  CORRECTION_NOTE,
  CORRECTION_NO_CHANGE,
  CORRECTION_SAVE_FIRST,
  CORRECTION_STALE,
  CORRECTION_TITLE,
  CORRECTION_UNAVAILABLE,
  CORRECTION_UNSURE,
  CORRECTION_WAIT,
  CORRECTION_WORKING,
  EDIT_FIELD_MESSAGES,
  LOCALITIES_FAILED,
  LOCALITIES_LOADING,
  SAVED_CHOICE_GONE,
  correctionUntilText,
  mapLocationCodes,
} from "@/lib/listing-messages";
import { GENERIC_FIELD_MESSAGE, mapKnownCodes } from "@/lib/password-messages";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import type { RefState } from "@/lib/use-reference";
import type { Registry } from "@/lib/use-registry";

const NAMES = ["locality", "area_value", "area_unit", "marla_basis"] as const;
type Name = (typeof NAMES)[number];
type Values = Record<Name, string>;
/** Their own ids and labels: the main form above has controls for the same fields. */
const idOf = (name: Name) => `correction-${name}`;
const LABELS: Record<Name, string> = { locality: "Corrected locality", area_value: "Corrected area value", area_unit: "Corrected unit", marla_basis: "Corrected marla basis" };

const savedValues = (listing: ListingView): Values => ({
  locality: listing.details.locality ?? "",
  area_value: listing.fields.area_value ?? "",
  area_unit: listing.fields.area_unit ?? "",
  marla_basis: listing.fields.marla_basis ?? "",
});

/** Only what differs from the saved Listing; the marla basis only while the unit takes one (the server clears it otherwise). */
function changesOf(values: Values, saved: Values, scale: number): Partial<Record<Name, string | null>> {
  const changes: Partial<Record<Name, string | null>> = {};
  for (const name of NAMES) {
    if (name === "marla_basis" && !isMarlaUnit(values.area_unit)) continue;
    const same = name === "area_value" ? areaKey(values[name], scale) === areaKey(saved[name], scale) : values[name] === saved[name];
    if (!same) changes[name] = values[name].trim() || null;
  }
  return changes;
}

type Errors = { fields: Record<string, string[]>; form: string[] };
const NO_ERRORS: Errors = { fields: {}, form: [] };
/**
 * The one-time correction of the locality and area of a recently published Listing (Story 2.19). The server says whether it is open and
 * until when; otherwise only a short note shows. The form starts from the saved values and sends only what changed, after a dialog
 * saying it can be done once (the native `<dialog>` pattern of the status actions). The request holds the image lock, so it never runs
 * beside a save or an image change. Every refusal that means the page is out of date reads the Listing and the eligibility again.
 */
export function CorrectionSection({
  listing,
  registry,
  localities,
  dirty,
  blocked,
  saveRunning,
  onBusyChange,
  onSessionGone,
  onNotFound,
  onCorrected,
  onRefused,
}: {
  listing: ListingView;
  /** Null until the form's registry has loaded. */
  registry: Registry | null;
  /** The localities of the Listing's city (the city cannot change while published, so the form's list is the one). */
  localities: RefState;
  dirty: boolean;
  blocked: boolean;
  saveRunning: () => boolean;
  onBusyChange: (busy: boolean) => void;
  onSessionGone: () => Promise<void>;
  onNotFound: () => void;
  onCorrected: (next: ListingView) => void;
  /** Stale, not published, closed or forbidden: the page reads the Listing again and says `text`. */
  onRefused: (text: string) => Promise<void>;
}) {
  const listingId = listing.id;
  const [eligibility, setEligibility] = useState<Eligibility | "loading" | "failed">("loading");
  const mounted = useRef(true);
  const goneRef = useRef(onSessionGone);
  useEffect(() => {
    goneRef.current = onSessionGone;
  });
  const check = useCallback(async () => {
    let answer: Eligibility | "failed" = "failed";
    try {
      const api = await getApi();
      const { data, response } = await withTimeout((signal) =>
        api.GET("/api/v1/listings/{listing_id}/correction", { params: { path: { listing_id: listingId } }, cache: "no-store", signal }),
      );
      if (response.status === 401) return void goneRef.current();
      if (response.ok) answer = readEligibility(data, Date.now()) ?? "failed";
    } catch {
      // a failed check is shown with a Retry
    }
    if (mounted.current) setEligibility(answer);
  }, [listingId]);

  const [token] = useState(() => Symbol("correction"));
  useEffect(() => {
    mounted.current = true;
    void check();
    return () => {
      mounted.current = false;
      releaseImageLock(token);
    };
  }, [check, token]);

  // The form starts again from the saved values whenever they change; a change elsewhere on the page leaves what was typed.
  const saved = savedValues(listing);
  const savedKey = JSON.stringify(saved);
  const [form, setForm] = useState({ key: savedKey, values: saved });
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  if (form.key !== savedKey) {
    setForm({ key: savedKey, values: saved });
    setErrors(NO_ERRORS);
  }
  const values = form.values;

  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState("");
  const [errorTick, setErrorTick] = useState(0);
  const [noteTick, setNoteTick] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const running = useRef(false);
  const closing = useRef(false);
  useEffect(() => {
    if (errorTick > 0) summary.current?.focus();
  }, [errorTick]);
  useEffect(() => {
    if (noteTick > 0) noteRef.current?.focus();
  }, [noteTick]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      cancel.current?.focus();
    } else if (!open && element.open) element.close();
  }, [open]);

  const scale = registry?.field("area_value")?.scale ?? 4;
  const reason = working || blocked ? CORRECTION_WAIT : !registry ? CORRECTION_FORM_LOADING : dirty ? CORRECTION_SAVE_FIRST : "";

  function showErrors(next: Errors) {
    setErrors(next);
    setErrorTick((tick) => tick + 1);
  }
  function showNote(text: string) {
    setNote(text);
    setNoteTick((tick) => tick + 1);
  }
  function setValue(name: Name, value: string) {
    if (running.current) return;
    setForm((current) => ({ ...current, values: { ...current.values, [name]: value } }));
    setErrors(NO_ERRORS);
  }

  function ask(event: React.FormEvent) {
    event.preventDefault();
    if (reason || running.current || saveRunning() || imageLockHeld()) return;
    setNote("");
    const changes = changesOf(values, saved, scale);
    if (Object.keys(changes).length === 0) return showErrors({ fields: {}, form: [CORRECTION_NO_CHANGE] });
    if (Object.keys(changes).join() === "marla_basis") return showErrors({ fields: { marla_basis: [CORRECTION_BASIS_ONLY] }, form: [] });
    setErrors(NO_ERRORS);
    closing.current = false;
    setOpen(true);
  }

  /** The dialog goes before the outcome is shown, so the outcome can take the focus. */
  function closeDialog() {
    closing.current = true;
    dialog.current?.close();
    setOpen(false);
  }

  /** The Listing is read first (it may no longer be published at all), then whether it can still be corrected. */
  async function refused(text: string) {
    await onRefused(text);
    if (mounted.current) await check();
  }

  function invalid(fields: Record<string, string[]>) {
    const mapped: Record<string, string[]> = {};
    const general: string[] = [];
    for (const [key, codes] of Object.entries(fields)) {
      if (codes.length === 0) continue;
      if (key === "non_field_errors") general.push(codes.includes("no_change") ? CORRECTION_NO_CHANGE : CORRECTION_FAILED);
      else if (key === "locality") mapped[key] = mapLocationCodes(key, "reference", codes, GENERIC_FIELD_MESSAGE);
      else if (key === "marla_basis" && codes.includes("not_editable")) mapped[key] = [CORRECTION_BASIS_ONLY];
      else if (key === "area_value" || key === "area_unit" || key === "marla_basis") mapped[key] = mapKnownCodes(codes, EDIT_FIELD_MESSAGES[key]);
      else general.push(CORRECTION_FAILED); // something the correction has no control for (the listing is incomplete elsewhere)
    }
    // A field whose control is hidden (the marla basis) goes to the form-level list.
    if (mapped.marla_basis && !isMarlaUnit(values.area_unit)) {
      general.push(...mapped.marla_basis);
      delete mapped.marla_basis;
    }
    if (Object.keys(mapped).length === 0 && general.length === 0) general.push(CORRECTION_FAILED);
    showErrors({ fields: mapped, form: [...new Set(general)] });
  }

  async function confirm() {
    if (running.current) return;
    const base = listing.revision;
    if (blocked || dirty || base === null || saveRunning() || !acquireImageLock(token)) {
      closeDialog();
      showNote(CORRECTION_WAIT);
      return;
    }
    running.current = true;
    setWorking(true);
    onBusyChange(true);
    try {
      const api = await getApi();
      const body = { base_revision: base, fields: changesOf(values, saved, scale) } as components["schemas"]["ListingCorrectionRequest"];
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.POST("/api/v1/listings/{listing_id}/correction", { params: { path: { listing_id: listingId } }, body, headers: { "X-CSRFToken": csrf }, signal }),
        ),
      );
      closeDialog();
      if (response.ok) {
        const next = readListing(data);
        if (!next || next.id !== listingId || !Number.isInteger(next.revision)) return showNote(CORRECTION_UNSURE);
        onCorrected(next);
        await check();
        return;
      }
      if (response.status === 401) return await onSessionGone();
      if (response.status === 404) return onNotFound();
      const parsed = readErrorBody(error);
      if (response.status === 400) return invalid(parsed?.fields ?? {});
      if (response.status === 409) {
        return await refused(parsed?.code === "stale_revision" ? CORRECTION_STALE : parsed?.code === "correction_unavailable" ? CORRECTION_UNAVAILABLE : CORRECTION_CONFLICT);
      }
      if (response.status === 403) return await refused(CORRECTION_FORBIDDEN);
      showNote(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (thrown) {
      closeDialog();
      showNote(`${thrownMessage(thrown)} ${CORRECTION_UNSURE}`);
    } finally {
      running.current = false;
      releaseImageLock(token);
      onBusyChange(false);
      if (mounted.current) setWorking(false);
    }
  }

  // Tab stays between the two buttons of the dialog.
  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const edge = event.shiftKey ? cancel.current : confirmButton.current;
    if (document.activeElement !== edge) return;
    event.preventDefault();
    (event.shiftKey ? confirmButton : cancel).current?.focus();
  }

  if (eligibility === "loading") return null;
  if (eligibility === "failed") {
    return (
      <div className="card" data-testid="correction-check-failed" style={{ marginBottom: "var(--space)" }}>
        <p className="muted">{CORRECTION_CHECK_FAILED}</p>
        <button type="button" className="secondary-button" onClick={() => void check()}>
          Retry<span className="sr-only"> the correction check</span>
        </button>
      </div>
    );
  }
  if (!eligibility.available) {
    return (
      <p className="hint" data-testid="correction-note" style={{ marginBottom: "var(--space)" }}>
        {CORRECTION_NOTE}
      </p>
    );
  }

  const offered = (name: "area_unit" | "marla_basis") => {
    const list = registry?.field(name)?.valuesFor(listing.fields.purpose, listing.fields.subtype) ?? [];
    return values[name] && !list.includes(values[name]) ? [...list, values[name]] : list;
  };
  const groups = [
    { label: "Areas", items: localities.items.filter((item) => item.kind === "area") },
    { label: "Societies", items: localities.items.filter((item) => item.kind === "society") },
  ];
  const extras = [...new Set([values.locality, saved.locality])].filter((id) => id !== "" && !localities.items.some((item) => item.id === id));
  const shown = NAMES.filter((name) => name !== "marla_basis" || isMarlaUnit(values.area_unit));
  return (
    <section className="card" aria-labelledby="correction-title" data-testid="correction-section" style={{ marginBottom: "var(--space)" }}>
      <h2 id="correction-title" className="section-title">
        {CORRECTION_TITLE}
      </h2>
      <p>{CORRECTION_INTRO}</p>
      <p className="muted" data-testid="correction-until">
        {correctionUntilText(eligibility.until, eligibility.left)}
      </p>
      {(Object.keys(errors.fields).length > 0 || errors.form.length > 0) && (
        <ErrorSummary
          ref={summary}
          order={[...shown]}
          labels={LABELS}
          fieldErrors={errors.fields}
          formErrors={errors.form}
          titleId="correction-error-summary-title"
          targets={Object.fromEntries(NAMES.map((name) => [name, idOf(name)]))}
        />
      )}
      {note && (
        <p ref={noteRef} tabIndex={-1} role="alert" className="notice" data-testid="correction-alert">
          {note}
        </p>
      )}
      <form method="post" onSubmit={ask} noValidate>
        {registry && (
          <>
            <Field name={idOf("locality")} label={LABELS.locality} errors={errors.fields.locality}>
              {(props) => (
                <>
                  <select {...props} value={values.locality} onChange={(e) => setValue("locality", e.target.value)}>
                    <option value="">{NOT_ANSWERED}</option>
                    {groups.map(
                      (group) =>
                        group.items.length > 0 && (
                          <optgroup key={group.label} label={group.label}>
                            {group.items.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </optgroup>
                        ),
                    )}
                    {extras.map((id) => (
                      <option key={id} value={id}>
                        {localities.status === "loading" ? "Loading…" : SAVED_CHOICE_GONE}
                      </option>
                    ))}
                  </select>
                  {(localities.status === "loading" || localities.status === "error") && (
                    <p className="hint">{localities.status === "loading" ? LOCALITIES_LOADING : LOCALITIES_FAILED}</p>
                  )}
                  {localities.status === "error" && (
                    <button type="button" className="secondary-button" onClick={localities.retry}>
                      Retry<span className="sr-only"> loading localities for the correction</span>
                    </button>
                  )}
                </>
              )}
            </Field>
            <Field name={idOf("area_value")} label={LABELS.area_value} errors={errors.fields.area_value}>
              {(props) => <input {...props} type="text" inputMode="decimal" autoComplete="off" value={values.area_value} onChange={(e) => setValue("area_value", e.target.value)} />}
            </Field>
            {shown
              .filter((name) => name === "area_unit" || name === "marla_basis")
              .map((name) => (
                <Field key={name} name={idOf(name)} label={LABELS[name]} errors={errors.fields[name]}>
                  {(props) => (
                    <select {...props} value={values[name]} onChange={(e) => setValue(name, e.target.value)}>
                      <option value="">{name === "marla_basis" ? "I don't know yet" : "Not set"}</option>
                      {offered(name as "area_unit" | "marla_basis").map((choice) => (
                        <option key={choice} value={choice}>
                          {choiceLabel(name, choice)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              ))}
          </>
        )}
        {reason && (
          <p id="correction-reason" className="hint" data-testid="correction-reason">
            {reason}
          </p>
        )}
        <button
          ref={trigger}
          type="submit"
          className="secondary-button"
          aria-disabled={reason ? true : undefined}
          aria-describedby={reason ? "correction-reason" : undefined}
          data-testid="correction-button"
        >
          {CORRECTION_LABEL}
        </button>
      </form>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby="correction-dialog-title"
        aria-describedby="correction-dialog-text"
        data-testid="correction-dialog"
        onClose={() => {
          // The platform may close it behind the state's back (a repeated Escape): a running request opens it again.
          if (running.current && !closing.current) dialog.current?.showModal();
          else setOpen(false);
        }}
        onCancel={(event) => {
          event.preventDefault();
          if (running.current) return;
          closeDialog();
          trigger.current?.focus();
        }}
        onKeyDown={onKeyDown}
      >
        <h2 id="correction-dialog-title" className="section-title">
          {CORRECTION_DIALOG_TITLE}
        </h2>
        <p id="correction-dialog-text">{CORRECTION_DIALOG_TEXT}</p>
        <p role="status" className="sr-only">
          {working ? CORRECTION_WORKING : ""}
        </p>
        <div className="image-actions">
          <button
            ref={cancel}
            type="button"
            className="secondary-button"
            aria-disabled={working ? true : undefined}
            onClick={() => {
              if (running.current) return;
              closeDialog();
              trigger.current?.focus();
            }}
            data-testid="correction-cancel"
          >
            Cancel
          </button>
          <button ref={confirmButton} type="button" className="primary-button" aria-disabled={working ? true : undefined} onClick={() => void confirm()} data-testid="correction-confirm">
            {working ? "Working…" : CORRECTION_CONFIRM}
          </button>
        </div>
      </dialog>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { ErrorSummary } from "@/components/error-summary";
import { Field } from "@/components/form-field";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { REJECTED_ERROR, SERVER_ERROR, readErrorBody, withTimeout } from "@/lib/forms";
import { CROSS_FIELD_GROUPS, SELLER_DECLARED, SELLER_DECLARED_HELP, answeredDetails, detailLabel, latestDetail, sameDetail, sentDetail, shownDetails } from "@/lib/listing-details";
import {
  NOT_SET,
  areaKey,
  areaSummary,
  choiceLabel,
  derivedText,
  formatArea,
  formatPrice,
  isMarlaUnit,
  label,
  normalizeText,
  plainLength,
  priceKey,
  readListing,
  type ListingView,
} from "@/lib/listing-labels";
import {
  ALREADY_SAVED,
  CONFLICT_BANNER,
  DETAIL_MESSAGES,
  DETAILS_DROPPED,
  EDIT_FIELD_MESSAGES,
  EDIT_FORBIDDEN,
  INCOMPLETE_DATE,
  BASIS_DROPPED,
  LATEST_NOT_LOADED,
  MARLA_EXPLANATION,
  CHOICES_APPLIED,
  NO_CHANGES,
  SAVED,
} from "@/lib/listing-messages";
import { mapKnownCodes } from "@/lib/password-messages";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useSession } from "@/lib/session";
import { useFormFeedback } from "@/lib/use-form-feedback";
import { useRegistry, type FieldDef, type Registry } from "@/lib/use-registry";
import { DetailsSection } from "./details-section";

type FieldName = "title" | "description" | "asking_price" | "price_basis" | "rental_period" | "area_value" | "area_unit" | "marla_basis";
/** The form's text per control: the hand-built fields always, the registry details (keyed by id) only when answered; read them with `at`. */
type Values = Record<string, string>;
type Fields = Record<string, string[]>;
/** What the editor learns when it re-reads the Draft (the fallback of a conflict answer without usable data). */
export type Latest = { kind: "found"; listing: ListingView } | { kind: "missing" } | { kind: "gone" } | { kind: "error" };

const FIELD_ORDER: FieldName[] = ["title", "description", "asking_price", "price_basis", "rental_period", "area_value", "area_unit", "marla_basis"];
const AREA_FIELDS: FieldName[] = ["area_value", "area_unit", "marla_basis"];
const FIELD_LABELS: Record<string, string> = { ...Object.fromEntries(FIELD_ORDER.map((name) => [name, label(name)])), area_unit: "Unit" };
/** What a screen reader hears in the conflict buttons: the unit control is visibly "Unit", its name stays unambiguous. */
const ACTION_LABELS: Record<string, string> = { ...FIELD_LABELS, area_unit: "Area unit" };
const labelOf = (name: string, category: string | null): string => (Object.hasOwn(FIELD_LABELS, name) ? FIELD_LABELS[name] : detailLabel(name, category));
const actionLabelOf = (name: string, category: string | null): string => (Object.hasOwn(ACTION_LABELS, name) ? ACTION_LABELS[name] : detailLabel(name, category));
/** A value of the form; a detail that was never answered or typed is empty text. */
const at = (values: Values, name: string): string => (Object.hasOwn(values, name) ? values[name] : "");
const keysOf = (...records: Values[]): string[] => [...new Set(records.flatMap((record) => Object.keys(record)))];
/** The registry type each editor control is built for: a field of another type gets no control. */
const EXPECTED_TYPE: Record<FieldName, string> = {
  title: "text",
  description: "text",
  asking_price: "money",
  price_basis: "enum",
  rental_period: "enum",
  area_value: "decimal",
  area_unit: "enum",
  marla_basis: "enum",
};

const isFieldName = (key: string): key is FieldName => (FIELD_ORDER as string[]).includes(key);
const toValues = (listing: ListingView): Values => ({
  ...listing.details,
  title: listing.fields.title ?? "",
  description: listing.fields.description ?? "",
  asking_price: listing.fields.asking_price ?? "",
  price_basis: listing.fields.price_basis ?? "",
  rental_period: listing.fields.rental_period ?? "",
  area_value: listing.fields.area_value ?? "",
  area_unit: listing.fields.area_unit ?? "",
  marla_basis: listing.fields.marla_basis ?? "",
});

/** Two texts are the same value for one field: prices by amount (as text), free text as the server normalises it. */
function sameText(name: FieldName, a: string, b: string, scale: number): boolean {
  if (name === "asking_price") return priceKey(a) === priceKey(b);
  if (name === "area_value") return areaKey(a, scale) === areaKey(b, scale);
  if (name === "title" || name === "description") return normalizeText(a, name === "description") === normalizeText(b, name === "description");
  return a === b;
}

/** A Listing the editor can build on: an integer revision is required, because every save is checked against it. */
const hasRevision = (listing: ListingView | null): listing is ListingView & { revision: number } => listing !== null && Number.isInteger(listing.revision);

/**
 * The fields this Draft's form shows: those the registry defines with the expected type and that apply to the Draft. The marla
 * basis also needs the unit the form currently has to be marla or kanal (a kanal is 20 marla); the server clears it otherwise.
 */
function shownFields(registry: Registry, listing: ListingView, unit: string): FieldName[] {
  return FIELD_ORDER.filter((name) => {
    const def = registry.field(name);
    if (name === "marla_basis" && !isMarlaUnit(unit)) return false;
    return def?.type === EXPECTED_TYPE[name] && !def.derived && def.appliesTo(listing.fields.purpose, listing.fields.category, listing.fields.subtype);
  });
}

/** "Required before you publish. 10 to 100 characters." from the registry definition. */
function hintFor(def: FieldDef): string {
  const parts: string[] = [];
  if (def.requirement === "required_for_publication") parts.push("Required before you publish");
  else if (def.requirement === "recommended") parts.push("Recommended");
  if (def.type === "text" && def.maxLength !== null) {
    parts.push(def.minLength ? `${def.minLength} to ${def.maxLength} characters` : `Up to ${def.maxLength} characters`);
  }
  if (def.type === "money") {
    parts.push(`Amount in ${def.currency ?? "PKR"}`);
    if (def.min !== null && def.max !== null) parts.push(`Between ${def.min} and ${def.max}`);
  }
  if (def.type === "decimal") {
    if (def.scale !== null) parts.push(`Digits with an optional decimal point, up to ${def.scale} decimal places`);
    if (def.min !== null && def.max !== null) parts.push(`Between ${def.min} and ${def.max}`);
  }
  return parts.length > 0 ? `${parts.join(". ")}.` : "";
}

/** What "Latest saved" shows for one field. */
function latestText(name: FieldName, value: string): string {
  if (value === "") return name === "marla_basis" ? "I don't know yet" : NOT_SET;
  if (name === "asking_price") return `PKR ${formatPrice(value)}`;
  if (name === "area_value") return formatArea(value);
  if (name === "price_basis" || name === "rental_period") return label(value);
  if (name === "area_unit" || name === "marla_basis") return choiceLabel(name, value);
  return value;
}

/** The texts of the codes for a registry detail, by its type; a field the registry does not define has none (every code is generic). */
function detailMessages(def: FieldDef | undefined): Record<string, string> {
  return def && Object.hasOwn(DETAIL_MESSAGES, def.type) ? DETAIL_MESSAGES[def.type] : {};
}

/** The value the form sends for a changed field: trimmed, and null when emptied. Money stays the text that was typed. */
const sentValue = (value: string): string | null => value.trim() || null;

type Alert = { kind: "conflict" | "notice"; text: string };
type Conflict = { fields: string[]; kept: string[] };

/**
 * The Draft page: the read-only summary and the editor for the fields introduced so far, built from the registry. Saving is
 * explicit, sends only the fields that changed with the revision last loaded, and never loses what was typed: a validation
 * error keeps the values, a conflict loads the latest data beside them, any other failure leaves the form as it was.
 * Nothing about the Draft is stored or logged.
 */
export function DraftEditor({
  initial,
  signInPath,
  onSessionGone,
  onNotFound,
  fetchLatest,
}: {
  initial: ListingView;
  signInPath: string;
  onSessionGone: () => Promise<void>;
  /** The Draft cannot be found (404): the page shows its not-found state. */
  onNotFound: () => void;
  fetchLatest: () => Promise<Latest>;
}) {
  const { account } = useSession();
  const { status, registry, retry, retrying } = useRegistry(signInPath);
  const areaScale = registry?.field("area_value")?.scale ?? 4;
  const same = (name: string, a: string, b: string) => {
    if (isFieldName(name)) return sameText(name, a, b, areaScale);
    const def = registry?.field(name);
    return def ? sameDetail(def, a, b) : a === b;
  };
  const [listing, setListing] = useState(initial);
  const [values, setValues] = useState<Values>(() => toValues(initial));
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<"" | "saved" | "unchanged">("");
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [alertTick, setAlertTick] = useState(0);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  // The fields a problem between two fields (the floor rule) is shown under: editing either clears them all.
  const [linked, setLinked] = useState<string[]>([]);
  // Date fields that hold a partly typed date (the browser reports "" for them): Save is blocked until each is finished or cleared.
  const [incomplete, setIncomplete] = useState<string[]>([]);
  const { announcement, setAnnouncement, resetAnnouncement, announce, focusSummary, summaryRef } = useFormFeedback();
  const alertRef = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  // The latest state for the async answers (a save may finish after the person typed more).
  const valuesRef = useRef(values);
  const listingRef = useRef(listing);
  useEffect(() => {
    valuesRef.current = values;
    listingRef.current = listing;
  });

  // The alert (a conflict banner or a failure notice) is the one live region while it shows: it takes focus, nothing else announces it.
  useEffect(() => {
    if (alertTick > 0) alertRef.current?.focus();
  }, [alertTick]);
  function showAlert(next: Alert) {
    resetAnnouncement();
    setInfo("");
    setAlert(next);
    setAlertTick((tick) => tick + 1);
  }

  const shown = registry ? shownFields(registry, listing, values.area_unit) : [];
  const detailDefs = registry ? shownDetails(registry, listing) : [];
  const detailIds = detailDefs.map((def) => def.id);
  const controls: string[] = [...shown, ...detailIds];
  const baseline = toValues(listing);
  const dirty = controls.some((name) => !same(name, at(values, name), at(baseline, name)));

  // An unsaved-changes guard on leaving the page. In-app links are not intercepted; nothing is stored.
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  /** A date input says whether it is incomplete: a finished or cleared one drops its flag (the flag is only ever raised by Save). */
  function onDateInput(name: string, partial: boolean) {
    if (!partial) setIncomplete((current) => (current.includes(name) ? current.filter((other) => other !== name) : current));
  }

  function setValue(name: string, value: string) {
    // Moving the unit away from marla and kanal drops what was typed for the basis (it is hidden and never sent; the server clears it).
    setValues((current) => ({
      ...current,
      [name]: value,
      ...(name === "area_unit" && !isMarlaUnit(value) ? { marla_basis: baseline.marla_basis } : {}),
    }));
    setInfo("");
    // The last open conflict row hidden by typing the latest value by hand ends the banner, like resolving it with a button.
    if (conflict && conflict.fields.length > 0 && alert?.kind === "conflict") {
      const latest = toValues(listingRef.current);
      const open = (shownValues: Values) =>
        conflict.fields.some(
          (other) =>
            !conflict.kept.includes(other) &&
            !(other === "marla_basis" && !isMarlaUnit(shownValues.area_unit)) &&
            !same(other, at(shownValues, other), at(latest, other)),
        );
      if (open(valuesRef.current) && !open({ ...valuesRef.current, [name]: value })) {
        setAlert(null);
        resetAnnouncement();
        setAnnouncement(CHOICES_APPLIED);
      }
    }
    const together = linked.includes(name) ? linked : []; // a problem between fields goes when one of its fields is edited
    if (together.length > 0) setLinked([]);
    setFieldErrors((current) => {
      const away = name === "area_unit" && !isMarlaUnit(value);
      if (!current[name] && !(away && current.marla_basis) && !together.some((other) => current[other])) return current;
      const next = { ...current };
      delete next[name];
      for (const other of together) delete next[other]; // a floor problem belongs to both floor fields
      if (away) delete next.marla_basis; // its control goes: no error text and no summary link to it
      return next;
    });
  }

  /** A save succeeded: the answer is the new baseline; fields typed after the request keep what was typed. */
  function applySaved(next: ListingView, submitted: Values) {
    const fresh = toValues(next);
    setListing(next);
    setValues((current) => {
      const merged = { ...current };
      for (const name of keysOf(current, submitted, fresh)) if (at(current, name) === at(submitted, name)) merged[name] = at(fresh, name);
      return merged;
    });
    setLinked([]);
    setIncomplete([]);
    setConflict(null);
    setAlert(null);
    setFieldErrors({});
    setFormErrors([]);
    resetAnnouncement();
    setInfo("saved");
  }

  /**
   * Another session changed the Draft. The latest data becomes the baseline; what the owner typed stays exactly as typed;
   * a field the owner had not changed takes the latest value (it was never the owner's input). Fields where the owner's
   * value differs from the latest one get "Latest saved" with a choice.
   */
  function applyConflict(latest: ListingView) {
    if (!registry) return;
    const before = toValues(listingRef.current);
    const typed = valuesRef.current;
    const fresh = toValues(latest);
    // The basis row follows the unit the form will have: the owner's own when changed, else the latest one.
    const unitTyped = !same("area_unit", typed.area_unit, before.area_unit);
    const visible: string[] = [...shownFields(registry, latest, unitTyped ? typed.area_unit : fresh.area_unit), ...shownDetails(registry, latest).map((def) => def.id)];
    const ownerChanged = visible.filter((name) => !same(name, at(typed, name), at(before, name)));
    const differing = ownerChanged.filter((name) => !same(name, at(typed, name), at(fresh, name)));
    // "Already saved" only when nothing outside the owner's own changes moved on the server.
    const elsewhere = visible.some((name) => !ownerChanged.includes(name) && !same(name, at(before, name), at(fresh, name)));
    // The owner changed only the basis while another session moved the unit away from marla and kanal: the basis no longer
    // applies (the server cleared it), so the hidden typed basis is reset to the latest one and the banner says so.
    // Details the owner changed that no longer apply to the Draft as it is now (the latest data hides them): the typed value is reset.
    const shownBefore = shownDetails(registry, listingRef.current).map((def) => def.id);
    const latestIds = visible;
    const detailsLost = shownBefore.filter((name) => !latestIds.includes(name) && !same(name, at(typed, name), at(before, name)));
    const basisLost = !unitTyped && isMarlaUnit(before.area_unit) && !isMarlaUnit(fresh.area_unit) && !same("marla_basis", typed.marla_basis, before.marla_basis);
    setValues((current) => {
      const merged = { ...current };
      for (const name of keysOf(current, before, fresh)) {
        if (!ownerChanged.includes(name) && same(name, at(current, name), at(before, name))) merged[name] = at(fresh, name);
      }
      if (basisLost) merged.marla_basis = fresh.marla_basis;
      for (const name of detailsLost) merged[name] = at(fresh, name);
      return merged;
    });
    setListing(latest);
    setConflict({ fields: differing, kept: [] });
    setLinked([]);
    setFieldErrors({});
    setFormErrors([]);
    showAlert({
      kind: "conflict",
      text: [
        differing.length === 0 && !elsewhere && !basisLost && detailsLost.length === 0 ? ALREADY_SAVED : CONFLICT_BANNER,
        basisLost ? BASIS_DROPPED : null,
        detailsLost.length > 0 ? DETAILS_DROPPED : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  /** When the last open conflict row is resolved the banner goes and the choices are announced once in the live region. */
  function afterChoice(name: string, resolved: Values) {
    if (!conflict) return;
    const latest = toValues(listingRef.current);
    // A row counts as open only while its control is shown under the unit the form has now.
    const open = conflict.fields.filter(
      (other) =>
        other !== name &&
        !conflict.kept.includes(other) &&
        !(other === "marla_basis" && !isMarlaUnit(resolved.area_unit)) &&
        !same(other, at(resolved, other), at(latest, other)),
    );
    if (open.length > 0) return;
    setAlert(null);
    setInfo("");
    resetAnnouncement();
    setAnnouncement(CHOICES_APPLIED);
  }

  function keepMine(name: string) {
    if (submitting.current) return;
    setConflict((current) => (current ? { ...current, kept: [...current.kept, name] } : current));
    afterChoice(name, valuesRef.current);
    document.getElementById(name)?.focus();
  }

  function takeLatest(name: string) {
    if (submitting.current) return;
    const fresh = toValues(listingRef.current);
    const latest = at(fresh, name);
    const together = linked.includes(name) ? linked : [];
    if (together.length > 0) setLinked([]);
    setIncomplete((current) => current.filter((other) => other !== name));
    // The field's own error and the problem between fields it belongs to are about the typed value, which is replaced.
    setFieldErrors((current) => {
      if (![name, ...together].some((key) => current[key])) return current;
      const next = { ...current };
      delete next[name];
      for (const other of together) delete next[other];
      return next;
    });
    // The latest unit does not need a basis: the typed one goes with its control, to the latest basis (the server cleared it).
    const away = name === "area_unit" && !isMarlaUnit(latest);
    const extra: Values = away ? { marla_basis: fresh.marla_basis } : {};
    setValues((current) => ({ ...current, [name]: latest, ...extra }));
    if (away) {
      setFieldErrors((current) => {
        if (!current.marla_basis) return current;
        const next = { ...current };
        delete next.marla_basis;
        return next;
      });
    }
    afterChoice(name, { ...valuesRef.current, [name]: latest, ...extra });
    document.getElementById(name)?.focus();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !registry) return;
    setInfo("");
    setAlert(null);
    // A partly typed date reads as "" (a clear). Nothing is sent while one is open: the save is blocked with the summary.
    const partial = detailDefs
      .filter((def) => def.type === "date" && (document.getElementById(def.id) as HTMLInputElement | null)?.validity?.badInput === true)
      .map((def) => def.id);
    setIncomplete(partial);
    if (partial.length > 0) {
      resetAnnouncement();
      setFormErrors([]);
      focusSummary();
      announce("The form has errors. Review the list at the top of the page.");
      return;
    }
    const fields: Record<string, string | number | boolean | null> = {};
    for (const name of shown) if (!same(name, values[name], baseline[name])) fields[name] = sentValue(values[name]);
    for (const def of detailDefs) if (!same(def.id, at(values, def.id), at(baseline, def.id))) fields[def.id] = sentDetail(def, at(values, def.id));
    if (Object.keys(fields).length === 0) {
      resetAnnouncement();
      setFieldErrors({});
      setFormErrors([]);
      setInfo("unchanged");
      return;
    }
    if (listing.revision === null) {
      // Without a revision nothing can be saved safely; the page has to be loaded again.
      showAlert({ kind: "notice", text: REJECTED_ERROR });
      return;
    }
    const submitted: Values = { ...values };
    const baseRevision = listing.revision;
    submitting.current = true;
    setPending(true);
    setFieldErrors({});
    setFormErrors([]);
    resetAnnouncement();
    setAnnouncement("Saving your changes.");
    try {
      const api = await getApi();
      // Exactly `base_revision` and the changed fields: never an origin, a status or anything the form does not own.
      const body = { base_revision: baseRevision, fields } as components["schemas"]["ListingUpdateRequest"];
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.PATCH("/api/v1/listings/{listing_id}", {
            params: { path: { listing_id: listing.id } },
            body,
            headers: { "X-CSRFToken": csrf },
            signal,
          }),
        ),
      );
      if (response.ok) {
        const next = readListing(data);
        if (hasRevision(next) && next.id === listing.id) return applySaved(next, submitted);
        // A success that is not this Draft with a revision cannot be built on: it is treated as a server error.
        showAlert({ kind: "notice", text: SERVER_ERROR });
        return;
      }
      if (response.status === 401) return await onSessionGone();
      if (response.status === 404) return onNotFound();
      if (response.status === 409) {
        const current = typeof error === "object" && error !== null ? readListing((error as { current?: unknown }).current) : null;
        const usable = hasRevision(current) && current.id === listing.id && current.revision > baseRevision ? current : null;
        if (usable) return applyConflict(usable);
        // No usable data in the answer: read the Draft again and keep what was typed.
        const again = await fetchLatest();
        if (again.kind === "found" && hasRevision(again.listing)) return applyConflict(again.listing);
        if (again.kind === "gone") return await onSessionGone();
        if (again.kind === "missing") return onNotFound();
        showAlert({ kind: "notice", text: LATEST_NOT_LOADED });
        return;
      }
      const parsed = response.status === 400 ? readErrorBody(error) : null;
      if (parsed) {
        const mapped: Fields = {};
        const general: string[] = [];
        const together: string[] = [];
        for (const [key, codes] of Object.entries(parsed.fields)) {
          if (codes.length === 0) continue;
          // Known codes only: any other sentence, code or key is generic, never the server's text. A field with no
          // control on this form goes to the form-level list, so the summary never points at a hidden control.
          if (isFieldName(key) && shown.includes(key)) mapped[key] = mapKnownCodes(codes, EDIT_FIELD_MESSAGES[key]);
          else if (isFieldName(key)) general.push(...mapKnownCodes(codes, EDIT_FIELD_MESSAGES[key], REJECTED_ERROR));
          else if (detailIds.includes(key)) {
            mapped[key] = mapKnownCodes(codes, detailMessages(registry.field(key)));
            for (const code of codes) if (Object.hasOwn(CROSS_FIELD_GROUPS, code)) together.push(...CROSS_FIELD_GROUPS[code]);
          } else general.push(...mapKnownCodes(codes, detailMessages(registry.field(key)), REJECTED_ERROR));
        }
        // What was typed after the request went out is not what was judged: its errors (and a problem between fields that
        // touches it) are dropped, so no text points at a value the server never saw.
        const typedNow = valuesRef.current;
        const stale = (key: string) => at(typedNow, key) !== at(submitted, key);
        const groupStale = together.some(stale);
        for (const key of Object.keys(mapped)) if (stale(key) || (groupStale && together.includes(key))) delete mapped[key];
        const linkedNow = groupStale ? [] : [...new Set(together)]; // every field of the group, so editing the one without the error clears it too
        const sentKeys = Object.keys(parsed.fields).filter((key) => (parsed.fields[key] ?? []).length > 0);
        const nothingLeft = Object.keys(mapped).length === 0 && general.length === 0 && sentKeys.length > 0 && sentKeys.every((key) => controls.includes(key));
        if (nothingLeft) {
          resetAnnouncement();
          setFieldErrors({});
          setFormErrors([]);
          setLinked([]);
          return;
        }
        if (Object.keys(mapped).length === 0 && general.length === 0) general.push(REJECTED_ERROR);
        general.splice(0, general.length, ...new Set(general));
        resetAnnouncement();
        setFieldErrors(mapped);
        setLinked(linkedNow);
        setFormErrors(general);
        focusSummary();
        announce("The form has errors. Review the list at the top of the page.");
        return;
      }
      if (response.status === 403) {
        // A CSRF rejection and a Suspended account both answer 403 `forbidden`, so the session decides: only a Suspended
        // account is told so; every other persistent 403 (after the one CSRF retry) is the generic message.
        showAlert({ kind: "notice", text: account?.state === "suspended" ? EDIT_FORBIDDEN : failureMessage(403, null) });
        return;
      }
      showAlert({ kind: "notice", text: failureMessage(response.status, response.headers.get("Retry-After")) });
    } catch (thrown) {
      showAlert({ kind: "notice", text: thrownMessage(thrown) });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const price = listing.fields.asking_price === null ? NOT_SET : `PKR ${formatPrice(listing.fields.asking_price)}`;
  const detailSummary = registry ? answeredDetails(detailDefs, listing) : [];
  const areaDirty = shown.some((name) => AREA_FIELDS.includes(name) && !same(name, values[name], baseline[name]));
  const derivedBase = derivedText(listing.fields);
  // The figure is the saved one: while area input is unsaved it must not read as describing that input.
  const derived = derivedBase && areaDirty ? `${derivedBase} (saved figure, updates after you save)` : derivedBase;
  const shownErrors: Fields = { ...fieldErrors };
  for (const name of incomplete) shownErrors[name] = [...(shownErrors[name] ?? []), INCOMPLETE_DATE];
  const hasErrors = formErrors.length > 0 || Object.keys(shownErrors).length > 0;
  const showConflict = (name: string) =>
    conflict !== null &&
    conflict.fields.includes(name) &&
    !conflict.kept.includes(name) &&
    !(name === "marla_basis" && !isMarlaUnit(values.area_unit)) &&
    !same(name, at(values, name), at(baseline, name));

  function latestOf(name: string): string {
    if (isFieldName(name)) return latestText(name, baseline[name]);
    const def = registry?.field(name);
    return def ? latestDetail(def, at(baseline, name)) : at(baseline, name) || NOT_SET;
  }

  /** The "Latest saved" line with its two actions, shown under a field whose typed value differs from the latest one. */
  function conflictRow(name: string) {
    if (!showConflict(name)) return null;
    const busy = pending ? true : undefined;
    return (
      <div className="conflict-row" data-testid={`conflict-${name}`}>
        <p id={`${name}-latest`} className="hint">
          Latest saved{registry?.field(name)?.sellerDeclared ? ` (${SELLER_DECLARED.toLowerCase()})` : ""}: <span className="latest-value">{latestOf(name)}</span>
        </p>
        <div className="conflict-actions">
          <button type="button" className="secondary-button" aria-disabled={busy} onClick={() => keepMine(name)}>
            Keep mine<span className="sr-only"> for {actionLabelOf(name, listing.fields.category)}</span>
          </button>
          <button type="button" className="secondary-button" aria-disabled={busy} onClick={() => takeLatest(name)}>
            Use latest<span className="sr-only"> for {actionLabelOf(name, listing.fields.category)}</span>
          </button>
        </div>
      </div>
    );
  }

  /** The counter under a text field: plain text, never a live region, so it is not announced on every keystroke. */
  function counter(name: FieldName, def: FieldDef) {
    if (def.maxLength === null) return null;
    const used = plainLength(values[name], name === "description");
    const over = used - def.maxLength;
    return (
      <p id={`${name}-count`} className="hint" data-testid={`${name}-count`}>
        {used} of {def.maxLength} characters{over > 0 ? `. ${over} too many: shorten the text.` : ""}
      </p>
    );
  }
  const describedBy = (name: FieldName, base: string | undefined, extra: boolean) =>
    [base, extra ? `${name}-count` : null, showConflict(name) ? `${name}-latest` : null].filter(Boolean).join(" ") || undefined;

  const purpose = listing.fields.purpose;
  const choices = (name: FieldName, def: FieldDef) => {
    const offered = def.valuesFor(purpose, listing.fields.subtype);
    // A stored value the registry no longer offers stays visible instead of silently turning into "Not set".
    return values[name] && !offered.includes(values[name]) ? [...offered, values[name]] : offered;
  };

  function control(name: FieldName, def: FieldDef) {
    const errors = fieldErrors[name];
    const common = { name, label: FIELD_LABELS[name], hint: (name === "marla_basis" ? MARLA_EXPLANATION : hintFor(def)) || undefined,
      errors,
      // A hand-built field a registry flags as the owner's claim gets the same tag and helper as a detail.
      declared: def.sellerDeclared ? { tag: SELLER_DECLARED, help: SELLER_DECLARED_HELP } : undefined,
    };
    if (name === "title") {
      return (
        <Field {...common}>
          {(props) => (
            <>
              <input
                {...props}
                aria-describedby={describedBy(name, props["aria-describedby"], true)}
                type="text"
                autoComplete="off"
                value={values.title}
                onChange={(e) => setValue("title", e.target.value)}
              />
              {counter(name, def)}
              {conflictRow(name)}
            </>
          )}
        </Field>
      );
    }
    if (name === "description") {
      return (
        <Field {...common}>
          {(props) => (
            <>
              <textarea
                {...props}
                aria-describedby={describedBy(name, props["aria-describedby"], true)}
                rows={6}
                value={values.description}
                onChange={(e) => setValue("description", e.target.value)}
              />
              {counter(name, def)}
              {conflictRow(name)}
            </>
          )}
        </Field>
      );
    }
    if (name === "asking_price") {
      return (
        <Field {...common}>
          {(props) => (
            <>
              <div className="money-row">
                <span className="money-prefix" aria-hidden="true">
                  {def.currency ?? "PKR"}
                </span>
                <input
                  {...props}
                  aria-describedby={describedBy(name, props["aria-describedby"], false)}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={values.asking_price}
                  onChange={(e) => setValue("asking_price", e.target.value)}
                />
              </div>
              {conflictRow(name)}
            </>
          )}
        </Field>
      );
    }
    if (name === "area_value") {
      return (
        <Field {...common}>
          {(props) => (
            <>
              <input
                {...props}
                aria-describedby={describedBy(name, props["aria-describedby"], false)}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={values.area_value}
                onChange={(e) => setValue("area_value", e.target.value)}
              />
              {conflictRow(name)}
            </>
          )}
        </Field>
      );
    }
    return (
      <Field {...common}>
        {(props) => (
          <>
            <select
              {...props}
              aria-describedby={describedBy(name, props["aria-describedby"], false)}
              value={values[name]}
              onChange={(e) => setValue(name, e.target.value)}
            >
              <option value="">{name === "marla_basis" ? "I don't know yet" : NOT_SET}</option>
              {choices(name, def).map((choice) => (
                <option key={choice} value={choice}>
                  {choiceLabel(name, choice)}
                </option>
              ))}
            </select>
            {conflictRow(name)}
          </>
        )}
      </Field>
    );
  }

  return (
    <>
      <section className="card" aria-labelledby="draft-details-title" style={{ marginBottom: "var(--space)" }}>
        <h2 id="draft-details-title" className="section-title">
          What exists so far
        </h2>
        <dl className="detail-list" data-testid="draft-details">
          <div>
            <dt>Status</dt>
            <dd data-testid="draft-status">{label(listing.status)}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd data-testid="draft-revision">{listing.revision ?? NOT_SET}</dd>
          </div>
          <div>
            <dt>Registry version</dt>
            <dd data-testid="draft-registry-version">{listing.registryVersion ?? NOT_SET}</dd>
          </div>
          <div>
            <dt>Purpose</dt>
            <dd data-testid="draft-purpose">{label(listing.fields.purpose)}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd data-testid="draft-category">{label(listing.fields.category)}</dd>
          </div>
          <div>
            <dt>Subtype</dt>
            <dd data-testid="draft-subtype">{label(listing.fields.subtype)}</dd>
          </div>
          <div>
            <dt>Asking price</dt>
            <dd data-testid="draft-price">{price}</dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd data-testid="draft-area">{areaSummary(listing.fields)}</dd>
          </div>
          {detailSummary.map((item) => (
            <div key={item.id}>
              <dt>{item.label}</dt>
              <dd data-testid={`draft-detail-${item.id}`}>
                {item.text}
                {item.sellerDeclared && (
                  <>
                    <span className="sr-only">. </span>
                    <span className="declared-tag declared-tag-inline" data-testid={`draft-detail-${item.id}-seller-declared`}>
                      {SELLER_DECLARED}
                    </span>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card" aria-labelledby="draft-edit-title" style={{ marginBottom: "var(--space)" }}>
        <h2 id="draft-edit-title" className="section-title">
          Edit details
        </h2>
        {status === "loading" && (
          <p className="muted" data-testid="draft-form-loading">
            Loading the form…
          </p>
        )}
        {status === "error" && (
          <div data-testid="registry-error">
            <p className="muted">We could not load the form. Check your connection and try again.</p>
            <p role="status" className={retrying ? "muted" : "sr-only"}>
              {retrying ? "Retrying…" : ""}
            </p>
            <button type="button" className="primary-button" aria-disabled={retrying ? true : undefined} onClick={retry}>
              Retry
            </button>
          </div>
        )}
        {registry && controls.length === 0 && (
          <p className="muted" data-testid="draft-nothing-editable">
            Nothing on this draft can be edited right now.
          </p>
        )}
        {registry && controls.length > 0 && (
          <>
            {/* The one live region of this form: the visible "Saved" or "No changes" text, else the busy and error announcements (an open alert announces itself). */}
            <p
              role="status"
              aria-live="polite"
              className={info ? "muted" : "sr-only"}
              data-testid="draft-live"
            >
              {info === "saved" ? SAVED : info === "unchanged" ? NO_CHANGES : announcement}
            </p>
            {hasErrors && (
              <ErrorSummary
                ref={summaryRef}
                order={controls}
                labels={Object.fromEntries(controls.map((name) => [name, labelOf(name, listing.fields.category)]))}
                fieldErrors={shownErrors}
                formErrors={formErrors}
                titleId="edit-error-summary-title"
              />
            )}
            {alert && (
              <p
                ref={alertRef}
                tabIndex={-1}
                role="alert"
                className="notice"
                data-testid={alert.kind === "conflict" ? "draft-conflict" : "draft-notice"}
              >
                {alert.text}
              </p>
            )}
            <form method="post" onSubmit={onSubmit} noValidate aria-busy={pending}>
              {shown
                .filter((name) => !AREA_FIELDS.includes(name))
                .map((name) => {
                  const def = registry.field(name);
                  return def ? <div key={name}>{control(name, def)}</div> : null;
                })}
              {shown.some((name) => AREA_FIELDS.includes(name)) && (
                <div role="group" aria-labelledby="area-title" data-testid="area-block">
                  <h3 id="area-title" className="section-title">
                    Area
                  </h3>
                  {shown
                    .filter((name) => AREA_FIELDS.includes(name))
                    .map((name) => {
                      const def = registry.field(name);
                      return def ? <div key={name}>{control(name, def)}</div> : null;
                    })}
                  {derived && (
                    <p className="hint" data-testid="area-derived">
                      {derived}
                    </p>
                  )}
                </div>
              )}
              <DetailsSection
                fields={detailDefs}
                values={values}
                saved={baseline}
                errors={shownErrors}
                onDateInput={onDateInput}
                purpose={purpose}
                category={listing.fields.category}
                subtype={listing.fields.subtype}
                onChange={setValue}
                conflictRow={conflictRow}
                inConflict={showConflict}
              />
              <button type="submit" className="primary-button" aria-disabled={pending ? true : undefined}>
                {pending ? "Saving…" : "Save changes"}
              </button>
            </form>
          </>
        )}
      </section>
    </>
  );
}

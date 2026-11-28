"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Field } from "@/components/ui/form-field";
import {
  CATALOGUE_LOADING_LINE,
  CATALOGUE_UNAVAILABLE_LINE,
  KIND_ORDER,
  KIND_TITLES,
  STATE_TEXT,
  amenityGroupedSummary,
  amenityLabel,
  answeredOfKind,
  decodeAmenities,
  otherCodes,
  pruneStale,
  type AmenityMap,
} from "@/lib/listing/amenities";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { REJECTED_ERROR, SERVER_ERROR, readErrorBody, withTimeout } from "@/lib/forms/forms";
import { CROSS_FIELD_GROUPS, NOT_ANSWERED, SELLER_DECLARED, SELLER_DECLARED_HELP, answeredDetails, detailLabel, latestDetail, sameDetail, sentDetail, shownDetails } from "@/lib/listing/listing-details";
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
} from "@/lib/listing/listing-labels";
import {
  ALREADY_SAVED,
  CONFLICT_BANNER,
  LISTING_FIELD_MESSAGES,
  DETAIL_MESSAGES,
  DETAILS_DROPPED,
  EDIT_FIELD_MESSAGES,
  EDIT_FORBIDDEN,
  INCOMPLETE_DATE,
  ANOTHER_LOCALITY,
  LOADING_VALUE,
  LOCALITY_CLEARED,
  LOCALITY_DROPPED,
  LOCALITY_NEEDS_CITY,
  SAVED_CHOICE_GONE,
  mapLocationCodes,
  BASIS_DROPPED,
  LATEST_NOT_LOADED,
  MARLA_EXPLANATION,
  CHOICES_APPLIED,
  CONFIRM_NO_CONTROL,
  CONFIRM_REQUIRED_ERROR,
  CONFIRM_LABEL,
  CONFIRMED,
  IMAGES_REQUIRED_ERROR,
  PUBLISH_DONE,
  PUBLISH_ELSEWHERE,
  PUBLISH_ERRORS_ANNOUNCE,
  PUBLISH_PAUSED,
  NO_CHANGES,
  SAVED,
  DELETE_DRAFT_PAUSED,
  LISTINGS_PATH,
  ARCHIVED_NOTE,
  REPUBLISH_DONE_COUNTED,
  REPUBLISH_DONE_FREE,
  REPUBLISH_DONE_UNKNOWN,
  REPUBLISH_ERRORS_ANNOUNCE,
  REPUBLISH_FORBIDDEN,
  republishGoneText,
  IDENTITY_LOCKED_ERROR,
  PUBLISHED_IDENTITY_NOTE,
  READ_ONLY_FALLBACK,
  READ_ONLY_NOTES,
  RESTRICTED_NOTE,
  STATUS_ACTIONS,
  STATUS_CONFLICT_NOT_LOADED,
  lostEditsText,
  statusChangedText,
  STATUS_PAUSED,
  CORRECTION_DONE,
  CORRECTION_PAUSED,
  restrictionReasonText,
  UNDER_REVIEW_NOTE,
  PREVIEW_SAVED_HINT,
  SAVE_PAUSED,
  SAVE_WAIT,
} from "@/lib/listing/listing-messages";
import { GENERIC_FIELD_MESSAGE, mapKnownCodes } from "@/lib/forms/password-messages";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { useSession } from "@/lib/auth/session";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";
import { useAmenityCatalogue, useLocationLists } from "@/lib/reference/use-reference";
import { useRegistry, type FieldDef, type Registry } from "@/lib/listing/use-registry";
import { isEditableListing, targetsFor, type StatusTarget } from "@/lib/listing/listing-status";
import { CorrectionSection } from "./correction-section";
import { DeleteDraft } from "./delete-draft";
import { DetailsSection, IDENTITY_NOTE_ID } from "./details-section";
import { FloorPlanSection } from "./floor-plan-section";
import { ImagesSection } from "./images-section";
import { EstimateSection } from "./estimate-section";
import { PublishSection, PublishedAllowance, type PublicationKind, type PublishMode } from "./publish-section";
import { StatusActions } from "./status-actions";

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

/** The text of the codes of one detail: location fields have their own (Story 2.7); every other type uses the texts of its type. */
function codeTexts(def: FieldDef | undefined, key: string, codes: string[], fallback: string, cityChosen = true): string[] {
  // `invalid` on a locality means "choose a city first" only while no city is chosen; with one it is an ordinary bad choice.
  if (def?.section === "location" && key === "locality" && !cityChosen) return [...new Set(codes.map((code) => (code === "invalid" ? LOCALITY_NEEDS_CITY : mapLocationCodes(key, def.type, [code], fallback)[0])))];
  if (def?.section === "location") return mapLocationCodes(key, def.type, codes, fallback);
  return mapKnownCodes(codes, detailMessages(def), fallback);
}

/** The texts of the codes for a registry detail, by its type; a field the registry does not define has none (every code is generic). */
function detailMessages(def: FieldDef | undefined): Record<string, string> {
  return def && Object.hasOwn(DETAIL_MESSAGES, def.type) ? DETAIL_MESSAGES[def.type] : {};
}

/** The fields of `names` that cannot be changed now: the registry's identity fields while the Listing is published. */
function lockedOf(registry: Registry, status: string | null, names: string[]): string[] {
  return status === "published" ? names.filter((name) => registry.field(name)?.identity === true) : [];
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
  links,
  initial,
  signInPath,
  onSessionGone,
  onNotFound,
  fetchLatest,
  onStatusChange,
}: {
  /** Other ways into this listing, shown beside Preview. */
  links?: React.ReactNode;
  initial: ListingView;
  /** The page title follows the status: told whenever the Listing's status is known or changes. */
  onStatusChange?: (status: string | null) => void;
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
  // An image action is running: Save waits (and says so), so a field save never races an image change for the revision.
  const [imagesBusy, setImagesBusy] = useState(false);
  // The Draft is being deleted (Story 2.13): Save and the image actions wait, like the delete waits for them.
  const [deleting, setDeleting] = useState(false);
  // The Draft is being published (Story 2.15): Save, the image actions and Delete wait, like the publish waits for them.
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  // The status of the Listing is being changed (Story 2.17): Save, the image actions and the form wait, like the change waits for them.
  const [changingStatus, setChangingStatus] = useState(false);
  const statusRunning = useRef(false);
  // That change is the correction of the locality and area (Story 2.19): the status actions wait too.
  const [correcting, setCorrecting] = useState(false);
  // The outcome of a status change or the reason one did not happen: a polite note that stays mounted.
  const [statusNote, setStatusNote] = useState("");
  const statusNoteRef = useRef<HTMLParagraphElement>(null);
  const [statusNoteTick, setStatusNoteTick] = useState(0);
  // What a publish attempt was refused for (all at once): per field (shown next to it), per item without a control (form-level), the images.
  const [publishErrors, setPublishErrors] = useState<Fields>({});
  const [publishForm, setPublishForm] = useState<string[]>([]);
  const [publishTick, setPublishTick] = useState(0);
  const publishSummary = useRef<HTMLDivElement>(null);
  // Every edit of the form moves this, so a publish attempt after an edit gets a new Idempotency-Key.
  const [edits, setEdits] = useState(0);
  // After the Listing was published here ("done") or found published elsewhere ("elsewhere"): the note and the live announcement.
  const [publishedNote, setPublishedNote] = useState<"" | "done" | "elsewhere" | "republished_counted" | "republished_free" | "republished">("");
  const [conflict, setConflict] = useState<Conflict | null>(null);
  // The fields a problem between two fields (the floor rule) is shown under: editing either clears them all.
  const [linked, setLinked] = useState<string[]>([]);
  // Date fields that hold a partly typed date (the browser reports "" for them): Save is blocked until each is finished or cleared.
  const [incomplete, setIncomplete] = useState<string[]>([]);
  // Date inputs that hold a partly typed date right now (reported by the input itself): unsaved input, so Publish waits.
  const [partialDates, setPartialDates] = useState<string[]>([]);
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
  useEffect(() => {
    if (publishTick > 0) publishSummary.current?.focus();
  }, [publishTick]);
  useEffect(() => {
    if (statusNoteTick > 0) statusNoteRef.current?.focus();
  }, [statusNoteTick]);
  const reportStatus = useRef(onStatusChange);
  useEffect(() => {
    reportStatus.current = onStatusChange;
  });
  useEffect(() => {
    reportStatus.current?.(listing.status);
  }, [listing.status]);

  function showAlert(next: Alert) {
    resetAnnouncement();
    setInfo("");
    setAlert(next);
    setAlertTick((tick) => tick + 1);
  }

  const shown = registry ? shownFields(registry, listing, values.area_unit) : [];
  const detailDefs = registry ? shownDetails(registry, listing) : [];
  const detailIds = detailDefs.map((def) => def.id);
  // The reference lists load only when the registry gives this Draft location fields; the localities follow the city the form has now.
  const lists = useLocationLists(at(values, "city"), detailDefs.some((def) => def.section === "location"));
  // The amenity catalogue loads only when the registry gives this Draft the amenities field (Story 2.8).
  const catalogue = useAmenityCatalogue(detailDefs.some((def) => def.type === "amenities"));
  const controls: string[] = [...shown, ...detailIds];
  // While the Listing is published its identity fields (the registry's own flag) are read only: shown, never sent, never counted as changes.
  const lockedIds = registry ? lockedOf(registry, listing.status, controls) : [];
  const isLocked = (name: string) => lockedIds.includes(name);
  const baseline = toValues(listing);
  const dirty = controls.some((name) => !isLocked(name) && !same(name, at(values, name), at(baseline, name))) || partialDates.length > 0 || incomplete.length > 0;

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

  /**
   * A Listing an image change answered with (or a read after an upload or delete). When nothing but the images and the revision
   * moved, the page takes them as they are, so the next field save is checked against the right revision. When the fields
   * moved too (another session edited them), it is a field conflict like any other: the latest data loads and what was typed stays.
   */
  function applyImages(next: ListingView) {
    const current = listingRef.current;
    if (next.id !== current.id || !hasRevision(next)) return;
    if (current.revision !== null && next.revision < current.revision) return; // an older answer arriving late
    // The images answer (or a read after a refused image action) shows a Listing that can no longer be edited: explained, never silent.
    if (!isEditableListing(next.status, next.restricted) && isEditableListing(current.status, current.restricted)) {
      adoptNonEditable(next);
      return;
    }
    const before = toValues(current);
    const after = toValues(next);
    const unchanged =
      next.status === current.status &&
      keysOf(before, after).every((name) => at(before, name) === at(after, name)) &&
      JSON.stringify(current.fields) === JSON.stringify(next.fields);
    if (unchanged) {
      setListing((now) => ({ ...now, revision: next.revision, media: next.media, floorPlan: next.floorPlan }));
      return;
    }
    // Without the registry nothing can be compared: only the revision and the images move, typed values are never touched.
    if (registry) {
      applyConflict(next);
      return;
    }
    setListing((now) => (now.revision !== null && next.revision < now.revision ? now : { ...now, revision: next.revision, media: next.media, floorPlan: next.floorPlan }));
  }

  /** A date input says whether it is incomplete: a finished or cleared one drops its flag (the flag is only ever raised by Save). */
  function onDateInput(name: string, partial: boolean) {
    setPartialDates((current) => (partial ? (current.includes(name) ? current : [...current, name]) : current.includes(name) ? current.filter((other) => other !== name) : current));
    if (!partial) setIncomplete((current) => (current.includes(name) ? current.filter((other) => other !== name) : current));
  }

  function setValue(name: string, value: string) {
    if (publishingRef.current || statusRunning.current) return; // the form is read-only while the listing is published or its status changes
    if (lockedIds.includes(name)) return; // an identity field of a published listing is read only
    // Moving the unit away from marla and kanal drops what was typed for the basis (it is hidden and never sent; the server clears it).
    // Changing or clearing the City clears the Locality at once (the server does the same, so a stale pair is never saved).
    // Going back to the saved city within the same editing session brings the saved locality back; any other change empties it.
    const cityChanged = name === "city" && value !== at(valuesRef.current, "city") && at(valuesRef.current, "locality") !== "";
    setValues((current) => {
      let locality: { locality: string } | Record<string, never> = {};
      if (name === "city" && value !== at(current, "city")) {
        locality = { locality: value !== "" && value === at(baseline, "city") && at(current, "locality") === "" ? at(baseline, "locality") : "" };
      }
      return {
        ...current,
        [name]: value,
        ...(name === "area_unit" && !isMarlaUnit(value) ? { marla_basis: baseline.marla_basis } : {}),
        ...locality,
      };
    });
    if (cityChanged) announce(LOCALITY_CLEARED);
    setInfo("");
    setEdits((count) => count + 1);
    setPublishErrors((current) => {
      if (!current[name] && !(cityChanged && current.locality)) return current;
      const next = { ...current };
      delete next[name];
      if (cityChanged) delete next.locality;
      return next;
    });
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
      if (!current[name] && !(away && current.marla_basis) && !(cityChanged && current.locality) && !together.some((other) => current[other])) return current;
      const next = { ...current };
      delete next[name];
      for (const other of together) delete next[other]; // a floor problem belongs to both floor fields
      if (away) delete next.marla_basis; // its control goes: no error text and no summary link to it
      if (cityChanged) delete next.locality; // the cleared locality has no value an error could be about
      return next;
    });
  }

  /** A save succeeded: the answer is the new baseline; fields typed after the request keep what was typed. */
  function applySaved(answer: ListingView, submitted: Values) {
    // An answer older than what the page already holds (an image change landed after the request left) never moves the revision or
    // the images back: it brings its fields and keeps the newer revision and media.
    const held = listingRef.current;
    const next = held.revision !== null && answer.revision !== null && answer.revision < held.revision ? { ...answer, revision: held.revision, media: held.media, floorPlan: held.floorPlan } : answer;
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
  function applyConflict(latest: ListingView): boolean {
    if (!registry) return false;
    // Never go back to an older answer (revision and images only ever move forward).
    const held = listingRef.current;
    if (held.revision !== null && latest.revision !== null && latest.revision < held.revision) return false;
    const before = toValues(listingRef.current);
    const typed = valuesRef.current;
    const fresh = toValues(latest);
    // The basis row follows the unit the form will have: the owner's own when changed, else the latest one.
    const unitTyped = !same("area_unit", typed.area_unit, before.area_unit);
    const visible: string[] = [...shownFields(registry, latest, unitTyped ? typed.area_unit : fresh.area_unit), ...shownDetails(registry, latest).map((def) => def.id)];
    // The owner changed only the locality while another session moved the city (the server cleared or replaced the locality): the typed
    // locality belongs to the old city, so the latest pair is taken whole and the banner says so (never a stale city/locality pair).
    const localityLost =
      visible.includes("locality") &&
      same("city", at(typed, "city"), at(before, "city")) &&
      !same("city", at(fresh, "city"), at(before, "city")) &&
      !same("locality", at(typed, "locality"), at(before, "locality"));
    // A published listing's identity fields are read only: whatever was typed there (the form was built before it was published) is dropped.
    const lockedLatest = lockedOf(registry, latest.status, visible);
    const ownerChanged = visible.filter((name) => !lockedLatest.includes(name) && !(name === "locality" && localityLost) && !same(name, at(typed, name), at(before, name)));
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
      if (localityLost) merged.locality = at(fresh, "locality");
      for (const name of detailsLost) merged[name] = at(fresh, name);
      for (const name of lockedLatest) merged[name] = at(fresh, name);
      // Codes the catalogue does not list that the latest saved map no longer holds are dropped from what was typed (they could only be refused).
      if (catalogue.status === "ready" && Object.hasOwn(merged, "amenities")) merged.amenities = pruneStale(merged.amenities, at(fresh, "amenities"), catalogue.items);
      return merged;
    });
    setListing(latest);
    setConflict({ fields: differing, kept: [] });
    setLinked([]);
    setFieldErrors({});
    setFormErrors([]);
    setPublishErrors({});
    setPublishForm([]);
    showAlert({
      kind: "conflict",
      text: [
        differing.length === 0 && !elsewhere && !basisLost && !localityLost && detailsLost.length === 0 ? ALREADY_SAVED : CONFLICT_BANNER,
        basisLost ? BASIS_DROPPED : null,
        localityLost ? LOCALITY_DROPPED : null,
        detailsLost.length > 0 ? DETAILS_DROPPED : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
    return true;
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
    setEdits((count) => count + 1);
    setPublishErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
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
    // The latest city brings its own locality (a stale pair is never built).
    // A latest locality belongs to the latest city: taking it brings the latest city too, so no stale pair is built.
    const extra: Values = away
      ? { marla_basis: fresh.marla_basis }
      : name === "city"
        ? { locality: at(fresh, "locality") }
        : name === "locality" && latest !== "" && at(valuesRef.current, "city") !== at(fresh, "city")
          ? { city: at(fresh, "city") }
          : {};
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

  /**
   * The server says the revision sent is not the current one (a save or a publish answered 409 `stale_revision`): the Listing it
   * carries (or a fresh read when it carries none) becomes the baseline beside what was typed, with the conflict choices.
   */
  async function handleStale(error: unknown, baseRevision: number): Promise<void> {
    const current = typeof error === "object" && error !== null ? readListing((error as { current?: unknown }).current) : null;
    const usable = hasRevision(current) && current.id === listing.id && current.revision > baseRevision ? current : null;
    if (usable) {
      if (!isEditableListing(usable.status, usable.restricted)) return adoptNonEditable(usable);
      if (!applyConflict(usable)) showAlert({ kind: "notice", text: LATEST_NOT_LOADED });
      return;
    }
    // No usable data in the answer: read the Draft again and keep what was typed.
    const again = await fetchLatest();
    if (again.kind === "found" && hasRevision(again.listing)) {
      if (!isEditableListing(again.listing.status, again.listing.restricted)) return adoptNonEditable(again.listing);
      if (!applyConflict(again.listing)) showAlert({ kind: "notice", text: LATEST_NOT_LOADED });
      return;
    }
    if (again.kind === "gone") return await onSessionGone();
    if (again.kind === "missing") return onNotFound();
    showAlert({ kind: "notice", text: LATEST_NOT_LOADED });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !registry || deleting || publishingRef.current || statusRunning.current) return;
    if (imagesBusy) {
      announce(SAVE_WAIT);
      return;
    }
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
    const fields: Record<string, string | number | boolean | AmenityMap | null> = {};
    // A code the active catalogue does not list and the latest saved map no longer holds (another session removed it) would make the backend
    // refuse the whole map; omitting it is always allowed, so it is not sent.
    const sendValues: Values = { ...values };
    if (catalogue.status === "ready" && Object.hasOwn(values, "amenities")) sendValues.amenities = pruneStale(values.amenities, at(baseline, "amenities"), catalogue.items);
    for (const name of shown) if (!isLocked(name) && !same(name, values[name], baseline[name])) fields[name] = sentValue(values[name]);
    for (const def of detailDefs) if (!isLocked(def.id) && !same(def.id, at(sendValues, def.id), at(baseline, def.id))) fields[def.id] = sentDetail(def, at(sendValues, def.id));
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
      if (response.status === 409) return await handleStale(error, baseRevision);
      const parsed = response.status === 400 ? readErrorBody(error) : null;
      // A refused identity field while this page still thinks the Listing is not published: it may have been published elsewhere. The
      // answer is shown as usual, and the Listing is read again: when its status moved, the page takes it (the field is then locked).
      const maybePublished =
        parsed !== null && listing.status !== "published" && Object.entries(parsed.fields).some(([key, codes]) => codes.includes("not_editable") && registry.field(key)?.identity === true);
      if (parsed) {
        const mapped: Fields = {};
        const general: string[] = [];
        const together: string[] = [];
        let imagesRefused: string | null = null;
        for (const [key, codes] of Object.entries(parsed.fields)) {
          if (codes.length === 0) continue;
          // A published edit that would leave the listing without an image (the same refusal as publishing) shows next to the images too.
          if (key === "images") {
            imagesRefused = codes.includes("images_required") ? IMAGES_REQUIRED_ERROR : REJECTED_ERROR;
            general.push(`Images: ${imagesRefused}`);
            continue;
          }
          // A locked identity field of a published listing (a stale form): its own words, never the generic one.
          if (listing.status === "published" && codes.includes("not_editable") && registry.field(key)?.identity === true) {
            if (controls.includes(key)) mapped[key] = [IDENTITY_LOCKED_ERROR];
            else general.push(IDENTITY_LOCKED_ERROR);
            continue;
          }
          // Known codes only: any other sentence, code or key is generic, never the server's text. A field with no
          // control on this form goes to the form-level list, so the summary never points at a hidden control.
          if (isFieldName(key) && shown.includes(key)) mapped[key] = mapKnownCodes(codes, EDIT_FIELD_MESSAGES[key]);
          else if (isFieldName(key)) general.push(...mapKnownCodes(codes, EDIT_FIELD_MESSAGES[key], REJECTED_ERROR));
          else if (detailIds.includes(key)) {
            mapped[key] = codeTexts(registry.field(key), key, codes, GENERIC_FIELD_MESSAGE, at(submitted, "city") !== "");
            for (const code of codes) if (Object.hasOwn(CROSS_FIELD_GROUPS, code)) together.push(...CROSS_FIELD_GROUPS[code]);
          } else general.push(...codeTexts(registry.field(key), key, codes, REJECTED_ERROR));
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
        setPublishErrors(imagesRefused ? { images: [imagesRefused] } : {}); // one summary at a time: the save's replaces a publish one
        setPublishForm([]);
        setLinked(linkedNow);
        setFormErrors(general);
        focusSummary();
        announce("The form has errors. Review the list at the top of the page.");
        if (maybePublished) {
          const again = await fetchLatest();
          if (again.kind === "found" && hasRevision(again.listing) && again.listing.status !== listingRef.current.status) applyConflict(again.listing);
        }
        return;
      }
      if (response.status === 403) {
        // The page may be stale: a listing sold, rented, removed or restricted meanwhile refuses edits. Read it again first.
        const again = await fetchLatest();
        if (again.kind === "found" && hasRevision(again.listing) && !isEditableListing(again.listing.status, again.listing.restricted)) return adoptNonEditable(again.listing);
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

  /** The text of one code a publish attempt was refused with, for the control `key` (known codes only: anything else is generic). */
  function publishText(key: string, code: string): string {
    if (code === "confirm_required") return CONFIRM_REQUIRED_ERROR;
    if (key === "images") return code === "images_required" ? IMAGES_REQUIRED_ERROR : GENERIC_FIELD_MESSAGE;
    if (isFieldName(key)) return mapKnownCodes([code], EDIT_FIELD_MESSAGES[key])[0];
    if (Object.hasOwn(LISTING_FIELD_MESSAGES, key)) return mapKnownCodes([code], LISTING_FIELD_MESSAGES[key as keyof typeof LISTING_FIELD_MESSAGES])[0];
    return codeTexts(registry?.field(key), key, [code], GENERIC_FIELD_MESSAGE, at(valuesRef.current, "city") !== "")[0];
  }

  /**
   * A publish attempt was refused with a list of problems (400), all at once. Each shows next to its control (the images next to the
   * Images section) and in the summary at the top; an item with no control here (Purpose, Category, Subtype, a field this form does not
   * show) goes to the summary only. Header problems (key, revision) are not the owner's to fix: they alone are not shown here.
   */
  function showPublishErrors(fields: Fields, mode: PublishMode): boolean {
    const mapped: Fields = {};
    const general: string[] = [];
    for (const [key, codes] of Object.entries(fields)) {
      if (codes.length === 0 || ["idempotency_key", "base_revision", "non_field_errors"].includes(key)) continue;
      const texts = [...new Set(codes.map((code) => publishText(key, code)))];
      if (key === "images" || controls.includes(key)) mapped[key] = texts;
      else general.push(`${labelOf(key, listing.fields.category)}: ${texts.map((text) => (text === CONFIRM_REQUIRED_ERROR ? CONFIRM_NO_CONTROL : text)).join(" ")}`);
    }
    if (Object.keys(mapped).length === 0 && general.length === 0) return false;
    resetAnnouncement();
    setInfo("");
    setAlert(null);
    setFieldErrors({}); // one summary at a time: the publish one replaces a save one
    setFormErrors([]);
    setLinked([]);
    setPublishErrors(mapped);
    setPublishForm(general);
    setPublishTick((tick) => tick + 1);
    announce(mode === "republish" ? REPUBLISH_ERRORS_ANNOUNCE : PUBLISH_ERRORS_ANNOUNCE);
    return true;
  }

  /** The Listing as the server holds it now becomes the page: the form starts again from it and every old error and choice goes. */
  function adoptLatest(next: ListingView) {
    setListing(next);
    setValues(toValues(next));
    setPublishErrors({});
    setPublishForm([]);
    setConflict(null);
    setAlert(null);
    setFieldErrors({});
    setFormErrors([]);
    setLinked([]);
    setIncomplete([]);
    resetAnnouncement();
    setInfo("");
  }

  /** The Listing is published (200): the page switches to the published state, announces it, and re-reads the allowance. */
  function onPublished(next: ListingView, kind: PublicationKind | null, mode: PublishMode) {
    adoptLatest(next);
    setStatusNote("");
    setPublishedNote(mode === "republish" ? (kind === "republish_counted" ? "republished_counted" : kind === "republish_free" ? "republished_free" : "republished") : "done");
  }

  /** The server says it is not a draft (409 `conflict`): read it again; a published one switches the page to its published state. */
  async function publishConflict(mode: PublishMode): Promise<"published" | "unchanged" | "handled"> {
    const expected = mode === "republish" ? "archived" : "draft";
    const latest = await fetchLatest();
    if (latest.kind === "gone") {
      await onSessionGone();
      return "handled";
    }
    if (latest.kind === "missing") {
      onNotFound();
      return "handled";
    }
    if (latest.kind === "found") {
      // Still a draft (a claim without a result, a race that was undone): nothing is published, the page and its revision stay as they are.
      if (latest.listing.status === expected) return "unchanged";
      adoptStatusOnly(latest.listing);
      if (latest.listing.status === "published" && !latest.listing.restricted) setPublishedNote("elsewhere");
      else if (mode === "republish") explainRepublishGone(latest.listing);
      return "published";
    }
    showAlert({ kind: "notice", text: LATEST_NOT_LOADED });
    return "handled";
  }

  /** A republication found the listing sold, rented, removed or restricted: say what it is now and why Republish is gone (in the status note). */
  function explainRepublishGone(next: ListingView) {
    if (isEditableListing(next.status, next.restricted) && next.status !== "published") return; // still editable and not archived-gone: nothing vanished
    if (next.status === "published" && !next.restricted) return;
    sayStatus(republishGoneText(next.restricted ? "restricted" : label(next.status).toLowerCase()));
  }

  /** A republication answered a plain 403: read the listing again; a restricted one is explained (true), anything else is a generic refusal (false). */
  async function republishForbidden(): Promise<boolean> {
    const latest = await fetchLatest();
    if (latest.kind === "gone") {
      await onSessionGone();
      return true;
    }
    if (latest.kind === "missing") {
      onNotFound();
      return true;
    }
    if (latest.kind === "found" && latest.listing.restricted) {
      adoptStatusOnly(latest.listing);
      explainRepublishGone(latest.listing);
      return true;
    }
    return false;
  }

  /** A publish answered `stale_revision`: a Listing that is no longer a draft (it was published meanwhile) is the "published elsewhere" outcome; otherwise the conflict flow. */
  async function publishStale(error: unknown, baseRevision: number, mode: PublishMode): Promise<void> {
    const current = typeof error === "object" && error !== null ? readListing((error as { current?: unknown }).current) : null;
    if (current && current.id === listing.id && hasRevision(current) && current.status !== null && (current.status !== (mode === "republish" ? "archived" : "draft") || (mode === "republish" && current.restricted))) {
      adoptStatusOnly(current);
      if (current.status === "published" && !current.restricted) setPublishedNote("elsewhere");
      else if (mode === "republish") explainRepublishGone(current);
      return;
    }
    await handleStale(error, baseRevision);
  }

  /** "Confirm this value": saves just that field with the value it has (the backend stores a re-sent Assistant value as confirmed). */
  async function confirmValue(name: string) {
    if (submitting.current || publishingRef.current || pending || imagesBusy || deleting || !registry) return;
    const base = listing.revision;
    if (base === null) {
      showAlert({ kind: "notice", text: REJECTED_ERROR });
      return;
    }
    const def = registry.field(name);
    const saved = toValues(listing);
    const value = isFieldName(name) ? sentValue(at(saved, name)) : def ? sentDetail(def, at(saved, name)) : null;
    submitting.current = true;
    setPending(true);
    resetAnnouncement();
    try {
      const api = await getApi();
      const body = { base_revision: base, fields: { [name]: value } } as components["schemas"]["ListingUpdateRequest"];
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) => api.PATCH("/api/v1/listings/{listing_id}", { params: { path: { listing_id: listing.id } }, body, headers: { "X-CSRFToken": csrf }, signal })),
      );
      if (response.ok) {
        const next = readListing(data);
        if (hasRevision(next) && next.id === listing.id) {
          applySaved(next, saved); // what was typed in other fields stays
          setPublishErrors((current) => {
            const rest = { ...current };
            delete rest[name];
            return rest;
          });
          setInfo("");
          setAnnouncement(CONFIRMED);
          return;
        }
        showAlert({ kind: "notice", text: SERVER_ERROR });
        return;
      }
      if (response.status === 401) return await onSessionGone();
      if (response.status === 404) return onNotFound();
      if (response.status === 409) return await handleStale(error, base);
      showAlert({ kind: "notice", text: response.status === 400 ? REJECTED_ERROR : failureMessage(response.status, response.headers.get("Retry-After")) });
    } catch (thrown) {
      showAlert({ kind: "notice", text: thrownMessage(thrown) });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  /** The server says the Listing is not a draft (a delete answered 409): read it again so the status and the controls are right. */
  async function refreshAfterConflict() {
    const latest = await fetchLatest();
    if (latest.kind === "gone") await onSessionGone();
    else if (latest.kind === "missing") onNotFound();
    else if (latest.kind === "found") adoptStatusOnly(latest.listing);
  }

  /** Says something about the status in the polite note that stays mounted, and takes the focus once (the button that was used is gone). */
  function sayStatus(text: string) {
    setStatusNote(text);
    setStatusNoteTick((tick) => tick + 1);
  }

  /** The status was changed (200): the page switches to the new status and announces it. */
  function onStatusChanged(next: ListingView, target: StatusTarget) {
    adoptLatest(next);
    setPublishedNote("");
    sayStatus(STATUS_ACTIONS[target].done);
  }

  /** The locality or area was corrected (200): the page takes the Listing and announces it. */
  function onCorrected(next: ListingView) {
    adoptLatest(next);
    setPublishedNote("");
    sayStatus(CORRECTION_DONE);
  }

  /** A correction was refused because the page is out of date or the window is closed: read the Listing again and say why. */
  async function correctionRefused(text: string): Promise<void> {
    const latest = await fetchLatest();
    if (latest.kind === "gone") return await onSessionGone();
    if (latest.kind === "missing") return onNotFound();
    if (latest.kind !== "found" || !hasRevision(latest.listing)) return sayStatus(STATUS_CONFLICT_NOT_LOADED);
    if (!isEditableListing(latest.listing.status, latest.listing.restricted)) return adoptNonEditable(latest.listing);
    adoptLatest(latest.listing);
    setPublishedNote("");
    sayStatus(text);
  }

  /** The Listing is no longer one the owner may edit (sold, rented, removed, restricted): it is shown view only and the typed changes are said to be gone. */
  function adoptNonEditable(next: ListingView) {
    const hadChanges = dirty;
    adoptLatest(next);
    setPublishedNote("");
    sayStatus(lostEditsText(next.restricted ? "restricted" : label(next.status).toLowerCase(), hadChanges));
  }

  /**
   * The Listing's status (or restriction) moved while the page was open (a publish or delete answered 409): the new status, revision, images and
   * restriction are taken and what was typed stays. A Listing that can no longer be edited is explained (`adoptNonEditable`) instead.
   */
  function adoptStatusOnly(next: ListingView) {
    if (!isEditableListing(next.status, next.restricted)) {
      adoptNonEditable(next);
      return;
    }
    const held = listingRef.current;
    setListing((now) => ({ ...now, status: next.status, revision: next.revision, media: next.media, floorPlan: next.floorPlan, restricted: next.restricted, restrictionReason: next.restrictionReason, underReview: next.underReview }));
    // The identity fields lock once published: whatever was typed there goes back to the saved value.
    if (registry && next.status === "published") {
      const saved = toValues(held);
      setValues((current) => {
        const merged = { ...current };
        for (const def of registry.fieldList()) if (def.identity && Object.hasOwn(saved, def.id)) merged[def.id] = at(saved, def.id);
        return merged;
      });
    }
  }

  /** The Listing now holds `target`? Then the move happened (a lost answer, a double submit): it is a success. */
  function movedTo(next: ListingView, target: StatusTarget): boolean {
    return next.status === target;
  }

  /** What changed under a status action that did not go through, in words: the status now, and whether the move is still possible. */
  function explainStatus(next: ListingView, target: StatusTarget): string {
    const allowed = targetsFor(next.status, next.fields.purpose, next.restricted, account?.state === "suspended").includes(target);
    return statusChangedText(next.restricted ? "restricted" : label(next.status).toLowerCase(), target, allowed);
  }

  /** The move is not allowed any more (409 `conflict`): read the Listing again, show it as it is and say what happened. */
  async function statusConflict(target: StatusTarget): Promise<void> {
    const latest = await fetchLatest();
    if (latest.kind === "gone") return await onSessionGone();
    if (latest.kind === "missing") return onNotFound();
    if (latest.kind === "found" && hasRevision(latest.listing)) {
      adoptLatest(latest.listing);
      setPublishedNote("");
      sayStatus(movedTo(latest.listing, target) ? STATUS_ACTIONS[target].done : explainStatus(latest.listing, target));
      return;
    }
    sayStatus(STATUS_CONFLICT_NOT_LOADED);
  }

  /** The status change answered `stale_revision`: a Listing whose status moved is shown as it is (and a move that already happened is a success); otherwise the usual conflict flow. */
  async function statusStale(error: unknown, baseRevision: number, target: StatusTarget): Promise<void> {
    const current = typeof error === "object" && error !== null ? readListing((error as { current?: unknown }).current) : null;
    if (current && current.id === listing.id && hasRevision(current) && current.revision > baseRevision && (current.status !== listing.status || current.restricted !== listing.restricted)) {
      adoptLatest(current);
      setPublishedNote("");
      sayStatus(movedTo(current, target) ? STATUS_ACTIONS[target].done : explainStatus(current, target));
      return;
    }
    await handleStale(error, baseRevision);
  }

  // Draft, Published and Archived listings are edited; Sold, Rented, Removed and restricted ones (and any status this page does not know) are view only.
  const editable = isEditableListing(listing.status, listing.restricted);
  const price = listing.fields.asking_price === null ? NOT_SET : `PKR ${formatPrice(listing.fields.asking_price)}`;
  const detailSummary = registry ? answeredDetails(detailDefs, listing) : [];
  const areaDirty = shown.some((name) => AREA_FIELDS.includes(name) && !same(name, values[name], baseline[name]));
  const derivedBase = derivedText(listing.fields);
  // The figure is the saved one: while area input is unsaved it must not read as describing that input.
  const derived = derivedBase && areaDirty ? `${derivedBase} (saved figure, updates after you save)` : derivedBase;
  const shownErrors: Fields = { ...fieldErrors };
  for (const name of incomplete) shownErrors[name] = [...(shownErrors[name] ?? []), INCOMPLETE_DATE];
  // The images error goes once the Draft has an image; every other publish error goes when its field is edited.
  const shownPublish: Fields = { ...publishErrors };
  if (listing.media.length > 0) delete shownPublish.images;
  const fieldPublish = Object.fromEntries(Object.entries(shownPublish).filter(([name]) => name !== "images")) as Fields;
  const hasPublishErrors = Object.keys(shownPublish).length > 0 || publishForm.length > 0;
  const hasErrors = formErrors.length > 0 || Object.keys(shownErrors).length > 0;
  // What each control shows: its save errors and its publish errors (the edit summary lists only the first, the publish summary the second).
  const controlErrors: Fields = { ...shownErrors };
  for (const [name, texts] of Object.entries(fieldPublish)) controlErrors[name] = [...new Set([...(controlErrors[name] ?? []), ...texts])];
  const showConflict = (name: string) =>
    conflict !== null &&
    conflict.fields.includes(name) &&
    !conflict.kept.includes(name) &&
    !(name === "marla_basis" && !isMarlaUnit(values.area_unit)) &&
    !same(name, at(values, name), at(baseline, name));

  function latestOf(name: string): string {
    if (isFieldName(name)) return latestText(name, baseline[name]);
    const def = registry?.field(name);
    if (def?.type === "reference" && def.reference !== null) {
      const latest = at(baseline, name);
      if (latest === "") return NOT_ANSWERED;
      if (def.reference === "locality") {
        // The localities loaded are those of the form's city: the latest one is only named from them while the latest city is that city.
        if (at(values, "city") !== at(baseline, "city")) return ANOTHER_LOCALITY;
        if (lists.locality.status === "loading" || lists.locality.status === "idle") return LOADING_VALUE;
      } else if (lists.city.status === "loading" || lists.city.status === "idle") return LOADING_VALUE;
      return lists.nameOf(def.reference, latest) ?? SAVED_CHOICE_GONE;
    }
    if (def?.type === "amenities") {
      if (at(baseline, name) === "") return NOT_ANSWERED;
      if (catalogue.status === "ready") return amenityGroupedSummary(at(baseline, name), catalogue.items);
      return catalogue.status === "idle" || catalogue.status === "loading" ? CATALOGUE_LOADING_LINE : CATALOGUE_UNAVAILABLE_LINE;
    }
    return def ? latestDetail(def, at(baseline, name)) : at(baseline, name) || NOT_SET;
  }

  /** The summary rows of the saved amenities: one per kind (Nearby tagged seller-declared), "Other" for codes the list no longer holds. */
  function amenityRows() {
    const text = at(toValues(listing), "amenities");
    if (text === "") return null;
    const map = decodeAmenities(text);
    if (catalogue.status !== "ready") {
      return (
        <div>
          <dt>Amenities</dt>
          <dd data-testid="draft-amenities">{catalogue.status === "idle" || catalogue.status === "loading" ? CATALOGUE_LOADING_LINE : CATALOGUE_UNAVAILABLE_LINE}</dd>
        </div>
      );
    }
    const states = (codes: string[]) =>
      (["present", "none"] as const)
        .map((state) => {
          const names = codes.filter((code) => map[code] === state).map((code) => amenityLabel(code, catalogue.items));
          return names.length > 0 ? `${STATE_TEXT[state]}: ${names.join(", ")}.` : "";
        })
        .filter(Boolean)
        .join(" ");
    const other = otherCodes(text, catalogue.items);
    return (
      <>
        {KIND_ORDER.map((kind) => {
          const codes = answeredOfKind(text, catalogue.items, kind).map((item) => item.code);
          if (codes.length === 0) return null;
          return (
            <div key={kind}>
              <dt>{KIND_TITLES[kind]}</dt>
              <dd data-testid={`draft-amenities-${kind}`}>
                {states(codes)}
                {kind === "nearby" && (
                  <>
                    <span className="sr-only">. </span>
                    <span className="declared-tag declared-tag-inline" data-testid="draft-amenities-nearby-tag">
                      {SELLER_DECLARED}
                    </span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
        {other.length > 0 && (
          <div>
            <dt>Other amenities</dt>
            <dd data-testid="draft-amenities-other">{states(other)}</dd>
          </div>
        )}
      </>
    );
  }

  /** The Confirm button under a field the publish attempt refused for an unconfirmed Assistant value (only a field with a control). */
  function confirmRow(name: string) {
    if (!fieldPublish[name]?.includes(CONFIRM_REQUIRED_ERROR)) return null;
    const busy = pending || imagesBusy || deleting || publishing ? true : undefined;
    return (
      <div className="flex flex-wrap gap-2" data-testid={`confirm-${name}`}>
        <button type="button" className="secondary-button" aria-disabled={busy} onClick={() => void confirmValue(name)}>
          {CONFIRM_LABEL}
          <span className="sr-only"> for {actionLabelOf(name, listing.fields.category)}</span>
        </button>
      </div>
    );
  }
  const rowOf = (name: string) => (
    <>
      {conflictRow(name)}
      {confirmRow(name)}
    </>
  );

  /** The "Latest saved" line with its two actions, shown under a field whose typed value differs from the latest one. */
  function conflictRow(name: string) {
    if (!showConflict(name)) return null;
    const busy = pending ? true : undefined;
    return (
      <div className="mt-2" data-testid={`conflict-${name}`}>
        <p id={`${name}-latest`} className="hint">
          Latest saved{registry?.field(name)?.sellerDeclared ? ` (${SELLER_DECLARED.toLowerCase()})` : ""}: <span className="latest-value font-semibold whitespace-pre-wrap wrap-anywhere">{latestOf(name)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
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
    const errors = controlErrors[name];
    const common = { name, label: FIELD_LABELS[name], hint: (name === "marla_basis" ? MARLA_EXPLANATION : hintFor(def)) || undefined,
      errors,
      locked: isLocked(name) ? IDENTITY_NOTE_ID : undefined,
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
                readOnly={publishing || changingStatus || props.readOnly === true}
                value={values.title}
                onChange={(e) => setValue("title", e.target.value)}
              />
              {counter(name, def)}
              {rowOf(name)}
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
                readOnly={publishing || changingStatus || props.readOnly === true}
                value={values.description}
                onChange={(e) => setValue("description", e.target.value)}
              />
              {counter(name, def)}
              {rowOf(name)}
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
                <span className="money-prefix inline-flex items-center py-0 px-3 font-semibold text-muted bg-bg border border-border rounded-(--radius)" aria-hidden="true">
                  {def.currency ?? "PKR"}
                </span>
                <input
                  {...props}
                  aria-describedby={describedBy(name, props["aria-describedby"], false)}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  readOnly={publishing || changingStatus || props.readOnly === true}
                  value={values.asking_price}
                  onChange={(e) => setValue("asking_price", e.target.value)}
                />
              </div>
              {rowOf(name)}
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
                readOnly={publishing || changingStatus || props.readOnly === true}
                value={values.area_value}
                onChange={(e) => setValue("area_value", e.target.value)}
              />
              {rowOf(name)}
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
            {rowOf(name)}
          </>
        )}
      </Field>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {links}
        <Link href={`${LISTINGS_PATH}/${encodeURIComponent(listing.id)}/preview`} className="secondary-button inline-flex items-center justify-center no-underline" data-testid="draft-preview-link" aria-describedby={dirty ? "preview-hint" : undefined}>
          Preview
        </Link>
        {dirty && (
          <span id="preview-hint" className="hint mb-0" data-testid="preview-hint">
            {PREVIEW_SAVED_HINT}
          </span>
        )}
      </div>
      {/* The one announcement of the publish outcome: a visible status that stays mounted, so its text is announced once (it takes no focus). */}
      <p role="status" aria-live="polite" className={publishedNote ? "notice" : "sr-only"} data-testid="publish-live">
        {publishedNote === "done"
          ? PUBLISH_DONE
          : publishedNote === "elsewhere"
            ? PUBLISH_ELSEWHERE
            : publishedNote === "republished_counted"
              ? REPUBLISH_DONE_COUNTED
              : publishedNote === "republished_free"
                ? REPUBLISH_DONE_FREE
                : publishedNote === "republished"
                  ? REPUBLISH_DONE_UNKNOWN
                  : ""}
        {publishedNote !== "" && publishedNote !== "elsewhere" && <PublishedAllowance />}
      </p>
      {/* The one announcement of a status change (or of why it did not happen): a visible status that stays mounted; it takes the focus once. */}
      <p ref={statusNoteRef} tabIndex={-1} role="status" aria-live="polite" className={statusNote ? "notice" : "sr-only"} data-testid="status-live">
        {statusNote}
      </p>
      {hasPublishErrors && (listing.status === "draft" || listing.status === "archived") && (
        <ErrorSummary
          ref={publishSummary}
          order={["images", ...controls]}
          labels={{ images: "Images", ...Object.fromEntries(controls.map((name) => [name, labelOf(name, listing.fields.category)])) }}
          fieldErrors={shownPublish}
          formErrors={publishForm}
          titleId="publish-error-summary-title"
          targets={{ images: "images-add" }}
        />
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="editor-main grid min-w-0 gap-6">
      {listing.underReview && (
        <p className="state-note" data-testid="under-review">
          {UNDER_REVIEW_NOTE}
        </p>
      )}
      {!editable ? (
        <div className="notice" data-testid="draft-not-editable">
          <p>{listing.restricted ? RESTRICTED_NOTE : Object.hasOwn(READ_ONLY_NOTES, listing.status ?? "") ? READ_ONLY_NOTES[listing.status ?? ""] : READ_ONLY_FALLBACK}</p>
          {listing.restrictionReason !== null && (
            <p data-testid="restriction-reason">{restrictionReasonText(listing.restrictionReason)}</p>
          )}
          {listing.restricted && listing.status === "archived" && <p data-testid="republish-forbidden">{REPUBLISH_FORBIDDEN}</p>}
        </div>
      ) : (
        <>
      <ImagesSection
        listingId={listing.id}
        revision={listing.revision}
        media={listing.media}
        onListing={applyImages}
        protectLast={listing.status === "published"}
        locked={pending || deleting || publishing || changingStatus}
        publishError={shownPublish.images?.join(" ")}
        onBusyChange={setImagesBusy}
        refresh={fetchLatest}
        onSessionGone={onSessionGone}
        onNotFound={onNotFound}
      />
      <FloorPlanSection
        listingId={listing.id}
        floorPlan={listing.floorPlan}
        locked={pending || deleting || publishing || changingStatus}
        onListing={applyImages}
        onBusyChange={setImagesBusy}
        refresh={fetchLatest}
        onSessionGone={onSessionGone}
        onNotFound={onNotFound}
      />
      <section className="card" aria-labelledby="draft-edit-title">
        <h2 id="draft-edit-title" className="section-title">
          Edit details
        </h2>
        {listing.status === "archived" && (
          <p className="hint" data-testid="archived-note">
            {ARCHIVED_NOTE}
          </p>
        )}
        {lockedIds.length > 0 && (
          <p id={IDENTITY_NOTE_ID} className="hint" data-testid="identity-note">
            {PUBLISHED_IDENTITY_NOTE}
          </p>
        )}
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
            <form method="post" onSubmit={onSubmit} noValidate aria-busy={pending} className="editor-form">
              {shown
                .filter((name) => !AREA_FIELDS.includes(name))
                .map((name) => {
                  const def = registry.field(name);
                  return def ? <div key={name}>{control(name, def)}</div> : null;
                })}
              {shown.some((name) => AREA_FIELDS.includes(name)) && (
                <div role="group" aria-labelledby="area-title" data-testid="area-block" className="editor-area">
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
                errors={controlErrors}
                onDateInput={onDateInput}
                lists={lists}
                amenities={catalogue}
                purpose={purpose}
                category={listing.fields.category}
                subtype={listing.fields.subtype}
                locked={lockedIds}
                onChange={setValue}
                conflictRow={rowOf}
                inConflict={showConflict}
              />
              {imagesBusy && (
                <p id="save-paused" className="hint" data-testid="save-paused">
                  {SAVE_PAUSED}
                </p>
              )}
              {publishing && (
                <p className="hint" data-testid="publish-paused">
                  {PUBLISH_PAUSED}
                </p>
              )}
              {deleting && (
                <p className="hint" data-testid="delete-paused">
                  {DELETE_DRAFT_PAUSED}
                </p>
              )}
              {changingStatus && (
                <p className="hint" data-testid="status-paused">
                  {correcting ? CORRECTION_PAUSED : STATUS_PAUSED}
                </p>
              )}
              <button
                type="submit"
                className="primary-button min-h-12 justify-self-start px-8"
                aria-disabled={pending || imagesBusy || deleting || publishing || changingStatus ? true : undefined}
                aria-describedby={imagesBusy ? "save-paused" : undefined}
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
            </form>
          </>
        )}
      </section>
        </>
      )}
      </div>
      <aside className="grid min-w-0 gap-6 [&_.card]:mb-0">
      <section className="card" aria-labelledby="draft-details-title">
        <h2 id="draft-details-title" className="section-title">
          What exists so far
        </h2>
        <dl className="detail-list mb-0 gap-0 [&>div]:flex [&>div]:flex-wrap [&>div]:justify-between [&>div]:gap-x-3 [&>div]:border-t [&>div]:border-line [&>div]:py-2 [&_dd]:text-right [&_dd]:text-[0.9375rem]" data-testid="draft-details">
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
          {registry?.field("amenities")?.type === "amenities" && amenityRows()}
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
      {listing.status === "draft" && !listing.restricted && account?.state !== "suspended" && (
        <EstimateSection
          listingId={listing.id}
          stamp={JSON.stringify([listing.fields.area_value, listing.fields.area_unit, listing.fields.marla_basis, listing.details])}
          dirty={dirty}
          blocked={pending || deleting || publishing || changingStatus}
          onSessionGone={onSessionGone}
          onNotFound={onNotFound}
        />
      )}
      {listing.status === "draft" && !listing.restricted && (
        <PublishSection
          listingId={listing.id}
          revision={listing.revision}
          stamp={`${listing.revision}:${edits}`}
          dirty={dirty}
          blocked={pending || imagesBusy || deleting}
          saveRunning={() => submitting.current}
          onBusyChange={(busy) => {
            publishingRef.current = busy;
            setPublishing(busy);
          }}
          onSessionGone={onSessionGone}
          onNotFound={onNotFound}
          onInvalid={(fields) => showPublishErrors(fields, "publish")}
          onPublished={(next, kind) => onPublished(next, kind, "publish")}
          onStale={(error, base) => publishStale(error, base, "publish")}
          onConflict={() => publishConflict("publish")}
          formState={status === "ready" ? "ready" : status === "loading" ? "loading" : "error"}
        />
      )}
      {listing.status === "archived" && !listing.restricted && (
        <PublishSection
          mode="republish"
          listingId={listing.id}
          revision={listing.revision}
          stamp={`${listing.revision}:${edits}`}
          dirty={dirty}
          blocked={pending || imagesBusy || deleting || changingStatus}
          saveRunning={() => submitting.current}
          onBusyChange={(busy) => {
            publishingRef.current = busy;
            setPublishing(busy);
          }}
          onSessionGone={onSessionGone}
          onNotFound={onNotFound}
          onInvalid={(fields) => showPublishErrors(fields, "republish")}
          onPublished={(next, kind) => onPublished(next, kind, "republish")}
          onStale={(error, base) => publishStale(error, base, "republish")}
          onConflict={() => publishConflict("republish")}
          onForbidden={republishForbidden}
          formState={status === "ready" ? "ready" : status === "loading" ? "loading" : "error"}
        />
      )}
      {/* A Suspended owner cannot correct or republish, so neither the form nor the note is shown to one. */}
      {listing.status === "published" && !listing.restricted && account?.state !== "suspended" && (
        <CorrectionSection
          listing={listing}
          registry={registry}
          localities={lists.locality}
          dirty={dirty}
          blocked={pending || imagesBusy || (changingStatus && !correcting)}
          saveRunning={() => submitting.current}
          onBusyChange={(busy) => {
            statusRunning.current = busy;
            setChangingStatus(busy);
            setCorrecting(busy);
          }}
          onSessionGone={onSessionGone}
          onNotFound={onNotFound}
          onCorrected={onCorrected}
          onRefused={correctionRefused}
        />
      )}
      <StatusActions
        listingId={listing.id}
        revision={listing.revision}
        status={listing.status}
        purpose={listing.fields.purpose}
        restricted={listing.restricted}
        dirty={dirty}
        blocked={pending || imagesBusy || correcting}
        saveRunning={() => submitting.current}
        onBusyChange={(busy) => {
          statusRunning.current = busy;
          setChangingStatus(busy);
        }}
        onSessionGone={onSessionGone}
        onNotFound={onNotFound}
        onChanged={onStatusChanged}
        onStale={statusStale}
        onConflict={statusConflict}
      />
      <DeleteDraft
          listingId={listing.id}
          isDraft={listing.status === "draft" && !listing.restricted}
          blocked={pending || imagesBusy || publishing}
          saveRunning={() => submitting.current}
          onBusyChange={setDeleting}
          onSessionGone={onSessionGone}
          onConflict={() => void refreshAfterConflict()}
        />
      </aside>
      </div>
    </>
  );
}

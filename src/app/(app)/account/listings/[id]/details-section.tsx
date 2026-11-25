"use client";

import { Field } from "@/components/form-field";
import {
  NOT_ANSWERED,
  NOT_OFFERED_HINT,
  NO_LONGER_OFFERED,
  PRIVATE_ADDRESS,
  PRIVATE_ADDRESS_HELP,
  PUBLIC_LOCATION,
  PUBLIC_LOCATION_HELP,
  SELLER_DECLARED,
  SELLER_DECLARED_HELP,
  detailHint,
  detailLabel,
  groupDetails,
  notOffered,
  splitTerms,
  termsTitle,
} from "@/lib/listing-details";
import { choiceLabel, isIsoDate, isListingId } from "@/lib/listing-labels";
import {
  CHOOSE_CITY_FIRST,
  CITIES_EMPTY,
  CITIES_FAILED,
  CITIES_LOADING,
  LOCALITIES_EMPTY,
  LOCALITIES_FAILED,
  LOCALITIES_LOADING,
  SAVED_CHOICE_GONE,
} from "@/lib/listing-messages";
import type { AmenityCatalogue, LocationLists, RefState } from "@/lib/use-reference";
import type { FieldDef } from "@/lib/use-registry";
import { AmenitiesSection } from "./amenities-section";

/**
 * The generic "Details" section of the Draft editor: one control per registry field it is given, grouped by the registry's
 * requirement, each group a fieldset with its legend. It holds no state and no rules: the editor owns the values, the errors,
 * the comparison and the saving, and passes the conflict row for a field. A control follows the registry type (integer: a text
 * input for digits; boolean: Not answered, Yes, No; enum: Not answered first, then the registry's choices; decimal and money:
 * text inputs; date: a native date input whose value is the ISO text, with the registry's bounds as its `min` and `max`, and a text input
 * for a value that is not a real ISO date, so what was typed is shown and sent as it is for the server to judge). The registry fields marked
 * `section: terms` (Story 2.6) go in one "Terms for sale" or "Terms for rent" fieldset before the Details, grouped the same way. Stories
 * 2.5 and 2.6 add registry fields (and their labels), not code here. A registry field flagged `seller_declared` shows the
 * "Seller-declared" tag and its helper line (the owner's claim, never a platform check). The registry field of type `amenities` (Story 2.8) goes in its own Amenities block.
 */
export function DetailsSection({
  fields,
  values,
  saved,
  errors,
  purpose,
  category,
  subtype,
  onChange,
  conflictRow,
  inConflict,
  onDateInput,
  lists,
  amenities: amenityCatalogue,
}: {
  /** The amenity catalogue (Story 2.8), loaded when the registry gives this Draft the amenities field. */
  amenities: AmenityCatalogue;
  /** The reference lists of the location section (cities, and the localities of the city the form has now). */
  lists: LocationLists;
  fields: FieldDef[];
  values: Record<string, string>;
  /** The saved text of each detail: a saved value the form cannot offer stays selectable while it is the saved one. */
  saved: Record<string, string>;
  errors: Record<string, string[]>;
  purpose: string | null;
  category: string | null;
  subtype: string | null;
  onChange: (id: string, value: string) => void;
  conflictRow: (id: string) => React.ReactNode;
  inConflict: (id: string) => boolean;
  /** A date input reports whether it holds a partly typed date (`validity.badInput`): its value is "" then, which is not a clear. */
  onDateInput: (id: string, incomplete: boolean) => void;
}) {
  if (fields.length === 0) return null;
  const { terms, details, publicLocation, privateAddress, amenities } = splitTerms(fields);

  function control(def: FieldDef) {
    const id = def.id;
    const privateField = def.section === "location" && def.visibility !== "public";
    const value = Object.hasOwn(values, id) ? values[id] : "";
    const stale = notOffered(def, Object.hasOwn(saved, id) ? saved[id] : undefined, { fields: { purpose, subtype } });
    const hint = [detailHint(def), stale ? NOT_OFFERED_HINT : ""].filter(Boolean).join(" ");
    return (
      <Field
        name={id}
        label={detailLabel(id, category)}
        hint={hint || undefined}
        errors={errors[id]}
        declared={def.sellerDeclared ? { tag: SELLER_DECLARED, help: SELLER_DECLARED_HELP } : undefined}
      >
        {(props) => {
          const shared = {
            ...props,
            "aria-describedby": [props["aria-describedby"], inConflict(id) ? `${id}-latest` : null].filter(Boolean).join(" ") || undefined,
          };
          if (def.type === "boolean") {
            return (
              <>
                <select {...shared} value={value} onChange={(e) => onChange(id, e.target.value)}>
                  <option value="">{NOT_ANSWERED}</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                  {/* A saved answer that is neither Yes nor No (not representable here) stays selectable so it can be restored. */}
                  {Object.hasOwn(saved, id) && saved[id] !== "true" && saved[id] !== "false" && (
                    <option value={saved[id]}>{saved[id]} (stored value)</option>
                  )}
                </select>
                {conflictRow(id)}
              </>
            );
          }
          if (def.type === "enum") {
            const offered = def.valuesFor(purpose, subtype);
            // The saved value the registry no longer offers stays in the list, marked, for as long as it is the saved one, so the
            // owner who picks another option can still restore it.
            const kept = Object.hasOwn(saved, id) && saved[id] && !offered.includes(saved[id]) ? saved[id] : null;
            return (
              <>
                <select {...shared} value={value} onChange={(e) => onChange(id, e.target.value)}>
                  <option value="">{NOT_ANSWERED}</option>
                  {offered.map((choice) => (
                    <option key={choice} value={choice}>
                      {choiceLabel(id, choice)}
                    </option>
                  ))}
                  {kept !== null && <option value={kept}>{`${choiceLabel(id, kept)} ${NO_LONGER_OFFERED}`}</option>}
                </select>
                {conflictRow(id)}
              </>
            );
          }
          if (def.type === "reference" && def.reference !== null) {
            return (
              <>
                <ReferenceSelect def={def} shared={shared} value={value} saved={Object.hasOwn(saved, id) ? saved[id] : ""} savedCity={Object.hasOwn(saved, "city") ? saved.city : ""} values={values} lists={lists} onChange={(next) => onChange(id, next)} />
                {conflictRow(id)}
              </>
            );
          }
          if (def.type === "text") {
            return (
              <>
                <input {...shared} type="text" autoComplete="off" {...(privateField ? NO_ASSIST : {})} value={value} onChange={(e) => onChange(id, e.target.value)} />
                {conflictRow(id)}
              </>
            );
          }
          if (def.type === "date") {
            // The value is the ISO text itself (no Date anywhere). The input type follows the SAVED value, never the text being typed, so it
            // never changes under the person's fingers: a saved value that is not a real date (no real server holds one) stays a text input
            // until it is saved, because a native date input would blank it.
            const savedText = Object.hasOwn(saved, id) ? saved[id] : "";
            const native = savedText === "" || isIsoDate(savedText);
            const sync = (target: HTMLInputElement) => onDateInput(id, native && target.validity.badInput);
            return (
              <>
                <input
                  {...shared}
                  type={native ? "date" : "text"}
                  min={native ? (def.min ?? undefined) : undefined}
                  max={native ? (def.max ?? undefined) : undefined}
                  inputMode={native ? undefined : "numeric"}
                  placeholder={native ? undefined : "YYYY-MM-DD"}
                  autoComplete="off"
                  value={value}
                  onChange={(e) => {
                    onChange(id, e.target.value);
                    sync(e.target);
                  }}
                  onInput={(e) => sync(e.currentTarget)}
                  onKeyUp={(e) => sync(e.currentTarget)}
                  onBlur={(e) => sync(e.currentTarget)}
                />
                {conflictRow(id)}
              </>
            );
          }
          const input = (
            <input
              {...shared}
              type="text"
              inputMode={def.type === "integer" ? "numeric" : def.signed || def.min?.startsWith("-") || def.max?.startsWith("-") ? "text" : "decimal"}
              autoComplete="off"
              {...(privateField ? NO_ASSIST : {})}
              value={value}
              onChange={(e) => onChange(id, e.target.value)}
            />
          );
          return (
            <>
              {def.type === "money" ? (
                <div className="money-row">
                  <span className="money-prefix" aria-hidden="true">
                    {def.currency ?? "PKR"}
                  </span>
                  {input}
                </div>
              ) : (
                input
              )}
              {conflictRow(id)}
            </>
          );
        }}
      </Field>
    );
  }

  return (
    <>
      {(publicLocation.length > 0 || privateAddress.length > 0) && (
        <div data-testid="location-block">
          <h3 id="location-title" className="section-title">
            Location
          </h3>
          {publicLocation.length > 0 && (
            <fieldset className="location-group" data-testid="location-public" aria-describedby="location-public-help">
              <legend>
                <h4 className="group-title">{PUBLIC_LOCATION}</h4>
              </legend>
              <p id="location-public-help" className="hint">
                {PUBLIC_LOCATION_HELP}
              </p>
              {publicLocation.map((def) => (
                <div key={def.id}>{control(def)}</div>
              ))}
            </fieldset>
          )}
          {privateAddress.length > 0 && (
            <fieldset className="location-group location-private" data-testid="location-private" aria-describedby="location-private-help">
              <legend>
                <h4 className="group-title">{PRIVATE_ADDRESS}</h4>
              </legend>
              <p id="location-private-help" className="hint">
                {PRIVATE_ADDRESS_HELP}
              </p>
              {privateAddress.map((def) => (
                <div key={def.id}>{control(def)}</div>
              ))}
            </fieldset>
          )}
        </div>
      )}
      {terms.length > 0 && (
        <fieldset className="terms-block" data-testid="terms-block">
          <legend>
            <h3 id="terms-title" className="section-title">
              {termsTitle(purpose)}
            </h3>
          </legend>
          {groupDetails(terms).map((group) => (
            <fieldset key={group.key} className="terms-group" data-testid={`terms-${group.key}`}>
              <legend>{group.title}</legend>
              {group.fields.map((def) => (
                <div key={def.id}>{control(def)}</div>
              ))}
            </fieldset>
          ))}
        </fieldset>
      )}
      {details.length > 0 && (
        <div data-testid="details-block">
          <h3 id="details-title" className="section-title">
            Details
          </h3>
          {groupDetails(details).map((group) => (
            <fieldset key={group.key} className="detail-group" data-testid={`details-${group.key}`}>
              <legend>{group.title}</legend>
              {group.fields.map((def) => (
                <div key={def.id}>{control(def)}</div>
              ))}
            </fieldset>
          ))}
        </div>
      )}
      {amenities.length > 0 && (
        <AmenitiesSection
          value={Object.hasOwn(values, "amenities") ? values.amenities : ""}
          errors={errors.amenities}
          catalogue={amenityCatalogue}
          onChange={(next) => onChange("amenities", next)}
          conflictRow={conflictRow}
          inConflict={inConflict}
        />
      )}
    </>
  );
}

/** No browser help for the private address: no autocorrect, capitalisation or spell check (autocomplete is already off). */
const NO_ASSIST = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off" } as const;

/** The status line of a reference list: loading, empty or failed (with Retry that stays mounted while it reloads), nothing when it is usable. */
function ListStatus({ name, state, texts }: { name: string; state: RefState; texts: { loading: string; empty: string; failed: string } }) {
  const text = state.status === "loading" ? texts.loading : state.status === "empty" ? texts.empty : state.status === "error" ? texts.failed : "";
  const showRetry = state.status === "error" || state.retrying;
  return (
    <>
      <p id={`${name}-status`} role="status" className={text ? "hint" : "sr-only"} data-testid={`${name}-status`}>
        {text}
      </p>
      {showRetry && (
        <button type="button" id={`${name}-retry`} className="secondary-button" data-testid={`${name}-retry`} aria-disabled={state.retrying ? true : undefined} onClick={() => !state.retrying && state.retry()}>
          Retry<span className="sr-only"> loading {name === "city" ? "cities" : "localities"}</span>
        </button>
      )}
    </>
  );
}

/**
 * The control of a `reference` field: a real select. The city list is loaded for the form; the localities are those of the city the form
 * has now and are grouped Areas and Societies. The locality select is `aria-disabled` (never `disabled`, so it stays focusable and its
 * helper is reachable) and offers nothing but its placeholder until a city is chosen and the list has loaded. A saved value that is not
 * in the list stays selectable, marked, for as long as it is the saved one.
 */
function ReferenceSelect({
  def,
  shared,
  value,
  saved,
  savedCity,
  values,
  lists,
  onChange,
}: {
  def: FieldDef;
  /** The saved city: the saved locality is only offered while the form still has that city. */
  savedCity: string;
  shared: React.SelectHTMLAttributes<HTMLSelectElement>;
  value: string;
  saved: string;
  values: Record<string, string>;
  lists: LocationLists;
  onChange: (value: string) => void;
}) {
  const isCity = def.reference === "city";
  const state = isCity ? lists.city : lists.locality;
  const cityChosen = Object.hasOwn(values, "city") && isListingId(values.city);
  const usable = state.status === "ready" && (isCity || cityChosen);
  const known = (id: string) => state.items.some((item) => item.id === id);
  // The value (and the saved one while it differs) stays an option when the list does not hold it.
  // The saved locality belongs to the saved city: once the form's city moved away from it, it is no longer offered.
  const savedOffered = isCity || (cityChosen && values.city === savedCity);
  const extras = [...new Set([value, ...(savedOffered ? [saved] : [])].filter((id) => id !== "" && !known(id)))];
  const statusText = isCity
    ? { loading: CITIES_LOADING, empty: CITIES_EMPTY, failed: CITIES_FAILED }
    : { loading: LOCALITIES_LOADING, empty: LOCALITIES_EMPTY, failed: LOCALITIES_FAILED };
  const placeholder = !isCity && !cityChosen ? CHOOSE_CITY_FIRST : NOT_ANSWERED;
  const areas = state.items.filter((item) => item.kind === "area");
  const societies = state.items.filter((item) => item.kind === "society");
  const option = (item: { id: string; name: string }) => (
    <option key={item.id} value={item.id}>
      {item.name}
    </option>
  );
  return (
    <>
      <select
        {...shared}
        aria-disabled={usable ? undefined : true}
        aria-describedby={[shared["aria-describedby"], (isCity || cityChosen) && `${isCity ? "city" : "locality"}-status`].filter(Boolean).join(" ") || undefined}
        value={value}
        onChange={(e) => {
          // Choosing "Not answered" always works (even with an empty or failed list); choosing an item needs a usable list.
          if (usable || e.target.value === "") onChange(e.target.value);
        }}
      >
        <option value="">{placeholder}</option>
        {isCity ? state.items.map(option) : null}
        {!isCity && areas.length > 0 && <optgroup label="Areas">{areas.map(option)}</optgroup>}
        {!isCity && societies.length > 0 && <optgroup label="Societies">{societies.map(option)}</optgroup>}
        {extras.map((id) => (
          <option key={id} value={id}>
            {state.status === "loading" ? "Loading…" : SAVED_CHOICE_GONE}
          </option>
        ))}
      </select>
      {(isCity || cityChosen) && <ListStatus name={isCity ? "city" : "locality"} state={state} texts={statusText} />}
    </>
  );
}

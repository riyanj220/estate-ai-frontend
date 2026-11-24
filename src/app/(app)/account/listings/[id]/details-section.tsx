"use client";

import { Field } from "@/components/form-field";
import { NOT_ANSWERED, NOT_OFFERED_HINT, NO_LONGER_OFFERED, SELLER_DECLARED, SELLER_DECLARED_HELP, detailHint, detailLabel, groupDetails, notOffered, splitTerms, termsTitle } from "@/lib/listing-details";
import { choiceLabel, isIsoDate } from "@/lib/listing-labels";
import type { FieldDef } from "@/lib/use-registry";

/**
 * The generic "Details" section of the Draft editor: one control per registry field it is given, grouped by the registry's
 * requirement, each group a fieldset with its legend. It holds no state and no rules: the editor owns the values, the errors,
 * the comparison and the saving, and passes the conflict row for a field. A control follows the registry type (integer: a text
 * input for digits; boolean: Not answered, Yes, No; enum: Not answered first, then the registry's choices; decimal and money:
 * text inputs; date: a native date input whose value is the ISO text, with the registry's bounds as its `min` and `max`, and a text input
 * for a value that is not a real ISO date, so what was typed is shown and sent as it is for the server to judge). The registry fields marked
 * `section: terms` (Story 2.6) go in one "Terms for sale" or "Terms for rent" fieldset before the Details, grouped the same way. Stories
 * 2.5 and 2.6 add registry fields (and their labels), not code here. A registry field flagged `seller_declared` shows the
 * "Seller-declared" tag and its helper line (the owner's claim, never a platform check).
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
}: {
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
  const { terms, details } = splitTerms(fields);

  function control(def: FieldDef) {
    const id = def.id;
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
              inputMode={def.type === "integer" ? "numeric" : "decimal"}
              autoComplete="off"
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
    </>
  );
}

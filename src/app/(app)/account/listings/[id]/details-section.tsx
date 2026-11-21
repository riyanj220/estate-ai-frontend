"use client";

import { Field } from "@/components/form-field";
import { NOT_ANSWERED, detailHint, detailLabel, groupDetails } from "@/lib/listing-details";
import { choiceLabel } from "@/lib/listing-labels";
import type { FieldDef } from "@/lib/use-registry";

/**
 * The generic "Details" section of the Draft editor: one control per registry field it is given, grouped by the registry's
 * requirement, each group a fieldset with its legend. It holds no state and no rules: the editor owns the values, the errors,
 * the comparison and the saving, and passes the conflict row for a field. A control follows the registry type (integer: a text
 * input for digits; boolean: Not answered, Yes, No; enum: Not answered first, then the registry's choices; decimal and money:
 * text inputs). Stories 2.5 and 2.6 add registry fields (and their labels), not code here.
 */
export function DetailsSection({
  fields,
  values,
  saved,
  errors,
  purpose,
  onChange,
  conflictRow,
  inConflict,
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  /** The saved text of each detail: a saved value the form cannot offer stays selectable while it is the saved one. */
  saved: Record<string, string>;
  errors: Record<string, string[]>;
  purpose: string | null;
  onChange: (id: string, value: string) => void;
  conflictRow: (id: string) => React.ReactNode;
  inConflict: (id: string) => boolean;
}) {
  if (fields.length === 0) return null;

  function control(def: FieldDef) {
    const id = def.id;
    const value = Object.hasOwn(values, id) ? values[id] : "";
    return (
      <Field name={id} label={detailLabel(id)} hint={detailHint(def) || undefined} errors={errors[id]}>
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
            const offered = def.valuesFor(purpose);
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
                  {kept !== null && <option value={kept}>{choiceLabel(id, kept)} (no longer offered)</option>}
                </select>
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
    <div data-testid="details-block">
      <h3 id="details-title" className="section-title">
        Details
      </h3>
      {groupDetails(fields).map((group) => (
        <fieldset key={group.key} className="detail-group" data-testid={`details-${group.key}`}>
          <legend>{group.title}</legend>
          {group.fields.map((def) => (
            <div key={def.id}>{control(def)}</div>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

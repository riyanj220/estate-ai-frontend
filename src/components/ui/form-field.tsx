"use client";

import { useState } from "react";

export type InputProps = {
  id: string;
  name: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
  /** Set while the field cannot be changed (see `locked`): read only, never disabled, so it stays reachable and is announced as read only. */
  readOnly: true | undefined;
  "aria-readonly": true | undefined;
};

/** A labelled field with an optional hint and its error text, wired with aria-describedby. */
export function Field({
  name,
  label,
  hint,
  errors,
  declared,
  locked,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  /** Seller-declared text next to the label and its helper line (Story 2.5); the owner's claim, never a platform check. */
  declared?: { tag: string; help: string };
  /** The id of the note that explains why the field cannot be changed (a published listing, Story 2.17): the control is read only and described by it. */
  locked?: string;
  children: (props: InputProps) => React.ReactNode;
}) {
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  const declaredId = `${name}-declared`;
  const tagId = `${name}-declared-tag`;
  const describedBy = [declared ? tagId : null, declared ? declaredId : null, hint ? hintId : null, errors?.length ? errorId : null, locked ?? null].filter(Boolean).join(" ");
  return (
    <div className="field">
      {declared ? (
        <div className="label-row">
          <label htmlFor={name}>{label}</label>
          <span id={tagId} className="declared-tag" data-testid={`${name}-seller-declared`}>
            {declared.tag}
          </span>
        </div>
      ) : (
        <label htmlFor={name}>{label}</label>
      )}
      {declared && (
        <p id={declaredId} className="hint" data-testid={`${name}-declared-help`}>
          {declared.help}
        </p>
      )}
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={errorId} className="field-error">
          <span className="sr-only">Error: </span>
          {errors.join(" ")}
        </p>
      ) : null}
      {children({
        id: name,
        name,
        "aria-invalid": errors?.length ? true : undefined,
        "aria-describedby": describedBy || undefined,
        readOnly: locked ? true : undefined,
        "aria-readonly": locked ? true : undefined,
      })}
    </div>
  );
}

/** A password field (new by default; pass `autoComplete="current-password"` for the current one) with the show/hide control. The visibility state resets when the field unmounts. */
export function PasswordField({
  name = "password",
  label = "Password",
  value,
  onChange,
  errors,
  autoComplete = "new-password",
}: {
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  autoComplete?: "new-password" | "current-password";
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field name={name} label={label} errors={errors}>
      {(props) => (
        <div className="password-row">
          <input
            {...props}
            type={shown ? "text" : "password"}
            autoComplete={autoComplete}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="secondary-button"
            aria-pressed={shown}
            aria-controls={name}
            onClick={() => setShown((current) => !current)}
          >
            Show password
          </button>
        </div>
      )}
    </Field>
  );
}

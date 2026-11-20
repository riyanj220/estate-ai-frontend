"use client";

import { useState } from "react";

export type InputProps = {
  id: string;
  name: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
};

/** A labelled field with an optional hint and its error text, wired with aria-describedby. */
export function Field({
  name,
  label,
  hint,
  errors,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  children: (props: InputProps) => React.ReactNode;
}) {
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  const describedBy = [hint ? hintId : null, errors?.length ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
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
      })}
    </div>
  );
}

/** The new-password field with the show/hide control. The visibility state resets when the field unmounts. */
export function PasswordField({
  name = "password",
  label = "Password",
  value,
  onChange,
  errors,
}: {
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field name={name} label={label} errors={errors}>
      {(props) => (
        <div className="password-row">
          <input
            {...props}
            type={shown ? "text" : "password"}
            autoComplete="new-password"
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

/** The "There is a problem" summary: links to the invalid fields, then form-level messages. Focus it after a failed submit. */
export function ErrorSummary({
  ref,
  order,
  labels,
  fieldErrors,
  formErrors,
  titleId = "error-summary-title",
  targets = {},
}: {
  ref: React.Ref<HTMLDivElement>;
  order: string[];
  labels: Record<string, string>;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
  /** Overridable so two summaries on one page do not share an id. */
  titleId?: string;
  /** Element id to focus for a field when the field control itself is not the right (or a focusable) target. */
  targets?: Record<string, string>;
}) {
  const invalid = order.filter((name) => fieldErrors[name]?.length);
  return (
    <div ref={ref} tabIndex={-1} role="group" className="error-summary" aria-labelledby={titleId}>
      <h2 id={titleId} className="summary-title">
        There is a problem
      </h2>
      <ul>
        {invalid.map((name) => (
          <li key={name}>
            <a
              href={`#${targets[name] ?? name}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(targets[name] ?? name)?.focus();
              }}
            >
              {labels[name]}: {fieldErrors[name].join(" ")}
            </a>
          </li>
        ))}
        {formErrors.map((message, index) => (
          <li key={index}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

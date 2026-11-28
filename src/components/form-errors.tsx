/** Errors that belong to no field, as one plain line. Field errors show only under their own field. */
export function FormErrors({ ref, messages }: { ref: React.Ref<HTMLDivElement>; messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="mb-4 text-[0.875rem] font-semibold text-error" data-testid="form-errors">
      {messages.map((message, index) => (
        <p key={index}>{message}</p>
      ))}
    </div>
  );
}

/** After a failed submit: the first invalid field, or its Retry button when the control is unusable, or else the general message. */
export function focusFirstError(fallback: HTMLElement | null) {
  const field = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
  if (!field) return fallback?.focus();
  // A city list that failed to load offers Retry instead of a choice.
  const retry = field.id === "city_id" ? document.getElementById("city-retry") : null;
  (retry ?? (field.matches(":disabled") ? fallback : field))?.focus();
}

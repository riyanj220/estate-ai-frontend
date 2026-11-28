/** After a failed submit: the first invalid field, or its Retry button when the control is unusable, or else the general message. */
export function focusFirstError(fallback: HTMLElement | null) {
  const field = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
  if (!field) return fallback?.focus();
  // A city list that failed to load offers Retry instead of a choice.
  const retry = field.id === "city_id" ? document.getElementById("city-retry") : null;
  (retry ?? (field.matches(":disabled") ? fallback : field))?.focus();
}

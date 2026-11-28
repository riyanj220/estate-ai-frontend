/** The message box of a chat: it grows with what is typed, Enter sends and Shift with Enter starts a new line. */
export function Composer({
  id,
  label,
  box,
  value,
  onChange,
  onSubmit,
  problem,
  hint,
  busy,
  disabled,
  maxLength,
}: {
  id: string;
  label: string;
  box: React.Ref<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  problem: string;
  hint: string;
  busy: boolean;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={id}
          ref={box}
          rows={1}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          placeholder="Type a message…"
          aria-describedby={`${id}-hint ${id}-problem`}
          aria-invalid={problem ? true : undefined}
          className="field-sizing-content max-h-40 min-h-12 w-full resize-none rounded-3xl border border-border bg-surface px-5 py-3 placeholder:text-muted aria-invalid:border-error"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
        />
        <button type="submit" className="primary-button min-h-12 shrink-0 px-6" aria-disabled={busy ? true : undefined}>
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      <p id={`${id}-hint`} className="mt-1 px-2 text-[0.75rem] text-muted">
        {hint}
      </p>
      <p id={`${id}-problem`} role="alert" className="field-error px-2 empty:mb-0">
        {problem}
      </p>
    </form>
  );
}

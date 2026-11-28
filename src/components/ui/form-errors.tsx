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

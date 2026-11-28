/** One message in a chat: the reader's own on the right, the other side's on the left, with who and when underneath. */
export function Bubble({ mine, meta, children, testId }: { mine: boolean; meta: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <li className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid={testId}>
      <div className={`max-w-[85%] rounded-3xl px-4 py-2.5 whitespace-pre-wrap wrap-anywhere ${mine ? "rounded-br-md bg-accent text-white" : "rounded-bl-md border border-line bg-surface"}`}>{children}</div>
      <p className="mt-1 px-2 text-[0.75rem] text-muted">{meta}</p>
    </li>
  );
}

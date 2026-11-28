/** Three dots that rise in turn while the other side is writing. Decorative: say what is happening in text beside it. */
export function TypingDots() {
  return (
    <span aria-hidden="true" className="inline-flex gap-1">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-2 animate-bounce rounded-full bg-accent/60" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

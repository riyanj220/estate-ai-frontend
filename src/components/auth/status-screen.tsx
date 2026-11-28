import Link from "next/link";

const ICONS = {
  mail: "M3 6h18v12H3zM3.5 7l8.5 6.5L20.5 7",
  done: "M5 12.5l4.5 4.5L19 7.5",
};

/** The outcome of an emailed step: one mark, one heading, a short explanation and what to do next. */
export function StatusScreen({
  icon,
  title,
  headingRef,
  children,
  action,
  below,
}: {
  icon: keyof typeof ICONS;
  title: string;
  headingRef: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
  action: { href: string; label: string };
  below?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center py-4 text-center" aria-labelledby="result-title">
      <span className="mb-6 flex size-18 items-center justify-center rounded-full bg-accent-soft text-accent">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONS[icon]} />
        </svg>
      </span>
      <h1 id="result-title" tabIndex={-1} ref={headingRef} className="page-title mb-3 tracking-[-0.02em] focus-visible:outline-none">
        {title}
      </h1>
      <div className="mb-8 grid max-w-96 gap-3 text-muted">{children}</div>
      <Link href={action.href} className="primary-button flex min-h-13 w-full items-center justify-center">
        {action.label}
      </Link>
      {below && <div className="mt-4">{below}</div>}
    </section>
  );
}

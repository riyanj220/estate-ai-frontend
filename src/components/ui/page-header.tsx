/** The head of a signed-in screen: what it is, one line about it, and its main actions on the right. */
export function PageHeader({ title, eyebrow, children, actions }: { title: string; eyebrow?: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="app-wide mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="page-title mb-0 tracking-[-0.02em]">{title}</h1>
        {children && <div className="mt-2 text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

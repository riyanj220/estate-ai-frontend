import { shortPkr } from "@/components/valuation/money";

/** The asking price and the estimate as two bars on one scale from zero. */
export function AskingVsEstimate({ asking, estimate }: { asking: number; estimate: number }) {
  const largest = Math.max(asking, estimate);
  const rows = [
    { name: "Asking price", value: asking, tone: "bg-border" },
    { name: "AI estimate", value: estimate, tone: "bg-accent" },
  ];
  return (
    <dl className="grid gap-3">
      {rows.map((row) => (
        <div key={row.name} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 text-[0.8125rem]">
          <dt className="text-muted">{row.name}</dt>
          <dd aria-hidden="true" className="h-2.5 rounded-sm bg-sand">
            <div className={`h-full rounded-r-sm ${row.tone}`} style={{ width: `${(row.value / largest) * 100}%` }} />
          </dd>
          <dd className="font-semibold">{shortPkr(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

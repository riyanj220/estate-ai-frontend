"use client";

import { useState } from "react";
import { shortPkr } from "@/components/valuation/money";
import type { Forecast } from "@/lib/listing/estimate";

/**
 * The three forecast scenarios year by year. The server compounds one yearly rate per scenario over the whole horizon, so a year in
 * between is that same rate compounded for fewer years; nothing else is made up here. The line is the middle scenario, the band spans
 * low to high.
 */
export function ForecastChart({ estimate, forecast }: { estimate: number; forecast: Forecast }) {
  const [year, setYear] = useState(forecast.years);
  const after = (end: number, years: number) => estimate * (end / estimate) ** (years / forecast.years);
  const points = Array.from({ length: forecast.years + 1 }, (_, years) => ({
    years,
    low: after(Number(forecast.low), years),
    base: after(Number(forecast.base), years),
    high: after(Number(forecast.high), years),
  }));
  const top = Number(forecast.high) * 1.04;
  const bottom = Math.min(estimate, Number(forecast.low)) * 0.9;
  const x = (years: number) => (years / forecast.years) * 100;
  const y = (value: number) => 100 - ((value - bottom) / (top - bottom)) * 100;
  const line = (key: "low" | "base" | "high") => points.map((point) => `${x(point.years)},${y(point[key])}`);
  const chosen = points[year];
  const name = (years: number) => (years === 0 ? "Today" : `Year ${years}`);

  return (
    <figure className="mt-3">
      {/* What the pointer or the keyboard is on. */}
      <figcaption className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
        <span className="font-semibold text-text">{name(chosen.years)}</span>
        <span>Middle {shortPkr(chosen.base)}</span>
        {chosen.years > 0 && (
          <span>
            Range {shortPkr(chosen.low)} to {shortPkr(chosen.high)}
          </span>
        )}
      </figcaption>
      <div className="relative h-44 border-b border-line">
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          {[25, 50, 75].map((at) => (
            <line key={at} x1="0" x2="100" y1={at} y2={at} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <polygon points={[...line("high"), ...line("low").reverse()].join(" ")} className="fill-accent/15" />
          <polyline points={line("base").join(" ")} fill="none" className="stroke-accent" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <line x1={x(year)} x2={x(year)} y1="0" y2="100" className="stroke-border" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>
        {[25, 50, 75].map((at) => (
          <span key={at} aria-hidden="true" className="absolute left-0 -translate-y-full text-[0.6875rem] text-muted" style={{ top: `${at}%` }}>
            {shortPkr(bottom + ((100 - at) / 100) * (top - bottom))}
          </span>
        ))}
        <span
          aria-hidden="true"
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
          style={{ left: `${x(year)}%`, top: `${y(chosen.base)}%` }}
        />
        <div className="absolute inset-y-0 -inset-x-[10%] grid" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
          {points.map((point) => (
            <button
              key={point.years}
              type="button"
              className="cursor-crosshair focus-visible:bg-accent/10"
              aria-label={`${name(point.years)}: middle PKR ${shortPkr(point.base)}, from ${shortPkr(point.low)} to ${shortPkr(point.high)}`}
              aria-pressed={point.years === year}
              onPointerEnter={() => setYear(point.years)}
              onFocus={() => setYear(point.years)}
              onClick={() => setYear(point.years)}
            />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-between text-[0.75rem] text-muted">
        {points.map((point) => (
          <span key={point.years}>{name(point.years)}</span>
        ))}
      </div>
    </figure>
  );
}

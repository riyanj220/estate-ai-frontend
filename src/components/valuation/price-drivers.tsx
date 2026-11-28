import type { Driver } from "@/lib/listing/estimate";

const NAMES: Record<string, string> = {
  locality: "Location",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  covered_area: "Covered area",
  building_age: "Age of the building",
  condition: "Condition",
  corner_plot: "Corner plot",
  road_width: "Road width",
  development: "Development status",
  amenities: "Amenities",
};

/**
 * What moves the estimate: one bar per detail, out from a middle line, right when it raises the price and left when it lowers it. The
 * figure is always written beside the bar, with an arrow word, so nothing rests on colour alone.
 */
export function PriceDrivers({ drivers }: { drivers: Driver[] }) {
  const largest = Math.max(...drivers.map((driver) => Math.abs(Number(driver.percent))));
  return (
    <ul className="mt-3 grid gap-3" data-testid="price-drivers">
      {drivers.map((driver) => {
        const percent = Number(driver.percent);
        const up = percent > 0;
        const share = (Math.abs(percent) / largest) * 50;
        return (
          <li key={driver.factor} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_5.5rem] items-center gap-3 text-[0.8125rem]">
            <span className="font-medium">{NAMES[driver.factor] ?? driver.factor}</span>
            <span aria-hidden="true" className="relative h-2.5 rounded-sm bg-sand">
              <span
                className={`absolute inset-y-0 ${up ? "left-1/2 rounded-r-sm bg-accent" : "right-1/2 rounded-l-sm bg-[#b7791f]"}`}
                style={{ width: `${share}%` }}
              />
              <span className="absolute -inset-y-1 left-1/2 w-px bg-border" />
            </span>
            <span className="text-right font-semibold tabular-nums">
              <span aria-hidden="true">{up ? "↑ " : "↓ "}</span>
              <span className="sr-only">{up ? "raises by " : "lowers by "}</span>
              {Math.abs(percent).toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

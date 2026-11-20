"use client";

import { Field } from "@/components/form-field";
import { CITIES_ERROR, NO_CITIES, type Cities } from "@/lib/use-cities";

/**
 * The City select with its loading, empty and failed states (the list comes from `useCities`). `current` is a stored
 * city that may no longer be in the active list: it stays selectable as a disabled option so the form still saves
 * other edits.
 */
export function CityField({
  cities,
  value,
  onChange,
  errors,
  onRetry,
  current,
}: {
  cities: Cities;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  onRetry: () => void;
  current?: string;
}) {
  const initialLoad = cities.loading && cities.result === null;
  const reloading = cities.loading && cities.result !== null;
  const describedBy = ["city-status", errors?.length ? "city_id-error" : null].filter(Boolean);
  const showCurrent = Boolean(current) && !initialLoad && !cities.items.some((city) => city.id === current);
  return (
    <Field name="city_id" label="City" errors={errors}>
      {(props) => (
        <>
          {/* Always mounted so a focused Retry button never disappears; announcements use the form's live region. */}
          <p id="city-status" tabIndex={-1} className="hint">
            {cities.result === "error" && (
              <>
                {CITIES_ERROR}{" "}
                <button
                  type="button"
                  id="city-retry"
                  className="secondary-button"
                  aria-disabled={reloading}
                  onClick={() => {
                    if (!reloading) onRetry();
                  }}
                >
                  Retry
                </button>
              </>
            )}
            {cities.result === "empty" && NO_CITIES}
          </p>
          <select
            {...props}
            aria-describedby={describedBy.join(" ") || undefined}
            required
            disabled={initialLoad}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {initialLoad ? (
              <option value="">Loading cities</option>
            ) : (
              <>
                <option value="" disabled>
                  Select a city
                </option>
                {showCurrent && (
                  <option value={current} disabled>
                    {cities.result === "error" ? "Current city" : "Current city (no longer available)"}
                  </option>
                )}
                {cities.items.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </>
      )}
    </Field>
  );
}

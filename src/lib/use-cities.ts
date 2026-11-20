"use client";

import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";

export type City = { id: string; name: string };
// `result` is null until the first load completes; `loading` is true during any load.
export type Cities = { loading: boolean; result: "ready" | "error" | "empty" | null; items: City[] };
type CityResult = { result: "ready" | "error" | "empty"; items: City[] };

export const NO_CITIES = "No cities are available right now.";
export const CITIES_ERROR = "We could not load the list of cities.";

// Keeps only well-formed, unique cities; a 200 with items that are all malformed is a failed load.
function readCities(data: unknown): CityResult {
  const raw = typeof data === "object" && data !== null ? (data as { items?: unknown }).items : undefined;
  if (!Array.isArray(raw)) return { result: "error", items: [] };
  if (raw.length === 0) return { result: "empty", items: [] };
  const seen = new Set<string>();
  const items: City[] = [];
  for (const item of raw) {
    const { id, name } = (typeof item === "object" && item !== null ? item : {}) as { id?: unknown; name?: unknown };
    if (typeof id !== "string" || id === "" || typeof name !== "string" || name.trim() === "" || seen.has(id)) continue;
    seen.add(id);
    items.push({ id, name });
  }
  return items.length > 0 ? { result: "ready", items } : { result: "error", items: [] };
}

async function requestCities(): Promise<CityResult> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/reference/cities", { signal }));
    return response.ok ? readCities(data) : { result: "error", items: [] };
  } catch {
    return { result: "error", items: [] };
  }
}

/**
 * Loads the active cities (`GET /api/v1/reference/cities`) for a city select, shared by the agency registration form
 * and the agency business profile. Only the latest request may set the state, so a slow earlier answer cannot
 * overwrite a newer one. `onLoaded` runs after every load that produced an answer (a list or an empty list) so the
 * caller can drop a choice that is no longer in the list. After a `reload` focus goes to the select (or stays on the
 * Retry button when the load failed again).
 */
export function useCities({
  announce,
  onLoaded,
}: {
  announce: (message: string) => void;
  onLoaded?: (items: City[]) => void;
}) {
  const [cities, setCities] = useState<Cities>({ loading: true, result: null, items: [] });
  const request = useRef(0);
  const pendingFocus = useRef<"retry" | "select" | null>(null);
  const callbacks = useRef({ announce, onLoaded });
  useEffect(() => {
    callbacks.current = { announce, onLoaded };
  });

  function apply(ticket: number, next: CityResult, readyMessage?: string) {
    if (ticket !== request.current) return;
    // A failed load keeps the previous list; any other answer replaces it.
    setCities((current) => ({ loading: false, result: next.result, items: next.result === "error" ? current.items : next.items }));
    const { announce: say, onLoaded: loaded } = callbacks.current;
    if (next.result === "error") say(CITIES_ERROR);
    else if (next.result === "empty") say(NO_CITIES);
    else if (readyMessage) say(readyMessage);
    // After the announcements: a caller that announces a dropped choice replaces the generic message.
    if (next.result !== "error") loaded?.(next.items);
  }

  function reload(focus: "retry" | "select", readyMessage: string) {
    pendingFocus.current = focus;
    setCities((current) => ({ ...current, loading: true }));
    callbacks.current.announce("Loading cities.");
    const ticket = ++request.current;
    void requestCities().then((next) => apply(ticket, next, readyMessage));
  }

  useEffect(() => {
    const ticket = ++request.current;
    void requestCities().then((next) => apply(ticket, next));
    // Runs once on mount; `apply` uses only state setters and refs, so the first render's copy is fine.
  }, []);

  // After a reload the focused Retry button may be gone, so focus moves to the select (or stays on Retry on failure).
  useEffect(() => {
    if (cities.loading || !pendingFocus.current) return;
    const target = pendingFocus.current === "retry" && cities.result === "error" ? "city-retry" : "city_id";
    pendingFocus.current = null;
    document.getElementById(target)?.focus();
  }, [cities]);

  return { cities, reload };
}

/** The element an error-summary link to the city field should focus: the select unless it is disabled or the list failed. */
export function cityFocusTarget(cities: Cities): string {
  if (cities.loading && cities.result === null) return "city-status";
  return cities.result === "error" ? "city-retry" : "city_id";
}

const CITIES_ERROR_REQUIRED = "Cities could not be loaded. Retry above.";
const CITIES_LOADING_REQUIRED = "Cities are still loading. Try again in a moment.";

/** The text for a blank City: it says so when the list failed, is empty or is still loading, else `required`. */
export function cityRequiredMessage(cities: Cities, required: string): string {
  if (cities.result === "error") return CITIES_ERROR_REQUIRED;
  if (cities.result === "empty") return NO_CITIES;
  if (cities.result === null) return CITIES_LOADING_REQUIRED;
  return required;
}

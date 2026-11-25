"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { readErrorBody, withTimeout } from "@/lib/forms";
import { KIND_ORDER, isAmenityCode, type AmenityKind, type CatalogueItem } from "@/lib/amenities";
import { isListingId } from "@/lib/listing-labels";

/**
 * The reference lists the Location section chooses from (Story 2.7): the active cities and the localities of one city. They are public
 * data, read at runtime (never an enum, never stored). A list that cannot be trusted is a failed load, never a half-working select.
 */
export type RefItem = { id: string; name: string; kind: "area" | "society" | null };
/** `idle`: nothing to load yet (no city chosen). */
export type RefStatus = "idle" | "loading" | "ready" | "empty" | "error";
export type RefList = { status: RefStatus; items: RefItem[] };
export type RefState = RefList & { retry: () => void; retrying: boolean };
export type LocationLists = { city: RefState; locality: RefState; nameOf: (reference: "city" | "locality", id: string) => string | null };

/**
 * Fail-closed parsing: the body must hold an `items` list; an item needs a canonical uuid, a non-empty name of at most 80 characters and
 * (localities) a kind of `area` or `society`; a repeated id is dropped. A list with items where none is usable is an error.
 */
export function readReferenceItems(data: unknown, withKind: boolean): RefList {
  const raw = typeof data === "object" && data !== null ? (data as { items?: unknown }).items : undefined;
  if (!Array.isArray(raw)) return { status: "error", items: [] };
  if (raw.length === 0) return { status: "empty", items: [] };
  const seen = new Set<string>();
  const items: RefItem[] = [];
  for (const entry of raw) {
    const { id, name, kind } = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    if (typeof id !== "string" || !isListingId(id) || seen.has(id)) continue;
    if (typeof name !== "string" || name.trim() === "" || Array.from(name.trim()).length > 80) continue; // the limit counts code points of the trimmed name
    if (withKind && kind !== "area" && kind !== "society") continue;
    seen.add(id);
    items.push({ id, name: name.trim(), kind: withKind ? (kind as "area" | "society") : null });
  }
  return items.length > 0 ? { status: "ready", items } : { status: "error", items: [] };
}

async function fetchList(kind: "city" | "locality", parent: string | null): Promise<RefList> {
  try {
    const api = await getApi();
    if (kind === "city") {
      const { data, response } = await withTimeout((signal) => api.GET("/api/v1/reference/cities", { signal }));
      return response.ok ? readReferenceItems(data, false) : { status: "error", items: [] };
    }
    const { data, error, response } = await withTimeout((signal) =>
      api.GET("/api/v1/reference/cities/{city_id}/localities", { params: { path: { city_id: parent ?? "" } }, signal }),
    );
    // An unknown or inactive city has no localities to offer, but only the backend's own not_found answer says so: any other 404 (a proxy, an
    // HTML page) is a failed load with Retry.
    if (response.status === 404) return readErrorBody(error)?.code === "not_found" ? { status: "empty", items: [] } : { status: "error", items: [] };
    return response.ok ? readReferenceItems(data, true) : { status: "error", items: [] };
  } catch {
    return { status: "error", items: [] };
  }
}

function useReferenceList(kind: "city" | "locality", parent: string | null, enabled: boolean): RefState {
  const baseKey = `${kind}|${parent ?? ""}`;
  const [retried, setRetried] = useState<{ base: string; n: number }>({ base: "", n: 0 });
  const [done, setDone] = useState<{ key: string; list: RefList } | null>(null);
  const active = enabled && (kind === "city" || (parent !== null && isListingId(parent)));
  // Moving to another list forgets the retries of the previous one (K, then L, then K again is an ordinary load).
  if (retried.base !== baseKey && retried.n !== 0) setRetried({ base: baseKey, n: 0 });
  const attempt = retried.base === baseKey ? retried.n : 0;
  const key = active ? `${baseKey}|${attempt}` : null;
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    void fetchList(kind, parent).then((list) => {
      if (!cancelled) setDone({ key, list });
    });
    return () => {
      cancelled = true;
    };
  }, [key, kind, parent]);
  const retry = useCallback(() => setRetried({ base: baseKey, n: attempt + 1 }), [baseKey, attempt]);
  if (key === null) return { status: "idle", items: [], retry, retrying: false };
  if (done?.key !== key) return { status: "loading", items: [], retry, retrying: attempt > 0 };
  return { ...done.list, retry, retrying: false };
}

/** The city list (when `enabled`) and the localities of `cityId` (when it is a canonical id). */
export function useLocationLists(cityId: string, enabled: boolean): LocationLists {
  const city = useReferenceList("city", null, enabled);
  const locality = useReferenceList("locality", cityId === "" ? null : cityId, enabled);
  const nameOf = (reference: "city" | "locality", id: string) => (reference === "city" ? city : locality).items.find((item) => item.id === id)?.name ?? null;
  return { city, locality, nameOf };
}

/**
 * The amenity catalogue (Story 2.8, public `GET /api/v1/reference/amenities`): the items the Amenities section offers, in the order the
 * server lists them. Read at runtime, never an enum and never stored. Fail closed like the other lists: the body must hold an `items` list;
 * an item needs a code and a group that match the backend's token rule (`^[a-z][a-z0-9_]{1,47}$`), a label of 2 to 80 code points with no
 * surrounding space and a `kind` of `on_property`, `community` or `nearby`; ANY item that fails (or a repeated code) makes the load a failed one.
 */
export type AmenityCatalogueList = { status: RefStatus; items: CatalogueItem[] };
export type AmenityCatalogue = AmenityCatalogueList & { retry: () => void; retrying: boolean };

export function readAmenityCatalogue(data: unknown): AmenityCatalogueList {
  const raw = typeof data === "object" && data !== null ? (data as { items?: unknown }).items : undefined;
  if (!Array.isArray(raw)) return { status: "error", items: [] };
  if (raw.length === 0) return { status: "empty", items: [] };
  const seen = new Set<string>();
  const items: CatalogueItem[] = [];
  for (const entry of raw) {
    const { code, label, kind, group } = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    // Fail closed: one item that cannot be trusted makes the whole load a failure. Dropping it would turn an active code the owner
    // answered into an "Other" entry and hide it from the form.
    if (!isAmenityCode(code) || seen.has(code)) return { status: "error", items: [] };
    if (typeof label !== "string" || label !== label.trim() || Array.from(label).length < 2 || Array.from(label).length > 80) return { status: "error", items: [] };
    if (!KIND_ORDER.includes(kind as AmenityKind) || !isAmenityCode(group)) return { status: "error", items: [] };
    seen.add(code);
    items.push({ code, label, kind: kind as AmenityKind, group });
  }
  return { status: "ready", items };
}

async function fetchCatalogue(): Promise<AmenityCatalogueList> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/reference/amenities", { signal }));
    return response.ok ? readAmenityCatalogue(data) : { status: "error", items: [] };
  } catch {
    return { status: "error", items: [] };
  }
}

/** The catalogue, loaded once `enabled` (the registry gives this Draft the amenities field); Retry stays mounted while it reloads. */
export function useAmenityCatalogue(enabled: boolean): AmenityCatalogue {
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState<{ key: string; list: AmenityCatalogueList } | null>(null);
  // Set the moment Retry is accepted and cleared when its answer arrives: a second click in between adds no request.
  const busy = useRef(false);
  const key = enabled ? `amenities|${attempt}` : null;
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    void fetchCatalogue().then((list) => {
      if (cancelled) return;
      busy.current = false;
      setDone({ key, list });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  const retry = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setAttempt((current) => current + 1);
  }, []);
  if (key === null) return { status: "idle", items: [], retry, retrying: false };
  if (done?.key !== key) return { status: "loading", items: [], retry, retrying: attempt > 0 };
  return { ...done.list, retry, retrying: false };
}

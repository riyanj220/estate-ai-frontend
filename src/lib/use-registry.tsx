"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { useSession } from "@/lib/session";

/**
 * The part of the Field registry the Listing forms use: the purposes, the Categories and each Category's Subtypes, as the
 * server serves them (`GET /api/v1/registry`). Nothing about them is hard-coded in the frontend.
 */
export type Registry = {
  version: number;
  purposes: string[];
  categories: string[];
  /** The Subtypes of a Category; empty for an unknown Category. */
  subtypesOf: (category: string) => string[];
  /** The definition of one Listing field (Story 2.2), or undefined when the registry does not define it. */
  field: (id: string) => FieldDef | undefined;
  /** Every usable field definition, in the registry's own order (the Details section of the Draft editor is built from it). */
  fieldList: () => FieldDef[];
};

/**
 * One field definition as the editor uses it: the type, the requirement, the text limits, the money bounds, the allowed
 * values (for an enum, possibly narrowed by purpose) and where it applies. The frontend decides nothing from these beyond
 * which control to show and which hints to print; the server judges every value.
 */
export type FieldDef = {
  id: string;
  type: string;
  /** `required_for_publication`, `recommended` or `optional` (other values are treated as optional). */
  requirement: string;
  minLength: number | null;
  maxLength: number | null;
  /** Money, decimal and integer bounds and the money currency, as decimal text (never numbers; the server serves integer bounds as text too). */
  min: string | null;
  max: string | null;
  currency: string | null;
  /** The decimal places a decimal field allows (decimal fields only). */
  scale: number | null;
  /** A derived field is computed by the server and is never input (Story 2.3). */
  derived: boolean;
  /** The registry's short explanation of what a value means, when it documents one. */
  description: string | null;
  allowedValues: string[];
  /** The values a purpose allows: the purpose's own list when the registry narrows it, else every allowed value. */
  valuesFor: (purpose: string | null) => string[];
  /** Whether the field applies to a Listing of this purpose, Category and Subtype (an empty list means all). */
  appliesTo: (purpose: string | null, category: string | null, subtype: string | null) => boolean;
};

// Ids become element ids and option values: only simple tokens are accepted.
const isToken = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9_]+$/.test(value);
const tokens = (value: unknown): string[] | null => (Array.isArray(value) ? [...new Set(value.filter(isToken))] : null);
// An enum value is a token or a plain number written as text (the marla basis: "225", "272.25"); it stays text.
const isChoice = (value: unknown): value is string => isToken(value) || (typeof value === "string" && /^\d{1,4}(\.\d{1,2})?$/.test(value));
const choices = (value: unknown): string[] | null => (Array.isArray(value) ? [...new Set(value.filter(isChoice))] : null);

const limit = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null);
const decimalText = (value: unknown): string | null => (typeof value === "string" && /^\d{1,16}(\.\d{1,8})?$/.test(value) ? value : null);
const covers = (list: string[], value: string | null) => list.length === 0 || (value !== null && list.includes(value));

/** Reads the field definitions; an entry that is not usable is skipped, and a missing or odd list is simply no definitions. */
function readFields(value: unknown): Map<string, FieldDef> {
  const fields = new Map<string, FieldDef>();
  if (!Array.isArray(value)) return fields;
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const raw = entry as Record<string, unknown>;
    const { id, type, requirement } = raw;
    if (!isToken(id) || fields.has(id) || typeof type !== "string") continue;
    const allowed = choices(raw.allowed_values) ?? [];
    const narrowed = new Map<string, string[]>();
    if (typeof raw.allowed_values_by_purpose === "object" && raw.allowed_values_by_purpose !== null) {
      for (const [purpose, list] of Object.entries(raw.allowed_values_by_purpose)) {
        const values = choices(list);
        if (isToken(purpose) && values) narrowed.set(purpose, values);
      }
    }
    const applicability = typeof raw.applicability === "object" && raw.applicability !== null ? (raw.applicability as Record<string, unknown>) : {};
    const purposes = tokens(applicability.purposes) ?? [];
    const categories = tokens(applicability.categories) ?? [];
    const subtypes = tokens(applicability.subtypes) ?? [];
    fields.set(id, {
      id,
      type,
      requirement: typeof requirement === "string" ? requirement : "optional",
      minLength: limit(raw.min_length),
      maxLength: limit(raw.max_length),
      min: decimalText(raw.min),
      max: decimalText(raw.max),
      currency: typeof raw.currency === "string" && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : null,
      scale: typeof raw.scale === "number" && Number.isInteger(raw.scale) && raw.scale >= 1 && raw.scale <= 8 ? raw.scale : null,
      derived: raw.derived === true,
      description: typeof raw.description === "string" && raw.description.trim() ? raw.description : null,
      allowedValues: allowed,
      valuesFor: (purpose) => (purpose !== null && narrowed.has(purpose) ? (narrowed.get(purpose) ?? allowed) : allowed),
      appliesTo: (purpose, category, subtype) => covers(purposes, purpose) && covers(categories, category) && covers(subtypes, subtype),
    });
  }
  return fields;
}

/**
 * Validates the shape defensively: anything unexpected is a failed load, never a crash. Entries whose ids are not simple
 * tokens are skipped, and so is a Category left with no Subtype; no usable purpose or Category is a failed load.
 */
export function readRegistry(data: unknown): Registry | null {
  if (typeof data !== "object" || data === null) return null;
  const { version, taxonomy, fields: fieldList } = data as Record<string, unknown>;
  if (typeof version !== "number" || !Number.isFinite(version)) return null;
  if (typeof taxonomy !== "object" || taxonomy === null) return null;
  const { purposes, categories } = taxonomy as Record<string, unknown>;
  const purposeIds = tokens(purposes);
  if (!purposeIds || purposeIds.length === 0 || !Array.isArray(categories)) return null;
  const subtypes = new Map<string, string[]>();
  for (const entry of categories) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, subtypes: own } = entry as Record<string, unknown>;
    const list = tokens(own);
    if (!isToken(id) || subtypes.has(id) || !list || list.length === 0) continue;
    subtypes.set(id, list);
  }
  if (subtypes.size === 0) return null;
  const fields = readFields(fieldList);
  return {
    version,
    purposes: purposeIds,
    categories: [...subtypes.keys()],
    subtypesOf: (category) => subtypes.get(category) ?? [],
    field: (id) => fields.get(id),
    fieldList: () => [...fields.values()],
  };
}

export type RegistryState =
  | { status: "loading"; registry: null; retry: () => void; retrying: false; refetch: () => Promise<Registry | null> }
  | { status: "error"; registry: null; retry: () => void; retrying: boolean; refetch: () => Promise<Registry | null> }
  | { status: "ready"; registry: Registry; retry: () => void; retrying: false; refetch: () => Promise<Registry | null> };

type Answer = { kind: "ok"; registry: Registry } | { kind: "gone" } | { kind: "failed" };

/**
 * Fetches the registry once when the page loads (the browser keeps it by the server's ETag and cache header) and answers
 * `{status, registry, retry, refetch}`. A failure or a malformed answer is `error` with a Retry that stays mounted while
 * retrying; a `401` ends the session like on the other pages (to `signInPath`). `refetch` revalidates quietly (after the
 * server refused a choice a stale registry may explain) and keeps the current registry when it fails.
 */
export function useRegistry(signInPath: string): RegistryState {
  const router = useRouter();
  const { refresh } = useSession();
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; registry: Registry | null; retrying: boolean }>({
    status: "loading",
    registry: null,
    retrying: false,
  });
  const started = useRef(false);
  const ticket = useRef(0);
  const path = useRef(signInPath);
  useEffect(() => {
    path.current = signInPath;
  });

  const fetchRegistry = useCallback(async (revalidate: boolean): Promise<Answer> => {
    try {
      const api = await getApi();
      const { data, response } = await withTimeout((signal) =>
        api.GET("/api/v1/registry", { signal, ...(revalidate ? { cache: "no-cache" as const } : {}) }),
      );
      if (response.status === 401) return { kind: "gone" };
      const registry = response.ok ? readRegistry(data) : null;
      return registry ? { kind: "ok", registry } : { kind: "failed" };
    } catch {
      return { kind: "failed" };
    }
  }, []);

  const load = useCallback(async () => {
    const mine = ++ticket.current;
    const answer = await fetchRegistry(false);
    if (mine !== ticket.current) return;
    if (answer.kind === "gone") {
      await refresh();
      router.replace(path.current);
      return;
    }
    setState(answer.kind === "ok" ? { status: "ready", registry: answer.registry, retrying: false } : { status: "error", registry: null, retrying: false });
  }, [fetchRegistry, refresh, router]);

  useEffect(() => {
    // The ref guard keeps strict mode and re-renders to one read.
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  const retrying = useRef(false);
  const retry = useCallback(() => {
    if (retrying.current) return;
    retrying.current = true;
    setState({ status: "error", registry: null, retrying: true }); // the button stays mounted while reloading
    void load().finally(() => {
      retrying.current = false;
    });
  }, [load]);

  const refetch = useCallback(async (): Promise<Registry | null> => {
    const mine = ++ticket.current;
    const answer = await fetchRegistry(true);
    if (mine !== ticket.current) return null;
    if (answer.kind === "gone") {
      await refresh();
      router.replace(path.current);
      return null;
    }
    if (answer.kind !== "ok") return null;
    setState({ status: "ready", registry: answer.registry, retrying: false });
    return answer.registry;
  }, [fetchRegistry, refresh, router]);

  if (state.status === "ready" && state.registry) return { status: "ready", registry: state.registry, retry, retrying: false, refetch };
  if (state.status === "error") return { status: "error", registry: null, retry, retrying: state.retrying, refetch };
  return { status: "loading", registry: null, retry, retrying: false, refetch };
}

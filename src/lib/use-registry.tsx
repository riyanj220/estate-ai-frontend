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
};

// Ids become element ids and option values: only simple tokens are accepted.
const isToken = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9_]+$/.test(value);
const tokens = (value: unknown): string[] | null => (Array.isArray(value) ? [...new Set(value.filter(isToken))] : null);

/**
 * Validates the shape defensively: anything unexpected is a failed load, never a crash. Entries whose ids are not simple
 * tokens are skipped, and so is a Category left with no Subtype; no usable purpose or Category is a failed load.
 */
export function readRegistry(data: unknown): Registry | null {
  if (typeof data !== "object" || data === null) return null;
  const { version, taxonomy } = data as Record<string, unknown>;
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
  return {
    version,
    purposes: purposeIds,
    categories: [...subtypes.keys()],
    subtypesOf: (category) => subtypes.get(category) ?? [],
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

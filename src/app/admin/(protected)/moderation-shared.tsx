"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { withCsrf } from "@/lib/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useSession } from "@/lib/session";

/** Shared by the Reports and Listings administration screens (Epic 9). */
export const STATUS_LABELS = { draft: "Draft", published: "Published", archived: "Archived", sold: "Sold", rented: "Rented", removed: "Removed" } as const;

export const words = (value: string) => value.replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase());

export function shown(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, state]) => `${words(key)}: ${String(state)}`)
      .join(", ");
  }
  return String(value);
}

type Answer<T> = { data?: T; error?: unknown; response: Response };

/** A lost session goes to the admin sign-in; 404 on a read also means "not an administrator", so the server guard runs again. */
export function useSessionGone(next: string) {
  const router = useRouter();
  const { refresh } = useSession();
  return useCallback(async () => {
    await refresh();
    router.replace(`/admin/sign-in?next=${encodeURIComponent(next)}`);
  }, [next, refresh, router]);
}

/**
 * Runs one write at a time with the CSRF token. `field` names the body field whose error code goes to `invalid`; 409 goes to
 * `conflict`; 401 to `gone`; anything else becomes a sentence for `notice`.
 */
export function useAdminWrite(gone: () => Promise<void>, notice: (message: string) => void) {
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  async function write<T>(
    send: (csrf: string, signal: AbortSignal) => Promise<Answer<T>>,
    handlers: { done: (data: T) => void; field?: string; invalid?: (code: string) => void; conflict?: () => void },
  ) {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    notice("");
    try {
      const { data, error, response } = await withCsrf((csrf) => withTimeout((signal) => send(csrf, signal)));
      if (response.ok && data) return handlers.done(data);
      const code = response.status === 400 && handlers.field ? readErrorBody(error)?.fields?.[handlers.field]?.[0] : undefined;
      if (code && handlers.invalid) return handlers.invalid(code);
      if (response.status === 401) return await gone();
      if (response.status === 409 && handlers.conflict) return handlers.conflict();
      notice(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (thrown) {
      notice(thrownMessage(thrown));
    } finally {
      running.current = false;
      setWorking(false);
    }
  }
  return { working, write };
}

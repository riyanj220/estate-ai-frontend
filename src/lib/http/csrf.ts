import "client-only";
import { getApi } from "./api";
import { withTimeout } from "../forms/forms";

/** Thrown when the CSRF token could not be fetched; `status` is the HTTP status of the failed answer. */
export class CsrfFetchError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: string | null = null,
  ) {
    super("Could not fetch a CSRF token");
  }
}

// The token lives in memory only. The backend keeps the matching secret in an HttpOnly cookie.
let token: string | null = null;
let inFlight: Promise<string> | null = null;
let generation = 0;

export async function getCsrfToken(): Promise<string> {
  if (token) return token;
  if (inFlight) return inFlight; // concurrent callers share one fetch
  const mine = generation;
  const request = (async () => {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/csrf", { signal }));
    if (!response.ok || !data?.csrf_token) throw new CsrfFetchError(response.status, response.headers.get("Retry-After"));
    if (mine === generation) token = data.csrf_token; // a clear during the fetch discards this answer
    return data.csrf_token;
  })();
  inFlight = request;
  try {
    return await request;
  } finally {
    if (inFlight === request) inFlight = null;
  }
}

/** Drops the cached token (and ignores any fetch still in flight); the next call fetches a fresh one. */
export function clearCsrfToken(): void {
  token = null;
  inFlight = null;
  generation += 1;
}

/**
 * Runs an unsafe call with the CSRF token. A 403 means the token went stale (the backend rotates it at sign-in
 * and sign-out), so the token is refetched and the call is retried once; a second 403 is returned to the caller.
 * Retrying is safe for sign-in: the CSRF check rejects the request before the sign-in service runs, so the first
 * attempt never touched the backend's failure throttle and the retry cannot count twice.
 */
export async function withCsrf<R extends { response: Response }>(call: (csrfToken: string) => Promise<R>): Promise<R> {
  const first = await call(await getCsrfToken());
  if (first.response.status !== 403) return first;
  clearCsrfToken();
  return call(await getCsrfToken());
}

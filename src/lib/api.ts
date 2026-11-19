import createClient from "openapi-fetch";
import type { components, paths } from "@/api/schema";
import { backendUrl } from "./backend-url";

const SERVER_TIMEOUT_MS = 5000;

/**
 * The only place the API client is built.
 * - On the server it targets the backend directly and forwards the incoming cookie.
 * - In the browser it targets its own origin; Next.js proxies /api/* to Django.
 */
export async function getApi() {
  if (typeof window !== "undefined") {
    return createClient<paths>({ baseUrl: window.location.origin });
  }
  const { headers } = await import("next/headers");
  const cookie = (await headers()).get("cookie");
  return createClient<paths>({
    baseUrl: backendUrl(),
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
    // A backend that accepts the connection but never answers must not hang the page.
    fetch: (request: Request) => fetch(new Request(request, { signal: AbortSignal.timeout(SERVER_TIMEOUT_MS) })),
  });
}

type ErrorEnvelope = components["schemas"]["ErrorEnvelope"];
export type ErrorBody = ErrorEnvelope["error"];

/** Reads the standard error envelope from a failed response body; null when the body is not one. */
export function readErrorBody(body: unknown): ErrorBody | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = (body as { error: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const { message, fields } = error as Partial<ErrorBody>;
  if (typeof message !== "string") return null;
  const clean: Record<string, string[]> = {};
  if (typeof fields === "object" && fields !== null) {
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value)) clean[key] = value.filter((item): item is string => typeof item === "string");
    }
  }
  return { ...(error as ErrorBody), message, fields: clean };
}

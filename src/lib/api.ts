import createClient from "openapi-fetch";
import type { paths } from "@/api/schema";
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

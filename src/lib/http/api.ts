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
    // A backend that accepts the connection but never answers must not hang the page. A hard deadline that does not
    // depend on the abort being honoured (`AbortSignal.timeout` can be garbage collected before it fires, and an
    // aborted fetch was seen to stay pending in dev): the timer aborts the request and rejects with a TimeoutError.
    // The request's own signal is combined with the deadline, and the timer is cleared as soon as the request settles.
    fetch: (request: Request) =>
      new Promise<Response>((resolve, reject) => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
          controller.abort();
          reject(new DOMException("The backend did not answer in time.", "TimeoutError"));
        }, SERVER_TIMEOUT_MS);
        const signal = AbortSignal.any([request.signal, controller.signal]);
        fetch(new Request(request, { signal })).then(resolve, reject).finally(() => clearTimeout(timer));
      }),
  });
}

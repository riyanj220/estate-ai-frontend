import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Hands the requested path to the server-side guard (layouts cannot see it). It runs for every page request (not the
 * API proxy or framework assets) and always overwrites the header, so a client-supplied value never reaches the app.
 * Next.js's internal `_rsc` query parameter is dropped so it never ends up in a sign-in `next` target.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const params = new URLSearchParams(request.nextUrl.search);
  params.delete("_rsc");
  const query = params.toString();
  headers.set("x-requested-path", request.nextUrl.pathname + (query ? `?${query}` : ""));
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!api/|_next/).*)"] };

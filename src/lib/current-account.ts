import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Account } from "./account";
import { getApi } from "./api";

export type AccountCheck = { kind: "signed_in"; account: Account } | { kind: "signed_out" } | { kind: "unavailable" };

/** Asks the backend who the request belongs to (forwarding the cookie). Memoised for one render pass. */
export const checkAccount = cache(async (): Promise<AccountCheck> => {
  try {
    const api = await getApi();
    const { data, response } = await api.GET("/api/v1/me");
    if (response.ok && data) return { kind: "signed_in", account: data };
    if (response.status === 401) return { kind: "signed_out" };
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
});

/**
 * The requested path (with query), set by proxy.ts for every page request. The "/dashboard" fallback is a last resort
 * for a request that somehow bypassed the proxy; the sign-in page validates the target again anyway.
 */
async function requestedPath(): Promise<string> {
  return (await headers()).get("x-requested-path") ?? "/dashboard";
}

/**
 * Guard for signed-in pages. A Visitor is redirected to sign in (and returned afterwards). When the backend cannot
 * answer, `unavailable` is returned so the caller renders no protected content.
 */
export async function requireAccount(): Promise<{ kind: "signed_in"; account: Account } | { kind: "unavailable" }> {
  const check = await checkAccount();
  if (check.kind === "signed_out") redirect(`/sign-in?next=${encodeURIComponent(await requestedPath())}`);
  return check;
}

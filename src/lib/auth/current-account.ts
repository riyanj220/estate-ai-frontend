import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Account } from "../account/account";
import type { components } from "@/api/schema";
import { getApi } from "../http/api";
import { safeAdminNext } from "./next-target";

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
  if (check.kind === "signed_out") {
    const path = await requestedPath();
    // The shared password page, opened from the admin area, returns an administrator to the admin sign-in. Only the
    // exact marker `from=admin` counts; the admin sign-in validates its own target anyway.
    const url = new URL(path, "http://placeholder.invalid");
    if (url.pathname === "/account/password" && url.searchParams.get("from") === "admin") {
      redirect(`/admin/sign-in?next=${encodeURIComponent("/admin")}`);
    }
    redirect(`/sign-in?next=${encodeURIComponent(path)}`);
  }
  return check;
}

export type AdminMe = components["schemas"]["AdminMe"];
export type AdminCheck = { kind: "admin"; admin: AdminMe } | { kind: "not_admin" } | { kind: "unavailable" };

/**
 * Asks the backend whether the request belongs to an administrator (`GET /api/v1/admin/me`, forwarding the cookie).
 * `401` (Visitor) and `404` (non-administrator) are one answer, `not_admin`, so nothing tells them apart. Memoised for
 * one render pass.
 */
export const checkAdmin = cache(async (): Promise<AdminCheck> => {
  try {
    const api = await getApi();
    const { data, response } = await api.GET("/api/v1/admin/me");
    if (response.ok && data) return { kind: "admin", admin: data };
    // 403 is a permanent denial like 401 and 404; 429, 5xx and network failures stay "unavailable".
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "not_admin" };
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
});

/**
 * Guard for the admin area. Anyone who is not an administrator is redirected to the admin sign-in page, whatever the
 * reason, carrying the requested path only when it is under /admin. When the backend cannot answer, `unavailable` is
 * returned so the caller renders no admin content. Every guarded admin page calls this itself: layouts are not re-run
 * on client navigation.
 */
export async function requireAdmin(): Promise<{ kind: "admin"; admin: AdminMe } | { kind: "unavailable" }> {
  const check = await checkAdmin();
  if (check.kind === "not_admin") {
    const next = safeAdminNext(await requestedPath());
    redirect(`/admin/sign-in?next=${encodeURIComponent(next)}`);
  }
  return check;
}

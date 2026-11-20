"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSession } from "@/lib/session";

/**
 * Watches the session provider (which re-checks on focus, tab visibility and every route change). When it reports a
 * signed-out session, or an account that is not an administrator, the person is sent to the admin sign-in page with
 * their place kept, and no admin content is rendered meanwhile. Nothing counts as "lost" before the provider has
 * finished its first check (status "loading"), and an account summary without a type is not a verdict: it triggers one
 * fresh check instead. `paused` is set while an explicit sign-out is running, which does its own navigation. The server
 * guard does the same on the next guarded navigation (401, 403 or 404).
 */
export function AdminSessionWatch({ paused, children }: { paused: boolean; children: React.ReactNode }) {
  const { status, account, refresh } = useSession();
  const pathname = usePathname();
  const typeUnknown = status === "signed_in" && !account?.account_type;
  const lost = status === "signed_out" || (status === "signed_in" && !typeUnknown && account?.account_type !== "admin");
  const rechecked = useRef(false);

  useEffect(() => {
    if (typeUnknown && !rechecked.current) {
      rechecked.current = true;
      void refresh();
    }
  }, [typeUnknown, refresh]);

  useEffect(() => {
    if (!lost || paused) return;
    // A hard navigation: the server guard runs again and no cached admin page is shown.
    // A shared page outside /admin (the password page) returns to the admin area, the only place the sign-in honours.
    const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
    const path = inAdmin ? pathname + window.location.search : "/admin";
    window.location.replace(`/admin/sign-in?next=${encodeURIComponent(path)}`);
  }, [lost, paused, pathname]);

  if (lost && !paused) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p role="status" data-testid="admin-session-ended">
          Your session has ended. Taking you to the sign-in page.
        </p>
      </main>
    );
  }
  return <>{children}</>;
}

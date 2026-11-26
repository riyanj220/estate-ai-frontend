"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NotificationsLink } from "@/components/notifications-link";
import { useSession } from "@/lib/session";
import { AdminSessionWatch } from "./admin-session-watch";

// The administration screens that exist.
const PAGES = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/publication-limits", label: "Publication limits" },
];

// Placeholders for later administration screens: inert text, never links, so no empty routes ship. Hand-off: turn an entry into a link when its route and page (with `requireAdmin()`) exist, and
// every page under `(protected)` must call `requireAdmin()` (tests/e2e/admin-guard-rule.spec.ts enforces it).
const PLACEHOLDERS = ["Listings", "Users", "Reports", "Audit log"];

/**
 * Admin account controls shared by the shell and the unavailable state: Change password (marked `from=admin` so a lost
 * session returns to the admin sign-in) and Sign out. The sign-out button uses `aria-disabled`, not `disabled`, so
 * focus is never lost; a failure moves focus to the status text.
 */
export function useAdminSignOut() {
  const { signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [failure, setFailure] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // A page restored from the back/forward cache is a stale snapshot: never show it, reload through the guard.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setSigningOut(false);
      window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (failure) statusRef.current?.focus();
  }, [failure]);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setFailure("");
    const result = await signOut();
    if (result.kind === "ok") {
      // A hard navigation: the client router cache cannot redisplay a cached admin page on Back.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/admin/sign-in");
      return;
    }
    setFailure("We could not sign you out. Please try again.");
    setSigningOut(false);
  }
  return { signingOut, failure, statusRef, onSignOut };
}

function AccountControls({ signingOut, onSignOut }: { signingOut: boolean; onSignOut: () => void }) {
  return (
    <nav aria-label="Administrator account" className="account-nav">
      <NotificationsLink />
      <Link href="/account/password?from=admin" className="text-link">
        Change password
      </Link>
      <button type="button" className="secondary-button" aria-disabled={signingOut || undefined} onClick={onSignOut}>
        Sign out
      </button>
    </nav>
  );
}

function StatusLine({ failure, statusRef }: { failure: string; statusRef: React.Ref<HTMLParagraphElement> }) {
  return (
    <p ref={statusRef} tabIndex={-1} aria-live="polite" className={failure ? "header-error" : "sr-only"} data-testid="admin-status">
      {failure}
    </p>
  );
}

/** The admin chrome: skip link, banner, navigation, account links and the main landmark. */
export function AdminShell({ children, embedded = false }: { children: React.ReactNode; embedded?: boolean }) {
  const pathname = usePathname();
  const { signingOut, failure, statusRef, onSignOut } = useAdminSignOut();
  // `embedded` is for a shared page (the password page) that already sits inside a `main` of its own layout.
  const Body = embedded ? "div" : "main";

  return (
    <AdminSessionWatch paused={signingOut}>
      {!embedded && (
        <a href="#admin-main" className="skip-link">
          Skip to main content
        </a>
      )}
      <header className="site-header">
        <div className="site-header-inner admin-header-inner">
          <span className="brand">EstateAI Administration</span>
          <AccountControls signingOut={signingOut} onSignOut={onSignOut} />
        </div>
        <nav aria-label="Administration" className="admin-nav">
          <ul>
            {PAGES.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-link" aria-current={pathname === href ? "page" : undefined}>
                  {label}
                </Link>
              </li>
            ))}
            {PLACEHOLDERS.map((name) => (
              <li key={name}>
                <span className="admin-nav-disabled">
                  {name} <span className="coming-soon">Coming soon</span>
                </span>
              </li>
            ))}
          </ul>
        </nav>
        <StatusLine failure={failure} statusRef={statusRef} />
      </header>
      <Body id="admin-main" tabIndex={-1} className={embedded ? undefined : "mx-auto max-w-3xl p-6"}>
        {children}
      </Body>
    </AdminSessionWatch>
  );
}

/** The unavailable state of the admin area: a minimal admin header (Sign out) and a Try again that reloads the page. */
export function AdminUnavailable() {
  const { signingOut, failure, statusRef, onSignOut } = useAdminSignOut();
  return (
    <AdminSessionWatch paused={signingOut}>
      <header className="site-header">
        <div className="site-header-inner admin-header-inner">
          <span className="brand">EstateAI Administration</span>
          <AccountControls signingOut={signingOut} onSignOut={onSignOut} />
        </div>
        <StatusLine failure={failure} statusRef={statusRef} />
      </header>
      <main id="admin-main" tabIndex={-1} className="mx-auto max-w-3xl p-6">
        <section className="card" aria-labelledby="unavailable-title">
          <h1 id="unavailable-title" className="page-title">
            Temporarily unavailable
          </h1>
          <p className="muted">We could not check your session just now. Please try again in a moment.</p>
          <button type="button" className="secondary-button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </section>
      </main>
    </AdminSessionWatch>
  );
}

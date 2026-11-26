"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { STATE_NOTES, canOwnListings, displayName, profileLinkLabel } from "@/lib/account";
import { NotificationsLink } from "@/components/notifications-link";
import { LISTINGS_PATH } from "@/lib/listing-messages";
import { useSession } from "@/lib/session";

export function SiteHeader() {
  const { status, account, signOut, refresh } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [failure, setFailure] = useState("");
  const pathname = usePathname();

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setFailure("");
    const result = await signOut();
    if (result.kind === "ok") {
      // A hard navigation: the client router cache cannot redisplay a cached signed-in page on Back.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
      return;
    }
    setFailure("We could not sign you out. Please try again.");
    setSigningOut(false);
  }

  // The admin area has its own chrome (src/app/admin/(protected)/admin-shell.tsx).
  // The shared pages (password, notifications) show the admin chrome to an administrator (they are outside /admin).
  const adminOnSharedPage = account?.account_type === "admin" && (pathname === "/account/password" || pathname === "/account/notifications");
  if (pathname === "/admin" || pathname.startsWith("/admin/") || adminOnSharedPage) return null;

  const note = account ? STATE_NOTES[account.state] : undefined;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="account-nav">
          <Link href="/" className="brand">
            EstateAI
          </Link>
          <nav aria-label="Main">
            <Link href="/listings" className="text-link">
              Browse
            </Link>
          </nav>
        </div>
        <nav aria-label="Account" className="account-nav" aria-busy={status === "loading"}>
          {status === "loading" && <span className="nav-placeholder" aria-hidden="true" />}
          {status === "signed_out" && (
            <>
              <Link href="/sign-in" className="text-link">
                Sign in
              </Link>
              <Link href="/register" className="text-link">
                Create account
              </Link>
            </>
          )}
          {status === "signed_in" && account && (
            <>
              <span data-testid="account-name">{displayName(account)}</span>
              {note && (
                <span className="state-note" data-testid="state-note">
                  {note}
                </span>
              )}
              {profileLinkLabel(account.account_type) && (
                <Link href="/account/profile" className="text-link">
                  {profileLinkLabel(account.account_type)}
                </Link>
              )}
              {canOwnListings(account.account_type) && (
                <Link href={LISTINGS_PATH} className="text-link">
                  My listings
                </Link>
              )}
              <NotificationsLink />
              <Link href="/account/password" className="text-link">
                Change password
              </Link>
              <button type="button" className="secondary-button" onClick={onSignOut} disabled={signingOut}>
                Sign out
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <span>Could not check your session</span>
              <button type="button" className="secondary-button" onClick={() => void refresh()}>
                Retry
              </button>
            </>
          )}
        </nav>
      </div>
      {/* Story 2.21: a Suspended account reads why. The reason comes only with its own session (`me`). */}
      {status === "signed_in" && account?.state === "suspended" && (
        <p className="suspension-banner" data-testid="suspension-banner">
          <strong>Your account is suspended.</strong>
          {account.suspension_reason ? ` Reason: ${account.suspension_reason}` : ""}
        </p>
      )}
      <p aria-live="polite" className={failure ? "header-error" : "sr-only"} data-testid="header-status">
        {failure}
      </p>
    </header>
  );
}

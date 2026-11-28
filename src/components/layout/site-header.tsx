"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { STATE_NOTES, canOwnListings, displayName, profileLinkLabel } from "@/lib/account/account";
import { MessagesLink } from "@/components/layout/messages-link";
import { NotificationsLink } from "@/components/layout/notifications-link";
import { FAVOURITES_PATH, keepsFavourites } from "@/lib/listing/favourites";
import { LISTINGS_PATH } from "@/lib/listing/listing-messages";
import { useSession } from "@/lib/auth/session";

/** True while the reader is scrolling down the page: the header gets out of the way, and returns on the first scroll up. */
function useScrolledAway() {
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    function onScroll() {
      const now = Math.max(window.scrollY, 0);
      // Small jitters are ignored.
      if (Math.abs(now - last) < 6) return;
      setAway(now > last && now > 120);
      last = now;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return away;
}

export function SiteHeader() {
  const { status, account, signOut, refresh } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [failure, setFailure] = useState("");
  const pathname = usePathname();
  // The phone menu belongs to the page it was opened on, so following a link closes it.
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const menuOpen = menuAt === pathname;
  const scrolledAway = useScrolledAway();
  const current = (href: string) => (pathname === href ? ("page" as const) : undefined);

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
    <header className={scrolledAway && !menuOpen ? "site-header site-header-away" : "site-header"}>
      <div className="site-header-inner">
          <Link href="/" className="inline-flex items-center gap-2 font-serif font-bold text-accent text-[1.5rem] tracking-[-0.01em] mr-0 max-[641px]:text-[1.25rem]">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5" />
            </svg>
            EstateAI
          </Link>
          <nav aria-label="Main" className="main-nav">
            <Link href="/listings?purpose=sale" className="text-link">
              Buy
            </Link>
            <Link href="/listings?purpose=rent" className="text-link">
              Rent
            </Link>
            <Link href="/listings" className="text-link">
              Browse
            </Link>
          </nav>
        {status === "signed_in" && account && (
          <button type="button" className="secondary-button ml-auto min-[1024px]:hidden" aria-expanded={menuOpen} onClick={() => setMenuAt(menuOpen ? null : pathname)}>
            Menu
          </button>
        )}
        <nav aria-label="Account" className={status === "signed_in" ? `account-nav sidebar${menuOpen ? " sidebar-open" : ""}` : "account-nav"} aria-busy={status === "loading"}>
          {status === "loading" && <span className="inline-block w-40 h-6" aria-hidden="true" />}
          {status === "signed_out" && (
            <>
              <Link href="/sign-in" className="text-link">
                Sign in
              </Link>
              <Link href="/register" className="text-link header-cta">
                Create account
              </Link>
            </>
          )}
          {status === "signed_in" && account && (
            <>
              <span data-testid="account-name" className="sidebar-name">
                {displayName(account)}
              </span>
              {note && (
                <span className="state-note" data-testid="state-note">
                  {note}
                </span>
              )}
              <Link href="/dashboard" className="text-link" aria-current={current("/dashboard")}>
                Dashboard
              </Link>
              {profileLinkLabel(account.account_type) && (
                <Link href="/account/profile" className="text-link" aria-current={current("/account/profile")}>
                  {profileLinkLabel(account.account_type)}
                </Link>
              )}
              {canOwnListings(account.account_type) && (
                <Link href={LISTINGS_PATH} className="text-link" aria-current={current(LISTINGS_PATH)}>
                  My listings
                </Link>
              )}
              {keepsFavourites(account) && (
                <Link href={FAVOURITES_PATH} className="text-link" aria-current={current(FAVOURITES_PATH)}>
                  Favourites
                </Link>
              )}
              {account.account_type !== "admin" && <MessagesLink accountId={account.id} />}
              <NotificationsLink />
              <Link href="/account/password" className="text-link" aria-current={current("/account/password")}>
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

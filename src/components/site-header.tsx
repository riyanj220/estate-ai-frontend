"use client";

import Link from "next/link";
import { useState } from "react";
import { STATE_NOTES, displayName } from "@/lib/account";
import { useSession } from "@/lib/session";

export function SiteHeader() {
  const { status, account, signOut, refresh } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [failure, setFailure] = useState("");

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

  const note = account ? STATE_NOTES[account.state] : undefined;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          EstateAI
        </Link>
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
              {account.account_type === "individual" && (
                <Link href="/account/profile" className="text-link">
                  Profile
                </Link>
              )}
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
      <p aria-live="polite" className={failure ? "header-error" : "sr-only"} data-testid="header-status">
        {failure}
      </p>
    </header>
  );
}

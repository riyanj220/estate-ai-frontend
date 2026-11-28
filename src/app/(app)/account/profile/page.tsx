import type { Metadata } from "next";
import Link from "next/link";
import { requireAccount } from "@/lib/auth/current-account";
import { AgencyProfileClient } from "./agency-profile-client";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Profile | EstateAI", robots: { index: false, follow: false } };

/** Stories 10.1 and 10.9: reachable by every Individual and Agency account, Suspended ones included. */
function AccountHelpLinks() {
  return (
    <p>
      <Link href="/account/support" className="text-link">
        Contact support
      </Link>{" "}
      <Link href="/account/closure" className="text-link">
        Close account
      </Link>
    </p>
  );
}

export default async function ProfilePage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const type = result.account.account_type;
  // One route, two bodies: the page decides by the session's account type. Admins (and any unknown type) get a polite note.
  if (type === "individual") {
    return (
      <>
        <h1 className="page-title">Profile</h1>
        <ProfileClient />
        <AccountHelpLinks />
      </>
    );
  }
  if (type === "agency") {
    return (
      <>
        <h1 className="page-title">Business profile</h1>
        <AgencyProfileClient />
        <AccountHelpLinks />
      </>
    );
  }
  return (
    <>
      <h1 className="page-title">Profile</h1>
      <p className="card" data-testid="profile-unavailable">
        Profile editing is available for individual and agency accounts.
      </p>
    </>
  );
}

import type { Metadata } from "next";
import { requireAccount } from "@/lib/current-account";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Profile | EstateAI", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return (
    <>
      <h1 className="page-title">Profile</h1>
      <ProfileClient />
    </>
  );
}

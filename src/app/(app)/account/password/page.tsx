import type { Metadata } from "next";
import { requireAccount } from "@/lib/current-account";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password | EstateAI", robots: { index: false, follow: false } };

export default async function ChangePasswordPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  return (
    <>
      <h1 className="page-title">Change password</h1>
      <p className="muted">Enter your current password and choose a new one. Your other devices will be signed out.</p>
      <ChangePasswordForm />
    </>
  );
}

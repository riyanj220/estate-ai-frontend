import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/app/admin/(protected)/admin-shell";
import { requireAccount } from "@/lib/auth/current-account";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password | EstateAI", robots: { index: false, follow: false } };

export default async function ChangePasswordPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const isAdmin = result.account.account_type === "admin";
  const content = (
    <>
      <h1 className="page-title">Change password</h1>
      <p className="muted">Enter your current password and choose a new one. Your other devices will be signed out.</p>
      <ChangePasswordForm
        signInPath={isAdmin ? "/admin/sign-in" : "/sign-in"}
        returnTo={isAdmin ? "/admin" : "/account/password"}
      />
      {isAdmin && (
        <p className="muted" style={{ marginTop: "var(--space)" }}>
          <Link href="/admin" className="text-link">
            Back to administration
          </Link>
        </p>
      )}
    </>
  );
  // An administrator sees the admin chrome, not the public header (which hides itself for them here).
  return isAdmin ? <AdminShell embedded>{content}</AdminShell> : content;
}

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader title="Change password" eyebrow="Security">
        Enter your current password and choose a new one. Your other devices will be signed out.
      </PageHeader>
      <div className="app-wide grid items-start gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <ChangePasswordForm signInPath={isAdmin ? "/admin/sign-in" : "/sign-in"} returnTo={isAdmin ? "/admin" : "/account/password"} />
        </div>
        <aside className="rounded-large bg-accent-soft p-6 text-[0.9375rem]">
          <h2 className="mb-3 font-serif text-[1.25rem] font-semibold text-accent">A strong password</h2>
          <ul className="grid list-disc gap-2 pl-5 text-muted">
            <li>Is long: a few unrelated words work well.</li>
            <li>Is not one you use on another site.</li>
            <li>Does not contain your name or email address.</li>
          </ul>
        </aside>
      </div>
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

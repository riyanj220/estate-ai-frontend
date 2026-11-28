import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAdmin } from "@/lib/auth/current-account";
import { safeAdminNext } from "@/lib/auth/next-target";
import { AdminSignInForm } from "./admin-sign-in-form";

export const metadata: Metadata = { title: "Administrator sign in | EstateAI", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const target = safeAdminNext(next);
  // Only an administrator already signed in has nothing to do here. A visitor, a signed-in non-administrator, an expired
  // administrator and a failed check all just see the form.
  const check = await checkAdmin();
  if (check.kind === "admin") redirect(target);
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="page-title">Administrator sign in</h1>
      <p className="muted">Use the email address and password of your administrator account.</p>
      <AdminSignInForm target={target} />
    </main>
  );
}

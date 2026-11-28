import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccount } from "@/lib/auth/current-account";
import { safeNext } from "@/lib/auth/next-target";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in | EstateAI", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  // Someone who is already signed in has nothing to do here. A failed check just shows the form.
  const { next } = await searchParams;
  const target = safeNext(next);
  const check = await checkAccount();
  if (check.kind === "signed_in") redirect(target);
  return (
    <>
      <h1 className="page-title">Sign in</h1>
      <p className="muted">Use the email address and password of your account.</p>
      <SignInForm target={target} />
    </>
  );
}

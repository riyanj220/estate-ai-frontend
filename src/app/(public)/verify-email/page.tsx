import type { Metadata } from "next";
import { VerifyEmailClient } from "./verify-email-client";

export const metadata: Metadata = { title: "Verify your email | EstateAI", robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <>
      <h1 className="page-title">Email verification</h1>
      <VerifyEmailClient />
    </>
  );
}

import type { Metadata } from "next";
import { ResetPasswordClient } from "./reset-password-client";

// Statically prerendered on purpose: a dynamic page would put the emailed token into the served HTML.
export const metadata: Metadata = { title: "Choose a new password | EstateAI", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="page-title">Choose a new password</h1>
      <ResetPasswordClient />
    </>
  );
}

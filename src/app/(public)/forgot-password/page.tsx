import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset your password | EstateAI", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="page-title">Forgot your password?</h1>
      <p className="muted">Enter the email address of your account and we will send you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </>
  );
}

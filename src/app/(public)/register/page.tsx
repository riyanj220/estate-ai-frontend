import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account | EstateAI" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="page-title">Create an account</h1>
      <p className="muted">Register as an individual to list or find property.</p>
      <RegisterForm />
    </>
  );
}

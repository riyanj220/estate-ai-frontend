import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account | EstateAI" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="page-title">Create an account</h1>
      <p className="muted">Register as an individual to list or find property.</p>
      <p>
        Registering an agency?{" "}
        <Link href="/register/agency" className="text-link">
          Register an agency instead
        </Link>
      </p>
      <RegisterForm />
    </>
  );
}

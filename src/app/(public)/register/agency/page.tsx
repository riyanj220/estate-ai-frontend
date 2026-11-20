import type { Metadata } from "next";
import Link from "next/link";
import { AgencyRegisterForm } from "./agency-register-form";

export const metadata: Metadata = { title: "Register an agency | EstateAI" };

export default function AgencyRegisterPage() {
  return (
    <>
      <h1 className="page-title">Register an agency</h1>
      <p className="muted">Create a business account for your agency.</p>
      <p>
        Registering as an individual instead?{" "}
        <Link href="/register" className="text-link">
          Create an individual account
        </Link>
      </p>
      <AgencyRegisterForm />
    </>
  );
}

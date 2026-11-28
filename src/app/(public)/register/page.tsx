import type { Metadata } from "next";
import { AccountTypeSwitch } from "@/components/auth/account-type-switch";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account | EstateAI" };

export default function RegisterPage() {
  return (
    <RegisterForm
      intro={
        <>
          <h1 className="page-title">Create an account</h1>
          <p className="muted">Register as an individual to list or find property.</p>
          <AccountTypeSwitch current="/register" />
        </>
      }
    />
  );
}

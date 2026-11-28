import type { Metadata } from "next";
import { AccountTypeSwitch } from "@/components/auth/account-type-switch";
import { AgencyRegisterForm } from "./agency-register-form";

export const metadata: Metadata = { title: "Register an agency | EstateAI" };

export default function AgencyRegisterPage() {
  return (
    <AgencyRegisterForm
      intro={
        <>
          <h1 className="page-title">Register an agency</h1>
          <p className="muted">Create a business account for your agency.</p>
          <AccountTypeSwitch current="/register/agency" />
        </>
      }
    />
  );
}

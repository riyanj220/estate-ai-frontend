import type { Metadata } from "next";
import { ConfirmEmailChangeClient } from "./confirm-email-change-client";

// Statically prerendered on purpose: a dynamic page would put the emailed token into the served HTML.
export const metadata: Metadata = { title: "Confirm your new email address | EstateAI", robots: { index: false } };

export default function ConfirmEmailChangePage() {
  return (
    <>
      <h1 className="page-title">Confirm your new email address</h1>
      <ConfirmEmailChangeClient />
    </>
  );
}

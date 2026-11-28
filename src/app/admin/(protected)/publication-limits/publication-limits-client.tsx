"use client";

import { useState } from "react";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";
import { PolicySection } from "./policy-section";
import type { AccountType } from "./quota-api";
import { UsageSection } from "./usage-section";

/** Publication limits (Story 2.20): the page only shows what the server answers and sends the new number back. */
export function PublicationLimits() {
  const { announcement, announce, resetAnnouncement } = useFormFeedback();
  // Limits saved on this page, so the loaded usage rows show them without throwing the loaded pages away.
  const [saved, setSaved] = useState<Partial<Record<AccountType, number>>>({});

  return (
    <>
      <h1 className="page-title">Publication limits</h1>
      <p className="muted">How many publications each account may use in a calendar month.</p>
      {/* The one live region of this page. */}
      <p role="status" aria-live="polite" className={announcement ? "muted" : "sr-only"} data-testid="quota-status">
        {announcement}
      </p>
      <PolicySection
        announce={announce}
        resetAnnouncement={resetAnnouncement}
        onSaved={(accountType, limit) => setSaved((prev) => ({ ...prev, [accountType]: limit }))}
      />
      <UsageSection saved={saved} announce={announce} />
    </>
  );
}

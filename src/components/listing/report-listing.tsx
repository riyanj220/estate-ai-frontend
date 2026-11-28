"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { canOwnListings } from "@/lib/account/account";
import { safeNext } from "@/lib/auth/next-target";
import { MAX_DESCRIPTION, REPORT_REASONS, reportListing, type ReportReason } from "@/lib/listing/reports";
import { useSession } from "@/lib/auth/session";

/** "Report listing" on a public Listing (Story 9.1). A Visitor is asked to sign in; administrators have no button. */
export function ReportListing({ listingId }: { listingId: string }) {
  const { status, account, refresh } = useSession();
  const pathname = usePathname();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [description, setDescription] = useState("");
  const [problem, setProblem] = useState("");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const select = useRef<HTMLSelectElement>(null);

  if (status !== "signed_in" && status !== "signed_out") return null;
  if (status === "signed_in" && (!account || !canOwnListings(account.account_type))) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (running.current) return;
    setOutcome("");
    if (!reason) {
      setProblem("Choose a reason.");
      select.current?.focus();
      return;
    }
    setProblem("");
    running.current = true;
    setBusy(true);
    const result = await reportListing(listingId, reason, description.trim());
    running.current = false;
    setBusy(false);
    if (result.kind === "gone") return void refresh();
    setOutcome(result.message);
    if (result.kind === "done") setOpen(false);
  }

  return (
    <div className="save-control">
      <button type="button" className="secondary-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Report listing
      </button>
      <p role="status" className={outcome || (open && status === "signed_out") ? "save-note" : "sr-only"} data-testid="report-status">
        {status === "signed_out" && open ? (
          <>
            <Link href={`/sign-in?next=${encodeURIComponent(safeNext(pathname))}`} className="text-link">
              Sign in
            </Link>{" "}
            to report this listing.
          </>
        ) : (
          outcome
        )}
      </p>
      {open && status === "signed_in" && (
        <form noValidate onSubmit={(event) => void submit(event)} aria-label="Report listing">
          <div className="field">
            <label htmlFor={`${id}-reason`}>Reason</label>
            <select
              id={`${id}-reason`}
              ref={select}
              value={reason}
              aria-invalid={problem ? true : undefined}
              aria-describedby={`${id}-problem`}
              onChange={(event) => setReason(event.target.value as ReportReason | "")}
            >
              <option value="">Choose a reason</option>
              {Object.entries(REPORT_REASONS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <p id={`${id}-problem`} role="alert" className="field-error">
              {problem}
            </p>
          </div>
          <div className="field">
            <label htmlFor={`${id}-description`}>Details (optional)</label>
            <textarea id={`${id}-description`} rows={3} maxLength={MAX_DESCRIPTION} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <button type="submit" className="primary-button" aria-disabled={busy || undefined}>
            Send report
          </button>
        </form>
      )}
    </div>
  );
}

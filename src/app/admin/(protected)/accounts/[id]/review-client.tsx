"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { components } from "@/api/schema";
import { STATE_LABELS, typeLabel } from "@/lib/account/account";
import { getApi } from "@/lib/http/api";
import { formatResetDate as formatDate } from "@/lib/account/publication-allowance";
import { REPORT_REASONS } from "@/lib/listing/reports";
import { STATUS_LABELS, useAdminRead, words } from "../../moderation-shared";
import { ReasonedRead } from "../../reasoned-read";
import { AccountAction } from "../account-action";

type Review = components["schemas"]["AccountReview"];
type Listings = components["schemas"]["AdminListingPage"];

/** One account for support and policing (Story 10.4): status, profile, listings, reports and closure requests. */
export function AccountReview({ accountId }: { accountId: string }) {
  const path = `/admin/accounts/${accountId}`;
  const send = useCallback(
    async (signal: AbortSignal) => (await getApi()).GET("/api/v1/admin/accounts/{account_id}", { params: { path: { account_id: accountId } }, cache: "no-store", signal }),
    [accountId],
  );
  const { data, failure, reload, gone } = useAdminRead<Review>(send, path);
  const [notice, setNotice] = useState("");
  const account = data?.account;

  return (
    <>
      <p>
        <Link href="/admin/accounts" className="text-link">
          Back to accounts
        </Link>
      </p>
      <h1 className="page-title account-text">{account ? account.display_name || account.masked_email : "Account"}</h1>
      <p role="status" aria-live="polite" className={notice ? "state-note" : "sr-only"} data-testid="review-notice">
        {notice}
      </p>
      {failure && <p role="alert">{failure}</p>}
      {!data && !failure && <p className="muted">Loading the account…</p>}
      {data && account && (
        <>
          <section className="card" aria-label="Profile" style={{ marginBottom: "var(--space)" }}>
            <dl className="account-details">
              <dt>Type</dt>
              <dd>{typeLabel(account.account_type)}</dd>
              <dt>State</dt>
              <dd data-testid="review-state">{STATE_LABELS[account.state]}</dd>
              <dt>Email</dt>
              <dd className="account-text">{account.masked_email}</dd>
              <dt>Email verified</dt>
              <dd>{account.email_verified ? "Yes" : "No"}</dd>
              <dt>Joined</dt>
              <dd>{formatDate(account.created_at)}</dd>
              {account.suspension_reason && (
                <>
                  <dt>Suspension reason</dt>
                  <dd className="account-text">{account.suspension_reason}</dd>
                </>
              )}
              {account.account_type === "agency" && (
                <>
                  <dt>City</dt>
                  <dd>{account.city ?? "Not given"}</dd>
                  <dt>Description</dt>
                  <dd className="account-text">{account.description || "None"}</dd>
                  <dt>Verification</dt>
                  <dd>{words(account.verification_status ?? "unverified")}</dd>
                </>
              )}
            </dl>
            {account.state !== "deactivated" && (
              <AccountAction
                key={account.state}
                account={{ id: account.id, state: account.state, email: account.masked_email }}
                onStart={() => setNotice("")}
                onChanged={(next) => {
                  setNotice(next.state === "suspended" ? "The account is now suspended." : "The account has been reactivated.");
                  void reload();
                }}
                onSessionGone={gone}
                onUnavailable={(message) => {
                  setNotice(message);
                  void reload();
                }}
              />
            )}
          </section>
          <section className="card" aria-label="Private details" style={{ marginBottom: "var(--space)" }}>
            <ReasonedRead<components["schemas"]["AccountContact"]>
              title="Contact details"
              onSessionGone={gone}
              send={async (reason, csrf, signal) =>
                (await getApi()).POST("/api/v1/admin/accounts/{account_id}/private", {
                  params: { path: { account_id: accountId } },
                  body: { reason },
                  headers: { "X-CSRFToken": csrf },
                  cache: "no-store",
                  signal,
                })
              }
              show={(contact) => (
                <dl className="account-details">
                  <dt>Email</dt>
                  <dd className="account-text">{contact.email}</dd>
                  <dt>Phone</dt>
                  <dd>{contact.phone || "Not given"}</dd>
                  {account.account_type === "agency" && (
                    <>
                      <dt>Office address</dt>
                      <dd className="account-text">{contact.office_address || "Not given"}</dd>
                    </>
                  )}
                </dl>
              )}
            />
            <p className="muted">A listing&apos;s private address is read on the listing itself.</p>
          </section>
          <OwnedListings accountId={accountId} path={path} />
          <section className="card" aria-labelledby="reports-title" style={{ marginBottom: "var(--space)" }}>
            <h2 id="reports-title" className="section-title">
              Reports about this account
            </h2>
            {data.reports.length === 0 ? (
              <p className="muted">No reports.</p>
            ) : (
              <ul aria-label="Account reports">
                {data.reports.map((report) => (
                  <li key={report.id} className="account-text">
                    {report.target_type === "conversation" ? "Conversation messages" : (report.title ?? "Untitled listing")}: {REPORT_REASONS[report.reason]}, {words(report.status)}, sent{" "}
                    {formatDate(report.created_at)}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/reports" className="text-link">
              Open the report queue
            </Link>
          </section>
          <section className="card" aria-labelledby="closures-title">
            <h2 id="closures-title" className="section-title">
              Closure requests
            </h2>
            {data.closure_requests.length === 0 ? (
              <p className="muted">No requests.</p>
            ) : (
              <ul aria-label="Account closure requests">
                {data.closure_requests.map((request) => (
                  <li key={request.id} className="account-text">
                    {words(request.kind)}: {words(request.status)}, sent {formatDate(request.submitted_at)}
                    {request.decision_reason && `. Reason: ${request.decision_reason}`}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

/** The account's listings from the review list; drafts have no content and are listed separately. */
function OwnedListings({ accountId, path }: { accountId: string; path: string }) {
  const [drafts, setDrafts] = useState(false);
  const send = useCallback(
    async (signal: AbortSignal) =>
      (await getApi()).GET("/api/v1/admin/listings", { params: { query: { owner: accountId, status: drafts ? "draft" : undefined } }, cache: "no-store", signal }),
    [accountId, drafts],
  );
  const { data, failure } = useAdminRead<Listings>(send, path);
  return (
    <section className="card" aria-labelledby="listings-title" style={{ marginBottom: "var(--space)" }}>
      <h2 id="listings-title" className="section-title">
        {drafts ? "Drafts" : "Listings"}
      </h2>
      {failure && <p role="alert">{failure}</p>}
      {data && data.results.length === 0 && <p className="muted">None.</p>}
      {data && data.results.length > 0 && (
        <ul aria-label="Account listings">
          {data.results.map((row) => (
            <li key={row.id} className="account-text">
              <Link href={`/admin/listings/${row.id}${row.status === "draft" ? "?draft=1" : ""}`} className="text-link">
                {row.title ?? (row.status === "draft" ? "Draft listing" : "Untitled listing")}
              </Link>{" "}
              ({STATUS_LABELS[row.status]})
            </li>
          ))}
        </ul>
      )}
      {data?.next && <p className="muted">Only the newest 20 are shown. Use the Listings screen with this account id: {accountId}</p>}
      <button type="button" className="secondary-button" onClick={() => setDrafts(!drafts)}>
        {drafts ? "Show listings" : "Show drafts"}
      </button>
    </section>
  );
}

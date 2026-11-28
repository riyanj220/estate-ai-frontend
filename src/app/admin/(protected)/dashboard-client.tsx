"use client";

import Link from "next/link";
import { useCallback } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/http/api";
import { STATUS_LABELS, useAdminRead } from "./moderation-shared";

type Counts = components["schemas"]["AdminDashboard"];

/** Platform counts (Story 10.8), taken when the page loads. */
export function Dashboard() {
  const send = useCallback(async (signal: AbortSignal) => (await getApi()).GET("/api/v1/admin/dashboard", { cache: "no-store", signal }), []);
  const { data, failure, reload } = useAdminRead<Counts>(send, "/admin");
  return (
    <section aria-labelledby="overview-title">
      <h2 id="overview-title" className="section-title">
        Platform overview
      </h2>
      {failure && (
        <div role="alert">
          <p>{failure}</p>
          <button type="button" className="secondary-button" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}
      {!data && !failure && <p className="muted">Loading counts…</p>}
      {data && (
        <div data-testid="dashboard">
          <Block title="Totals">
            <Count label="Individual accounts" value={data.individual_accounts} href="/admin/accounts" />
            <Count label="Agency accounts" value={data.agency_accounts} href="/admin/accounts" />
            <Count label="Published listings" value={data.published_listings} href="/admin/listings" />
          </Block>
          <Block title="Needs attention">
            <Count label="Pending verification requests" value={data.pending_verifications} href="/admin/verification" />
            <Count label="Unresolved reports" value={data.unresolved_reports} href="/admin/reports" />
          </Block>
          <Block title="Listings by status">
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <Count key={status} label={label} value={data.listings_by_status[status as keyof typeof STATUS_LABELS]} />
            ))}
          </Block>
          <Block title={`Last ${data.activity.days} days`}>
            <Count label="New accounts" value={data.activity.new_accounts} />
            <Count label="New listings" value={data.activity.new_listings} />
            <Count label="Messages sent" value={data.activity.messages_sent} />
          </Block>
        </div>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" aria-label={title} style={{ marginBottom: "var(--space)" }}>
      <h3 className="section-title">{title}</h3>
      <dl className="account-details">{children}</dl>
    </section>
  );
}

function Count({ label, value, href }: { label: string; value: number; href?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={`count-${label.toLowerCase().replaceAll(" ", "-")}`}>
        {href ? (
          <Link href={href} className="text-link" aria-label={`${value} ${label.toLowerCase()}`}>
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </>
  );
}

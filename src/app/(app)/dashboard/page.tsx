import type { Metadata } from "next";
import Link from "next/link";
import { STATE_LABELS, canOwnListings, displayName, typeLabel } from "@/lib/account/account";
import { LISTINGS_PATH } from "@/lib/listing/listing-messages";
import { AgencySection } from "./agency-section";
import { AllowanceCard } from "./allowance-card";
import { requireAccount } from "@/lib/auth/current-account";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const CHIP = "rounded-full border border-white/30 px-3 py-1 text-[0.8125rem] font-semibold";

export default async function DashboardPage() {
  const result = await requireAccount();
  if (result.kind === "unavailable") return null; // the layout shows the unavailable state
  const { account } = result;
  const owner = canOwnListings(account.account_type);
  const name = displayName(account);
  return (
    <div className="app-wide">
      <header className="relative mb-6 flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-large bg-[linear-gradient(120deg,var(--color-accent-strong),#2c5a46)] p-6 text-white sm:p-8">
        <div className="flex min-w-0 items-center gap-5">
          <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/15 font-serif text-[1.5rem] font-semibold uppercase">
            {name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <h1 className="text-[0.75rem] font-bold tracking-[0.16em] text-white/80 uppercase">Dashboard</h1>
            <p className="font-serif text-[clamp(1.5rem,3vw,2.25rem)] leading-tight font-semibold wrap-anywhere">
              Welcome back, <span data-testid="dashboard-name">{name}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={CHIP} data-testid="dashboard-type">
                Account type: {typeLabel(account.account_type)}
              </span>
              <span className={CHIP} data-testid="dashboard-state">
                Account state: {STATE_LABELS[account.state] ?? account.state}
              </span>
            </div>
          </div>
        </div>
        {owner && (
          <Link href={`${LISTINGS_PATH}/new`} className="inline-flex min-h-12 items-center rounded-full bg-white px-6 font-semibold text-accent-strong focus-visible:outline-white">
            + Create listing
          </Link>
        )}
      </header>
      {owner && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {account.account_type === "agency" ? (
            <div className="grid min-w-0 gap-6">
              <AgencySection />
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                { href: `${LISTINGS_PATH}/new`, title: "List a property", text: "Fill in the details yourself, or let the assistant help you." },
                { href: "/listings", title: "Find a property", text: "Search by words, voice or filters, and save what you like." },
              ].map((step) => (
                <li key={step.href}>
                  <Link href={step.href} className="card block h-full transition-[translate] duration-150 hover:-translate-y-0.5">
                    <strong className="block font-serif text-[1.25rem] text-accent">{step.title} →</strong>
                    <span className="mt-2 block text-[0.9375rem] text-muted">{step.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <aside className="lg:sticky lg:top-24">
            <AllowanceCard />
          </aside>
        </div>
      )}
    </div>
  );
}

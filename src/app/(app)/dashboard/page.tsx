import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>Signed-in pages placeholder.</p>
    </>
  );
}

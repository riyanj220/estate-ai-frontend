import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p>Admin area placeholder.</p>
    </>
  );
}

import { Guarded } from "@/components/guarded";

export const dynamic = "force-dynamic";

// Any signed-in account may see the placeholder until the admin role check arrives (Story 1.19).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Guarded>{children}</Guarded>
    </main>
  );
}

import { Guarded } from "@/components/guarded";

// Every request is checked against the backend; nothing signed-in is cached or served statically.
export const dynamic = "force-dynamic";

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Guarded>{children}</Guarded>
    </main>
  );
}

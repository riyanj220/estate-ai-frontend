import { Guarded } from "@/components/auth/guarded";

// Every request is checked against the backend; nothing signed-in is cached or served statically.
export const dynamic = "force-dynamic";

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <Guarded>{children}</Guarded>
    </main>
  );
}

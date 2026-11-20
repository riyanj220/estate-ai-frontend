import { requireAccount } from "@/lib/current-account";

/** The neutral state shown when the backend cannot confirm who is asking: no protected content. */
export function Unavailable() {
  return (
    <section className="card" aria-labelledby="unavailable-title">
      <h1 id="unavailable-title" className="page-title">
        Temporarily unavailable
      </h1>
      <p className="muted">We could not check your session just now. Please try again in a moment.</p>
      <a href="" className="text-link">
        Try again
      </a>
    </section>
  );
}

/** Renders its children only for a signed-in account; otherwise a redirect or a neutral unavailable state. */
export async function Guarded({ children }: { children: React.ReactNode }) {
  const result = await requireAccount();
  if (result.kind === "unavailable") return <Unavailable />;
  return <>{children}</>;
}

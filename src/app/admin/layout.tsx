// Everything under /admin depends on the session cookie: never prerendered or cached. The public sign-in page lives
// here at /admin/sign-in; every other page is in the guarded `(protected)` group, which holds the administrator guard.
export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

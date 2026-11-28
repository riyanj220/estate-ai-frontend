import { SiteFooter } from "@/components/site-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="page">{children}</main>
      <SiteFooter />
    </>
  );
}

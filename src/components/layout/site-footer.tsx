import Link from "next/link";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/listings?purpose=sale", label: "Properties for sale" },
      { href: "/listings?purpose=rent", label: "Properties for rent" },
    ],
  },
  {
    title: "Good to know",
    links: [
      { href: "/about-estimates", label: "How price estimates work" },
      { href: "/register/agency", label: "Agency sign-up" },
    ],
  },
];

/** The public pages' footer. The admin and signed-in areas have none. */
export function SiteFooter() {
  return (
    <footer className="site-footer mt-24 shrink-0 bg-accent-strong text-[#e6ece8] [&_:focus-visible]:outline-white">
      <div className="mx-auto grid max-w-wide grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-8 px-(--gutter) pt-14 pb-8">
        <div>
          <p className="mb-2 font-serif text-[1.5rem] text-white">EstateAI</p>
          <p>Property for sale and rent in Karachi, with AI help to search and list.</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="mb-3 font-bold text-white">{column.title}</p>
            <ul className="grid list-none gap-2 p-0">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:underline">{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto max-w-wide border-t border-white/15 px-(--gutter) pt-5 pb-8 text-[0.8125rem] text-[#b9c6bf]">A final-year project. Photographs from Unsplash are for illustration.</p>
    </footer>
  );
}

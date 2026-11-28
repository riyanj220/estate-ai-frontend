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
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <p className="footer-name">EstateAI</p>
          <p>Property for sale and rent in Karachi, with AI help to search and list.</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="footer-title">{column.title}</p>
            <ul>
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="footer-note">A final-year project. Photographs from Unsplash are for illustration.</p>
    </footer>
  );
}

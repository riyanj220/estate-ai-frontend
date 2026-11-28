import Link from "next/link";

const TYPES = [
  { href: "/register", label: "Individual" },
  { href: "/register/agency", label: "Agency" },
] as const;

/** Switches between the two sign-up forms; it looks like the Buy / Rent switch of the home page. */
export function AccountTypeSwitch({ current }: { current: (typeof TYPES)[number]["href"] }) {
  return (
    <nav aria-label="Account type" className="mt-1 mb-5 flex gap-1 rounded-full bg-sand p-1">
      {TYPES.map((type) => (
        <Link
          key={type.href}
          href={type.href}
          aria-current={type.href === current ? "page" : undefined}
          className="flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-[0.9375rem] font-semibold aria-[current=page]:bg-accent aria-[current=page]:text-white"
        >
          {type.label}
        </Link>
      ))}
    </nav>
  );
}

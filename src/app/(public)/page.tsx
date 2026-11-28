import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { SearchBox } from "@/components/search-box";
import { SearchSelect } from "@/components/search-select";
import { BROWSE_PATH, fetchBrowse, fetchPlaces } from "@/lib/public-listings";

export const metadata: Metadata = { title: "EstateAI | Property for sale and rent in Karachi" };
export const dynamic = "force-dynamic";

// Layout shared by the sections of this page.
const INNER = "mx-auto max-w-wide px-(--gutter)";
const SECTION = `${INNER} w-full pt-[clamp(4rem,8vw,6.5rem)]`;
const SECTION_HEAD = "mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4";
const HEADING = "section-title m-0 text-[clamp(1.875rem,3.5vw,2.75rem)] leading-[1.1] tracking-[-0.02em]";
const FIELD = "searchbar-field grid flex-[1_1_12rem] gap-0.5 border-l border-line px-5 py-1 focus-within:rounded-xl focus-within:bg-accent-soft has-[select:focus-visible]:outline-2 has-[select:focus-visible]:-outline-offset-2 has-[select:focus-visible]:outline-accent has-[button:focus-visible]:outline-2 has-[button:focus-visible]:-outline-offset-2 has-[button:focus-visible]:outline-accent max-[861px]:flex-none max-[861px]:border-t max-[861px]:border-l-0 max-[861px]:px-2 max-[861px]:pt-2.5 max-[861px]:pb-1";
const FIELD_LABEL = "block text-[0.6875rem] font-bold tracking-[0.12em] uppercase";
const SEGMENT = "block min-w-20 rounded-full px-4 py-2.5 text-center text-[0.9375rem] font-semibold peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent";
const LATEST = 6;
const CATEGORIES = [
  { value: "house", name: "Houses", text: "Family homes, portions and villas" },
  { value: "apartment", name: "Apartments", text: "Flats and studios across the city" },
  { value: "plot", name: "Plots", text: "Residential and commercial land" },
  { value: "commercial", name: "Commercial", text: "Shops, offices and workspaces" },
];
const STEPS = [
  { name: "Say what you need", text: "Type or speak it in your own words. You see the filters it picked and can change any of them." },
  { name: "Check the price", text: "Where we have enough data, an estimated value sits beside the asking price." },
  { name: "Talk privately", text: "Message the seller or agency. Your phone number is never shown." },
  { name: "Selling? Get a head start", text: "An assistant helps fill in details and drafts a description for you to check." },
];

/** The home page: search first, then the newest Listings. Open to Visitors. */
export default async function HomePage() {
  const [result, places] = await Promise.all([fetchBrowse(new URLSearchParams()), fetchPlaces([])]);
  const cards = result.kind === "ok" ? result.cards.slice(0, LATEST) : [];
  const localities = places.localities.flatMap((group) => group.items);
  const ai = process.env.AI_FEATURES === "1";
  return (
    <div className="home">
      <section className={`${INNER} pt-[clamp(2.5rem,6vw,4.5rem)]`}>
        <div className="mb-9 grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] items-end gap-x-16 gap-y-8 max-[861px]:grid-cols-1">
          <div>
            <p className="eyebrow">Karachi property, made simpler</p>
            <h1 className="max-w-[13ch] font-serif text-[clamp(2.5rem,6.2vw,4.75rem)] leading-[1.02] font-semibold tracking-[-0.025em]">Find the home that fits your life</h1>
          </div>
          <div className="text-[1.0625rem] leading-[1.7] text-muted">
            <p>Houses, apartments, plots and commercial space, for sale and rent. No account needed to look around.</p>
            <Link href={BROWSE_PATH} className="arrow-link">
              Explore all properties
            </Link>
          </div>
        </div>

        <form action={BROWSE_PATH} method="get" className="flex flex-wrap items-center gap-2 rounded-full border border-line bg-surface p-2.5 shadow-[0_10px_40px_rgb(23_32_27/8%)] max-[861px]:flex-col max-[861px]:items-stretch max-[861px]:rounded-[1.25rem]" aria-label="Quick search">
          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">Purpose</legend>
            <div className="flex gap-1 rounded-full bg-sand p-1">
              <label className="flex-1 cursor-pointer">
                <input className="peer absolute opacity-0" type="radio" name="purpose" value="sale" defaultChecked />
                <span className={SEGMENT}>Buy</span>
              </label>
              <label className="flex-1 cursor-pointer">
                <input className="peer absolute opacity-0" type="radio" name="purpose" value="rent" />
                <span className={SEGMENT}>Rent</span>
              </label>
            </div>
          </fieldset>
          <div className={FIELD}>
            <label className={FIELD_LABEL} htmlFor="home-category">Property type</label>
            <select id="home-category" name="category" defaultValue="">
              <option value="">Any type</option>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          {localities.length > 0 && (
            <div className={`${FIELD} relative`}>
              <label className={FIELD_LABEL} htmlFor="home-locality">Area</label>
              <SearchSelect id="home-locality" name="locality" emptyLabel="Any area" searchLabel="Search areas" options={localities.map((locality) => ({ value: locality.id, label: locality.name }))} />
            </div>
          )}
          <button type="submit" className="primary-button min-h-13 px-7">
            Search properties
          </button>
        </form>
        {ai && (
          <details className="ai-search mt-3 [&>section]:mt-1">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[0.9375rem] font-semibold text-accent before:text-gold before:content-['✦'_/_''] hover:underline [&::-webkit-details-marker]:hidden">Or describe what you want, by typing or voice</summary>
            <SearchBox path={BROWSE_PATH} />
          </details>
        )}

        <div className="relative mt-6 h-[clamp(18rem,48vw,36rem)] overflow-hidden rounded-[1.25rem] bg-sand">
          <Image src="/images/hero.jpg" alt="" fill sizes="(max-width: 1216px) 100vw, 1216px" loading="eager" fetchPriority="high" className="object-cover" />
        </div>
      </section>

      <section className={SECTION} aria-labelledby="latest-title">
        <div className={SECTION_HEAD}>
          <div>
            <p className="eyebrow">Just listed</p>
            <h2 className={HEADING} id="latest-title">
              Newest properties
            </h2>
          </div>
          <Link href={BROWSE_PATH} className="arrow-link">
            View all properties
          </Link>
        </div>
        {cards.length > 0 ? (
          <ul className="browse-grid">
            {cards.map((card) => (
              <ListingCard key={card.listing.id} card={card} testId="home-card" />
            ))}
          </ul>
        ) : (
          <p className="muted">{result.kind === "ok" ? "There are no listings to show yet." : "We could not load the listings. Please try again shortly."}</p>
        )}
      </section>

      <section className={SECTION} aria-labelledby="types-title">
        <div className={SECTION_HEAD}>
          <div>
            <p className="eyebrow">Browse by type</p>
            <h2 className={HEADING} id="types-title">
              What are you looking for?
            </h2>
          </div>
        </div>
        <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-5 p-0">
          {CATEGORIES.map((category) => (
            <li key={category.value}>
              <Link href={`${BROWSE_PATH}?category=${category.value}`} className="group relative flex h-84 items-end overflow-hidden rounded-2xl bg-accent text-white">
                <Image src={`/images/${category.value}.jpg`} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 300px" className="object-cover transition-[scale] duration-400 group-hover:scale-105" />
                <span className="relative w-full bg-[linear-gradient(transparent,rgb(10_18_14/85%)_55%)] px-5 pt-16 pb-5">
                  <strong className="block font-serif text-[1.5rem]">{category.name}</strong>
                  <span className="text-[0.875rem]">{category.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {ai && (
        <section className={`${SECTION} grid grid-cols-2 items-center gap-x-18 gap-y-10 max-[901px]:grid-cols-1`} aria-labelledby="how-title">
          <div className="relative h-full min-h-88 overflow-hidden rounded-[1.25rem]">
            <Image src="/images/interior.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 560px" className="object-cover" />
          </div>
          <div>
            <p className="eyebrow">How EstateAI helps</p>
            <h2 className={HEADING} id="how-title">
              Less guesswork, from search to handover
            </h2>
            <ol className="mt-7 list-none p-0 [counter-reset:step]">
              {STEPS.map((step) => (
                <li key={step.name} className="grid grid-cols-[3rem_minmax(0,1fr)] border-t border-line py-4.5 [counter-increment:step] before:row-span-2 before:font-serif before:text-gold before:content-['0'_counter(step)]">
                  <strong>{step.name}</strong>
                  <span className="text-[0.9375rem] text-muted">{step.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {localities.length > 0 && (
        <section className={SECTION} aria-labelledby="areas-title">
          <div className={SECTION_HEAD}>
            <div>
              <p className="eyebrow">Neighbourhoods</p>
              <h2 className={HEADING} id="areas-title">
                Explore Karachi by area
              </h2>
            </div>
          </div>
          <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-x-8 p-0">
            {localities.slice(0, 12).map((locality) => (
              <li key={locality.id}>
                <Link href={`${BROWSE_PATH}?locality=${encodeURIComponent(locality.id)}`} className="flex min-h-14 items-center justify-between border-b border-line font-serif text-[1.125rem] after:text-gold after:content-['→'_/_''] hover:border-accent hover:text-accent">{locality.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={SECTION} aria-labelledby="sell-title">
        <div className="relative m-0 overflow-hidden rounded-[1.25rem] bg-accent-strong p-0 text-white [&_:focus-visible]:outline-white">
          <Image src="/images/villa.jpg" alt="" fill sizes="(max-width: 1216px) 100vw, 1216px" className="object-cover" />
          <div className="relative bg-[linear-gradient(90deg,rgb(12_26_20/92%)_40%,rgb(12_26_20/55%))] p-[clamp(2rem,6vw,4.5rem)]">
            <h2 className={`${HEADING} mb-3 max-w-[18ch]`} id="sell-title">
              Have a property to sell or rent out?
            </h2>
            <p>Create a free account to publish listings, save favourites and message sellers.</p>
            <p className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
              <Link href="/register" className="rounded-full bg-white px-6 py-3 font-semibold text-accent-strong">
                Create an account
              </Link>
              <Link href="/register/agency" className="font-semibold text-white underline underline-offset-[0.3em]">Register an agency</Link>
              <Link href="/sign-in" className="font-semibold text-white underline underline-offset-[0.3em]">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

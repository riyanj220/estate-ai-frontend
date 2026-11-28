import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { SearchBox } from "@/components/search-box";
import { BROWSE_PATH, fetchBrowse, fetchPlaces } from "@/lib/public-listings";

export const metadata: Metadata = { title: "EstateAI | Property for sale and rent in Karachi" };
export const dynamic = "force-dynamic";

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
      <section className="hero home-inner">
        <div className="hero-head">
          <div>
            <p className="eyebrow">Karachi property, made simpler</p>
            <h1 className="hero-title">Find the home that fits your life</h1>
          </div>
          <div className="hero-aside">
            <p>Houses, apartments, plots and commercial space, for sale and rent. No account needed to look around.</p>
            <Link href={BROWSE_PATH} className="arrow-link">
              Explore all properties
            </Link>
          </div>
        </div>

        <form action={BROWSE_PATH} method="get" className="searchbar" aria-label="Quick search">
          <fieldset className="searchbar-purpose">
            <legend className="sr-only">Purpose</legend>
            <div className="segmented">
              <label>
                <input type="radio" name="purpose" value="sale" defaultChecked />
                <span>Buy</span>
              </label>
              <label>
                <input type="radio" name="purpose" value="rent" />
                <span>Rent</span>
              </label>
            </div>
          </fieldset>
          <div className="searchbar-field">
            <label htmlFor="home-category">Property type</label>
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
            <div className="searchbar-field">
              <label htmlFor="home-locality">Area</label>
              <select id="home-locality" name="locality" defaultValue="">
                <option value="">Any area</option>
                {localities.map((locality) => (
                  <option key={locality.id} value={locality.id}>
                    {locality.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="primary-button searchbar-submit">
            Search properties
          </button>
        </form>
        {ai && (
          <details className="ai-search">
            <summary>Or describe what you want, by typing or voice</summary>
            <SearchBox path={BROWSE_PATH} />
          </details>
        )}

        <div className="hero-photo">
          <Image src="/images/hero.jpg" alt="" fill sizes="(max-width: 1216px) 100vw, 1216px" loading="eager" fetchPriority="high" />
        </div>
      </section>

      <section className="home-section home-inner" aria-labelledby="latest-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Just listed</p>
            <h2 className="section-title" id="latest-title">
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

      <section className="home-section home-inner" aria-labelledby="types-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Browse by type</p>
            <h2 className="section-title" id="types-title">
              What are you looking for?
            </h2>
          </div>
        </div>
        <ul className="photo-tiles">
          {CATEGORIES.map((category) => (
            <li key={category.value}>
              <Link href={`${BROWSE_PATH}?category=${category.value}`}>
                <Image src={`/images/${category.value}.jpg`} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 300px" />
                <span className="photo-tile-text">
                  <strong>{category.name}</strong>
                  <span>{category.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {ai && (
        <section className="home-section home-inner feature" aria-labelledby="how-title">
          <div className="feature-photo">
            <Image src="/images/interior.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 560px" />
          </div>
          <div>
            <p className="eyebrow">How EstateAI helps</p>
            <h2 className="section-title" id="how-title">
              Less guesswork, from search to handover
            </h2>
            <ol className="steps">
              {STEPS.map((step) => (
                <li key={step.name}>
                  <strong>{step.name}</strong>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {localities.length > 0 && (
        <section className="home-section home-inner" aria-labelledby="areas-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Neighbourhoods</p>
              <h2 className="section-title" id="areas-title">
                Explore Karachi by area
              </h2>
            </div>
          </div>
          <ul className="area-grid">
            {localities.slice(0, 12).map((locality) => (
              <li key={locality.id}>
                <Link href={`${BROWSE_PATH}?locality=${encodeURIComponent(locality.id)}`}>{locality.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-inner home-section" aria-labelledby="sell-title">
        <div className="cta-band">
          <Image src="/images/villa.jpg" alt="" fill sizes="(max-width: 1216px) 100vw, 1216px" />
          <div className="cta-content">
            <h2 className="section-title" id="sell-title">
              Have a property to sell or rent out?
            </h2>
            <p>Create a free account to publish listings, save favourites and message sellers.</p>
            <p className="cta-links">
              <Link href="/register" className="cta-primary">
                Create an account
              </Link>
              <Link href="/register/agency">Register an agency</Link>
              <Link href="/sign-in">Sign in</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

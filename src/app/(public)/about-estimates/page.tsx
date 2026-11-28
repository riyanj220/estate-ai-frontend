import type { Metadata } from "next";

export const metadata: Metadata = { title: "About AI Price Estimates | EstateAI" };

// The facts here follow the backend's docs/valuation.md: change them together.
export default function AboutEstimatesPage() {
  return (
    <>
      <h1 className="page-title">About AI Price Estimates</h1>
      <p className="muted">
        An AI Price Estimate is an AI-generated approximation of a property’s price. It is not a verified market valuation or a guaranteed
        return.
      </p>
      <section className="card" aria-labelledby="about-source" style={{ marginBottom: "var(--space)" }}>
        <h2 id="about-source" className="section-title">
          Where the figures come from
        </h2>
        <p>
          The figures come from a model trained on synthetic data about Karachi: data generated for this project from stated assumptions, not
          collected from real sales or adverts. How accurate the model is on that data says nothing about how accurate it is for the real
          market.
        </p>
      </section>
      <section className="card" aria-labelledby="about-inputs" style={{ marginBottom: "var(--space)" }}>
        <h2 id="about-inputs" className="section-title">
          What an estimate uses
        </h2>
        <ul className="list-disc pl-5">
          <li>Property type and locality</li>
          <li>Area (with the marla size where it applies) and covered area</li>
          <li>Bedrooms, bathrooms, construction year and condition</li>
          <li>Corner plot, road width and development status</li>
          <li>The number of amenities marked as present</li>
        </ul>
        <p>It does not use the asking price, the street or house number, map coordinates, phone numbers, the title, the description or images.</p>
      </section>
      <section className="card" aria-labelledby="about-drivers" style={{ marginBottom: "var(--space)" }}>
        <h2 id="about-drivers" className="section-title">
          What moves the price
        </h2>
        <p>
          For each detail, the model estimates the same property again with only that detail swapped for a typical one: for example a typical
          Karachi locality, or a building in good condition. The difference is shown as a percentage. It explains what the model does, not what
          the market will pay, and the percentages do not add up to a total.
        </p>
      </section>
      <section className="card" aria-labelledby="about-forecast" style={{ marginBottom: "var(--space)" }}>
        <h2 id="about-forecast" className="section-title">
          The 5-Year Price Forecast
        </h2>
        <p>
          The forecast takes the estimate and applies an assumed yearly growth rate for the locality’s group, compounded over five years, giving
          a low, a middle and a high scenario. The rates were chosen for this project. They are scenarios, not predictions that have been
          tested, and not a guaranteed return.
        </p>
      </section>
      <section className="card" aria-labelledby="about-limits">
        <h2 id="about-limits" className="section-title">
          Limitations
        </h2>
        <ul className="list-disc pl-5">
          <li>Estimates approximate asking prices, not transaction prices.</li>
          <li>Only houses, apartments and residential plots for sale, in covered Karachi localities. Other properties show no figure.</li>
          <li>It cannot see the property, so build quality, view, legal status and anything not listed above are not reflected.</li>
          <li>Use it as one reference next to your own research and professional advice.</li>
        </ul>
      </section>
    </>
  );
}

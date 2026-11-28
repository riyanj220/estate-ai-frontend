"use client";

import { useRef, useState } from "react";
import { AskingVsEstimate } from "@/components/valuation/asking-vs-estimate";
import { EstimateFigure } from "@/components/valuation/estimate-figure";
import { ForecastChart } from "@/components/valuation/forecast-chart";
import { PriceDrivers } from "@/components/valuation/price-drivers";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { readEstimate, readListingEstimate, type ListingEstimate } from "@/lib/listing/estimate";
import { REJECTED_ERROR, UPLOAD_TIMEOUT_MS, withTimeout } from "@/lib/forms/forms";
import { formatPrice } from "@/lib/listing/listing-labels";
import {
  ABOUT_EQUAL_TEXT,
  ABOUT_ESTIMATES_PATH,
  ASKING_TOTAL_LABEL,
  comparisonText,
  ESTIMATE_FORBIDDEN,
  ESTIMATE_UNAVAILABLE,
  FORECAST_TITLE,
  FORECAST_UNAVAILABLE,
  LISTING_ESTIMATE_TITLE,
  RECOMPUTE_BUTTON,
  RECOMPUTE_DONE,
  RECOMPUTE_SIGNED_OUT,
  RECOMPUTE_WORKING,
} from "@/lib/listing/listing-messages";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import Link from "next/link";

const VERDICTS = {
  above: { mark: "↑", tone: "bg-[#fbf0d9] text-[#6b4a0f]" },
  below: { mark: "↓", tone: "bg-[#e3f1e6] text-[#1d5b33]" },
  about_equal: { mark: "≈", tone: "bg-sand text-text" },
};
const EYEBROW = "text-[0.75rem] font-bold tracking-[0.12em] text-muted uppercase";

/**
 * The price insight of a public Listing (Stories 4.6 and 4.7): the total asking price beside the Estimated Property Value, the server's
 * verdict and the 5-Year Price Forecast, with the one info button of `EstimateFigure` for all of them. The owner can recompute.
 * `factors` names the details of this Listing that the model reads. A Listing with no estimate (rent, a kind or area the model does not
 * cover) shows nothing at all.
 */
export function ListingEstimatePanel({ listingId, initial, factors = [] }: { listingId: string; initial: ListingEstimate | null; factors?: string[] }) {
  const [insight, setInsight] = useState(initial);
  const [working, setWorking] = useState(false);
  const [outcome, setOutcome] = useState("");
  const running = useRef(false);

  async function recompute() {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    setOutcome("");
    try {
      const api = await getApi();
      const path = { listing_id: listingId };
      const { data, response } = await withCsrf((csrf) =>
        withTimeout((signal) => api.POST("/api/v1/listings/{listing_id}/estimate", { params: { path }, headers: { "X-CSRFToken": csrf }, signal }), UPLOAD_TIMEOUT_MS),
      );
      if (!response.ok) {
        setOutcome(
          response.status === 401 ? RECOMPUTE_SIGNED_OUT : response.status === 403 ? ESTIMATE_FORBIDDEN : failureMessage(response.status, response.headers.get("Retry-After")),
        );
        return;
      }
      const answer = readEstimate(data);
      if (!answer) return setOutcome(REJECTED_ERROR);
      // The comparison and forecast of what is now stored.
      const fresh = await withTimeout((signal) => api.GET("/api/v1/public/listings/{listing_id}/estimate", { params: { path }, signal }), UPLOAD_TIMEOUT_MS);
      const read = fresh.response.ok ? readListingEstimate(fresh.data) : null;
      if (!read) return setOutcome(failureMessage(fresh.response.status, fresh.response.headers.get("Retry-After")));
      setInsight(read);
      setOutcome(answer.kind === "value" ? RECOMPUTE_DONE : `${ESTIMATE_UNAVAILABLE} ${answer.message}`);
    } catch (error) {
      setOutcome(thrownMessage(error));
    } finally {
      running.current = false;
      setWorking(false);
    }
  }

  const estimate = insight?.estimate;
  const { askingTotal = null, comparison = null, forecast = null } = insight ?? {};
  // A card that was shown stays, so a failed recompute can still be read.
  if (initial?.estimate.kind !== "value" && estimate?.kind !== "value") return null;

  return (
    <section className="price-insight overflow-hidden rounded-large border border-accent/25 bg-surface" aria-labelledby="price-insight-title" data-testid="price-insight">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[linear-gradient(120deg,var(--color-accent-strong),#2c5a46)] px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-white/15 text-[1.25rem]">
            ✦
          </span>
          <div>
            <h2 id="price-insight-title" className="font-serif text-[1.375rem] leading-tight font-semibold">
              {LISTING_ESTIMATE_TITLE}
            </h2>
            <p className="text-[0.8125rem] text-white/85">Is the asking price fair? Our model’s view.</p>
          </div>
        </div>
        <span className="rounded-full border border-white/35 px-3 py-1 text-[0.75rem] font-bold tracking-[0.08em] uppercase">AI valuation</span>
      </header>
      <div className="p-6">
        {estimate?.kind === "value" ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 [&_.estimate-figure]:mb-0 [&_strong]:font-serif [&_strong]:text-[1.5rem] sm:[&_strong]:text-[1.75rem] [&_strong]:leading-tight [&_strong]:text-accent">
              <EstimateFigure value={estimate.value} testId="listing-estimate" />
              {askingTotal !== null && (
                <div className="sm:text-right">
                  <span className="block text-[0.875rem] text-muted">{ASKING_TOTAL_LABEL}</span>
                  <span className="text-[1.25rem] font-semibold" data-testid="asking-total">
                    PKR {formatPrice(askingTotal)}
                  </span>
                </div>
              )}
            </div>
            {comparison && (
              <p className={`mt-4 flex items-center gap-3 rounded-xl px-4 py-3 font-semibold ${VERDICTS[comparison.verdict].tone}`}>
                <span aria-hidden="true" className="text-[1.25rem]">
                  {VERDICTS[comparison.verdict].mark}
                </span>
                <span data-testid="price-comparison">{comparison.verdict === "about_equal" ? ABOUT_EQUAL_TEXT : comparisonText(comparison.verdict, comparison.percent)}</span>
              </p>
            )}
            {askingTotal !== null && (
              <div className="mt-5">
                <AskingVsEstimate asking={Number(askingTotal)} estimate={Number(estimate.value)} />
              </div>
            )}
            {insight && insight.drivers.length > 0 && (
              <div className="mt-6 border-t border-line pt-5">
                <h3 className={EYEBROW}>What moves this price</h3>
                <PriceDrivers drivers={insight.drivers} />
                <p className="mt-3 text-[0.8125rem] text-muted">
                  Each bar is how the AI’s estimate changes against a typical property with everything else the same. They do not add up to a total.
                </p>
              </div>
            )}
            <div className="mt-6 border-t border-line pt-5">
              <h3 className={EYEBROW}>{FORECAST_TITLE}</h3>
              {forecast ? (
                <>
                  <ForecastChart estimate={Number(estimate.value)} forecast={forecast} />
                  <p className="mt-3 text-[0.875rem] text-muted" data-testid="price-forecast">
                    <strong className="text-text">
                      PKR {formatPrice(forecast.low)} to PKR {formatPrice(forecast.high)}
                    </strong>{" "}
                    in {forecast.years} years (middle scenario PKR {formatPrice(forecast.base)}).
                  </p>
                </>
              ) : (
                <p className="mt-2 text-muted" data-testid="price-forecast">
                  {FORECAST_UNAVAILABLE}
                </p>
              )}
            </div>
            {factors.length > 0 && (
              <div className="mt-6 border-t border-line pt-5">
                <h3 className={EYEBROW}>What the AI looked at</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {factors.map((factor) => (
                    <li key={factor} className="rounded-full bg-accent-soft px-3 py-1 text-[0.8125rem] font-medium text-accent">
                      {factor}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[0.8125rem] text-muted">
                  It never sees the asking price, photos or description. Trained on synthetic Karachi data, so treat it as a guide.{" "}
                  <Link href={ABOUT_ESTIMATES_PATH} className="text-link">
                    How estimates work
                  </Link>
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="state-note" data-testid="listing-estimate-unavailable">
              {ESTIMATE_UNAVAILABLE} {estimate?.message}
            </p>
            <p className="muted mb-0">{FORECAST_UNAVAILABLE}</p>
          </>
        )}
      {insight?.canRecompute && (
        <>
          <button type="button" className="secondary-button" aria-disabled={working ? true : undefined} onClick={() => void recompute()}>
            {working ? RECOMPUTE_WORKING : RECOMPUTE_BUTTON}
          </button>
          <p role="status" className={outcome ? "save-note" : "sr-only"} data-testid="recompute-status">
            {outcome}
          </p>
        </>
      )}
      </div>
    </section>
  );
}

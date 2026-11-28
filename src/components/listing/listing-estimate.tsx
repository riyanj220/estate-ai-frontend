"use client";

import { useRef, useState } from "react";
import { EstimateFigure } from "@/components/listing/estimate-figure";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { readEstimate, readListingEstimate, type ListingEstimate } from "@/lib/listing/estimate";
import { REJECTED_ERROR, UPLOAD_TIMEOUT_MS, withTimeout } from "@/lib/forms/forms";
import { formatPrice } from "@/lib/listing/listing-labels";
import {
  ABOUT_EQUAL_TEXT,
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

/**
 * The price insight of a public Listing (Stories 4.6 and 4.7): the total asking price beside the Estimated Property Value, the server's
 * verdict and the 5-Year Price Forecast, with the one info button of `EstimateFigure` for all of them. The owner can recompute.
 */
export function ListingEstimatePanel({ listingId, initial }: { listingId: string; initial: ListingEstimate | null }) {
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

  return (
    <section className="price-insight" aria-labelledby="price-insight-title" data-testid="price-insight">
      <h2 id="price-insight-title" className="section-title">
        {LISTING_ESTIMATE_TITLE}
      </h2>
      {estimate?.kind === "value" ? (
        <>
          <div className="price-compare">
            {askingTotal !== null && (
              <div>
                <span className="block text-muted text-[0.875rem]">{ASKING_TOTAL_LABEL}</span>
                <span className="flex flex-wrap items-center gap-2 text-[1.25rem]">
                  <strong data-testid="asking-total">PKR {formatPrice(askingTotal)}</strong>
                </span>
              </div>
            )}
            <EstimateFigure value={estimate.value} testId="listing-estimate" />
          </div>
          {comparison && (
            <p data-testid="price-comparison">{comparison.verdict === "about_equal" ? ABOUT_EQUAL_TEXT : comparisonText(comparison.verdict, comparison.percent)}</p>
          )}
          <h3 className="block text-muted text-[0.875rem]">{FORECAST_TITLE}</h3>
          {forecast ? (
            <p data-testid="price-forecast">
              <strong>
                PKR {formatPrice(forecast.low)} to PKR {formatPrice(forecast.high)}
              </strong>{" "}
              in {forecast.years} years (middle scenario PKR {formatPrice(forecast.base)}).
            </p>
          ) : (
            <p data-testid="price-forecast">{FORECAST_UNAVAILABLE}</p>
          )}
        </>
      ) : (
        <>
          <p className="state-note" data-testid="listing-estimate-unavailable">
            {ESTIMATE_UNAVAILABLE} {estimate?.message}
          </p>
          <p className="muted">{FORECAST_UNAVAILABLE}</p>
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
    </section>
  );
}

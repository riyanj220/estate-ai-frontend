"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { formatResetDate as formatDate } from "@/lib/publication-allowance";
import { useAdminRead, useAdminWrite, words } from "../moderation-shared";

type Oversight = components["schemas"]["AiOversight"];
type Switch = Oversight["switches"][number];

/** AI feature status, failures and the valuation model (Story 10.6). No content or personal data. */
export function AiOversight() {
  const send = useCallback(async (signal: AbortSignal) => (await getApi()).GET("/api/v1/admin/ai-oversight", { cache: "no-store", signal }), []);
  const { data, failure, reload, gone } = useAdminRead<Oversight>(send, "/admin/ai");
  const [notice, setNotice] = useState("");
  const { working, write } = useAdminWrite(gone, setNotice);

  function toggle(item: Switch) {
    void write<components["schemas"]["AiSwitch"]>(
      async (csrf, signal) =>
        (await getApi()).POST("/api/v1/admin/ai-oversight/switches/{name}", {
          params: { path: { name: item.name } },
          body: { enabled: !item.enabled },
          headers: { "X-CSRFToken": csrf },
          cache: "no-store",
          signal,
        }),
      {
        done: (state) => {
          setNotice(`${state.label} is now ${state.enabled ? "on" : "off"}.`);
          void reload();
        },
      },
    );
  }

  return (
    <>
      <h1 className="page-title">AI oversight</h1>
      <p role="status" aria-live="polite" className={notice ? "state-note" : "sr-only"} data-testid="ai-notice">
        {notice}
      </p>
      {failure && <p role="alert">{failure}</p>}
      {!data && !failure && <p className="muted">Loading…</p>}
      {data && (
        <>
          <section className="card" aria-labelledby="switches-title" style={{ marginBottom: "var(--space)" }}>
            <h2 id="switches-title" className="section-title">
              Features
            </h2>
            <p className="muted">A feature that is off tells people it is unavailable; manual forms and filters keep working.</p>
            <ul aria-label="AI features">
              {data.switches.map((item) => (
                <li key={item.name} data-testid="ai-switch" style={{ marginBottom: "var(--space)" }}>
                  <p>
                    {item.label}: <strong>{item.enabled ? "On" : "Off"}</strong>
                  </p>
                  <button type="button" className="secondary-button" aria-label={`Turn ${item.enabled ? "off" : "on"} ${item.label}`} aria-disabled={working || undefined} onClick={() => toggle(item)}>
                    {item.enabled ? "Turn off" : "Turn on"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="card" aria-labelledby="calls-title" style={{ marginBottom: "var(--space)" }}>
            <h2 id="calls-title" className="section-title">
              Requests in the last {data.window_days} days
            </h2>
            {data.calls.length === 0 ? (
              <p className="muted">No requests.</p>
            ) : (
              <ul aria-label="AI requests">
                {data.calls.map((row) => (
                  <li key={row.feature} className="account-text">
                    {words(row.feature)}: {row.total} requests, {row.failed} failed (
                    {Object.entries(row.outcomes)
                      .map(([outcome, count]) => `${words(outcome)} ${count}`)
                      .join(", ")}
                    )
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card" aria-labelledby="valuation-title" style={{ marginBottom: "var(--space)" }}>
            <h2 id="valuation-title" className="section-title">
              Valuation model
            </h2>
            <p data-testid="valuation-model">
              {data.valuation_model ? `${data.valuation_model.name} version ${data.valuation_model.version}, trained ${formatDate(data.valuation_model.trained_at)}` : "No model is deployed."}
            </p>
            <h3 className="section-title">Failed valuation requests</h3>
            {data.failed_valuations.length === 0 ? (
              <p className="muted">None.</p>
            ) : (
              <ul aria-label="Failed valuations">
                {data.failed_valuations.map((row) => (
                  <li key={row.created_at} className="account-text">
                    {formatDate(row.created_at)}: {words(row.outcome)} ({row.model}, {row.latency_ms} ms)
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Link href="/admin/reports?reason=ai_generated_content" className="text-link">
            Reports about AI-generated content
          </Link>
        </>
      )}
    </>
  );
}

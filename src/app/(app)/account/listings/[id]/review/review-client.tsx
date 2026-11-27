"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { useAiNotice } from "@/components/ai-notice";
import { getApi } from "@/lib/api";
import { TURN_TIMEOUT_MS } from "@/lib/assistant";
import { withCsrf } from "@/lib/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms";
import { detailLabel } from "@/lib/listing-details";
import { isListingId, readListing, type ListingView } from "@/lib/listing-labels";
import { LISTINGS_PATH, LISTING_NOT_FOUND, signInPathFor } from "@/lib/listing-messages";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import {
  CHANGED_ELSEWHERE,
  CONFIRM_REFUSED,
  DESCRIPTION_FAILED,
  DESCRIPTION_NOTHING,
  DESCRIPTION_OUTCOMES,
  DESCRIPTION_OWN,
  DESCRIPTION_REFUSED,
  DESCRIPTION_SAVED,
  DESCRIPTION_WRITTEN,
  NOT_A_DRAFT_REVIEW,
  SENSITIVE_FIELDS,
  WRITE_YOURSELF,
  readUnconfirmed,
  reviewFields,
  reviewName,
  reviewValue,
} from "@/lib/review";
import { usePageshowRecheck } from "@/lib/use-pageshow-recheck";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";
import { useAmenityCatalogue, useLocationLists } from "@/lib/use-reference";
import { useRegistry, type Registry } from "@/lib/use-registry";

const HEADING_ID = "review-title";

type Draft = { listing: ListingView; revision: number; unconfirmed: string[] };
type Loaded = { draft: Draft | null };
type Claim = components["schemas"]["AssistantClaim"];

function readDraft(data: unknown): Draft | null {
  const listing = readListing(data);
  return listing && listing.revision !== null ? { listing, revision: listing.revision, unconfirmed: readUnconfirmed(data) } : null;
}

async function fetchDraft(id: string): Promise<ProfileFetch<Loaded>> {
  if (!isListingId(id)) return { kind: "ready", profile: { draft: null } };
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) =>
      api.GET("/api/v1/listings/{listing_id}", { params: { path: { listing_id: id } }, cache: "no-store", signal }),
    );
    if (response.ok) {
      const draft = readDraft(data);
      return draft ? { kind: "ready", profile: { draft } } : { kind: "error" };
    }
    if (response.status === 401) return "gone";
    if ([400, 403, 404, 422].includes(response.status)) return { kind: "ready", profile: { draft: null } };
    return { kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")) };
  } catch (error) {
    return { kind: "error", message: thrownMessage(error) };
  }
}

/**
 * The review of a Draft (Stories 5.12 and 5.13): each value is confirmed by the owner's own click, and the description can be written
 * by the assistant or by hand. Nothing here publishes: that stays on the Draft page.
 */
export function ReviewClient({ id, admin, ai }: { id: string; admin: boolean; ai: boolean }) {
  const signInPath = signInPathFor(`${LISTINGS_PATH}/${id}/review`, admin);
  const { load, read, retry, sessionGone } = useResourceLoad<Loaded>(() => fetchDraft(id), HEADING_ID, { signInPath, refreshOnFocus: false });
  usePageshowRecheck(signInPath, () => void read(false));
  const registry = useRegistry(signInPath);
  const back = isListingId(id) ? `${LISTINGS_PATH}/${id}` : LISTINGS_PATH;
  return (
    <>
      <h1 id={HEADING_ID} tabIndex={-1} className="page-title">
        Review your listing
      </h1>
      {load.kind !== "ready" ? (
        <ProfileLoadState load={load} onRetry={retry} noun="draft" />
      ) : !load.profile.draft ? (
        <p className="card" data-testid="review-refusal">
          {LISTING_NOT_FOUND}
        </p>
      ) : load.profile.draft.listing.status !== "draft" ? (
        <p className="card" data-testid="review-refusal">
          {NOT_A_DRAFT_REVIEW}
        </p>
      ) : registry.status !== "ready" ? (
        <div className="card">
          <p role="status">{registry.status === "loading" ? "Loading the fields…" : "The fields could not be loaded."}</p>
          {registry.status === "error" && (
            <button type="button" className="secondary-button" onClick={registry.retry}>
              Retry
            </button>
          )}
        </div>
      ) : (
        <Review initial={load.profile.draft} registry={registry.registry} ai={ai} signInPath={signInPath} onSessionGone={sessionGone} />
      )}
      <p>
        <Link href={back} className="text-link">
          Back to the draft to edit or publish
        </Link>
      </p>
      {ai && isListingId(id) && (
        <p>
          <Link href={`${back}/assistant`} className="text-link">
            Back to the AI assistant
          </Link>
        </p>
      )}
    </>
  );
}

function Review({
  initial,
  registry,
  ai,
  signInPath,
  onSessionGone,
}: {
  initial: Draft;
  registry: Registry;
  ai: boolean;
  signInPath: string;
  onSessionGone: () => Promise<void>;
}) {
  const router = useRouter();
  const { withNotice, notice } = useAiNotice();
  const [draft, setDraft] = useState(initial);
  const [text, setText] = useState(initial.listing.fields.description ?? "");
  const [message, setMessage] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [leftOut, setLeftOut] = useState<string[]>([]);
  const [askReplace, setAskReplace] = useState(false);
  const [busy, setBusy] = useState("");
  const running = useRef(false);
  const status = useRef<HTMLParagraphElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const { listing, revision, unconfirmed } = draft;
  const { category } = listing.fields;
  const cityId = listing.details.city ?? "";
  const lists = useLocationLists(cityId, cityId !== "");
  const catalogue = useAmenityCatalogue((listing.details.amenities ?? "") !== "");
  const names = {
    city: cityId ? lists.nameOf("city", cityId) : null,
    locality: listing.details.locality ? lists.nameOf("locality", listing.details.locality) : null,
    amenities: catalogue.items,
  };
  const saved = listing.fields.description ?? "";
  const dirty = text !== saved;

  /** Shows the outcome and moves focus to it: the control that caused it may be gone. */
  function say(sentence: string) {
    setMessage(sentence);
    queueMicrotask(() => status.current?.focus());
  }

  function accept(next: Draft) {
    setDraft(next);
    setText(next.listing.fields.description ?? "");
  }

  /** One action at a time; 401, a stale revision and a thrown request are handled the same way for each. */
  async function run(name: string, action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(name);
    setMessage("");
    try {
      await action();
    } catch (error) {
      if (mounted.current) say(name === "write" ? `${thrownMessage(error)} ${WRITE_YOURSELF}` : thrownMessage(error));
    } finally {
      running.current = false;
      if (mounted.current) setBusy("");
    }
  }

  async function failed(response: Response) {
    if (response.status === 401) {
      await onSessionGone();
      router.replace(signInPath);
      return;
    }
    if (response.status === 409) {
      const latest = await fetchDraft(listing.id);
      if (latest !== "gone" && latest.kind === "ready" && latest.profile.draft) accept(latest.profile.draft);
      say(CHANGED_ELSEWHERE);
      return;
    }
    say(failureMessage(response.status, response.headers.get("Retry-After")));
  }

  const confirm = (field: string) =>
    run(field, async () => {
      const api = await getApi();
      const { data, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.POST("/api/v1/listings/{listing_id}/confirm", {
            params: { path: { listing_id: listing.id } },
            body: { base_revision: revision, fields: [field] },
            headers: { "X-CSRFToken": csrf },
            signal,
          }),
        ),
      );
      const next = response.ok ? readDraft(data) : null;
      if (next) {
        // Text typed but not saved stays.
        setDraft(next);
        if (!dirty) setText(next.listing.fields.description ?? "");
        say(`Confirmed: ${reviewName(field, category)}.`);
      } else if (response.status === 400) say(CONFIRM_REFUSED);
      else await failed(response);
    });

  const save = () =>
    run("save", async () => {
      const api = await getApi();
      const { data, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.PATCH("/api/v1/listings/{listing_id}", {
            params: { path: { listing_id: listing.id } },
            body: { base_revision: revision, fields: { description: text } } as components["schemas"]["ListingUpdateRequest"],
            headers: { "X-CSRFToken": csrf },
            signal,
          }),
        ),
      );
      const next = response.ok ? readDraft(data) : null;
      if (next) {
        accept(next);
        setClaims([]);
        setAskReplace(false);
        say(DESCRIPTION_SAVED);
      } else if (response.status === 400) say(DESCRIPTION_REFUSED);
      else await failed(response);
    });

  const write = (replace: boolean) =>
    run("write", async () => {
      const api = await getApi();
      const opened = await withCsrf((csrf) =>
        withTimeout((signal) => api.POST("/api/v1/assistant/sessions", { body: { listing_id: listing.id }, headers: { "X-CSRFToken": csrf }, signal })),
      );
      if (!opened.data) return failed(opened.response);
      const session = opened.data.id;
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout(
          (signal) =>
            api.POST("/api/v1/assistant/sessions/{session_id}/description", {
              params: { path: { session_id: session } },
              body: { base_revision: revision, replace },
              headers: { "X-CSRFToken": csrf },
              signal,
            }),
          TURN_TIMEOUT_MS,
        ),
      );
      if (!mounted.current) return;
      if (response.status === 400) {
        const codes = readErrorBody(error)?.fields?.description ?? [];
        if (codes.includes("manual_description")) {
          setAskReplace(true);
          say(DESCRIPTION_OWN);
        } else say(DESCRIPTION_NOTHING);
        return;
      }
      if (response.status === 401 || response.status === 409) return failed(response);
      if (response.status !== 200) return say(`${failureMessage(response.status, response.headers.get("Retry-After"))} ${WRITE_YOURSELF}`);
      setLeftOut(data?.left_out ?? []);
      const next = data?.outcome === "success" ? readDraft(data.listing) : null;
      if (!next) return say(DESCRIPTION_OUTCOMES[data?.outcome ?? ""] ?? DESCRIPTION_FAILED);
      accept(next);
      setClaims(data?.claims ?? []);
      setAskReplace(false);
      say(DESCRIPTION_WRITTEN);
    });

  return (
    <>
      <p className="muted">
        Check each value. A value the assistant filled in counts only after you confirm it; to change one, edit it in the draft. Nothing is
        published from this page.
      </p>
      <p ref={status} tabIndex={-1} role="status" className={message ? "notice" : "sr-only"} data-testid="review-status">
        {message}
      </p>
      <section className="card" aria-labelledby="review-values" style={{ marginBottom: "var(--space)" }}>
        <h2 id="review-values" className="section-title">
          Your details
        </h2>
        <ul className="chat-list">
          {reviewFields(listing, registry, unconfirmed).map((field) => {
            const value = reviewValue(listing, field, names);
            const name = reviewName(field, category);
            const pending = value !== null && unconfirmed.includes(field);
            const needed = SENSITIVE_FIELDS.includes(field) || registry.field(field)?.identity === true;
            return (
              <li key={field} data-testid={`review-${field}`}>
                <p className="chat-text">
                  <strong>{name}: </strong>
                  {value ?? "Missing"}
                </p>
                <p className="muted">
                  {value === null
                    ? "Add it in the draft."
                    : pending
                      ? `Filled in by the assistant, not confirmed.${needed ? " Needed before publishing." : ""}`
                      : "Confirmed"}
                </p>
                {pending && (
                  <button type="button" className="secondary-button" aria-disabled={busy ? true : undefined} onClick={() => void confirm(field)}>
                    Confirm {name.toLowerCase()}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="card" aria-labelledby="review-description" style={{ marginBottom: "var(--space)" }} aria-busy={busy === "write"}>
        <h2 id="review-description" className="section-title">
          Description
        </h2>
        <div className="field">
          <label htmlFor="review-text">Your description</label>
          <p id="review-text-hint" className="hint">
            Plain text, without phone numbers or email addresses.
          </p>
          <textarea
            id="review-text"
            rows={8}
            maxLength={5000}
            aria-describedby="review-text-hint"
            readOnly={busy !== ""}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        {saved && unconfirmed.includes("description") && !dirty && (
          <>
            <p className="muted" data-testid="review-description-unconfirmed">
              Written by the assistant, not confirmed.
            </p>
            <button type="button" className="secondary-button" aria-disabled={busy ? true : undefined} onClick={() => void confirm("description")}>
              Keep this description
            </button>
          </>
        )}
        {dirty && (
          <button type="button" className="primary-button" aria-disabled={busy ? true : undefined} onClick={() => void save()}>
            Save description
          </button>
        )}
        {ai && !dirty && (
          <button type="button" className="secondary-button" aria-disabled={busy ? true : undefined} onClick={() => withNotice(() => void write(askReplace))}>
            {askReplace ? "Replace my description" : "Write it with AI"}
          </button>
        )}
        <p role="status" className="muted">
          {busy === "write" ? "Writing the description…" : ""}
        </p>
        {claims.length > 0 && (
          <div data-testid="review-claims">
            <p>What each sentence is based on:</p>
            <ul>
              {claims.map((claim, index) => (
                <li key={index} className="chat-text">
                  {claim.text} ({claim.fields.map((field) => reviewName(field, category)).join(", ")})
                </li>
              ))}
            </ul>
          </div>
        )}
        {leftOut.length > 0 && (
          <p className="muted" data-testid="review-left-out">
            Not used because they are not confirmed: {leftOut.map((field) => detailLabel(field)).join(", ")}.
          </p>
        )}
      </section>
      {notice}
    </>
  );
}

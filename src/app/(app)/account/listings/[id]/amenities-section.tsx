"use client";

import { useEffect, useRef, useState } from "react";
import {
  NOT_ANSWERED_TEXT,
  STATE_TEXT,
  amenityLabel,
  decodeAmenities,
  groupCatalogue,
  otherCodes,
  withAmenity,
  type AmenityState,
  type CatalogueItem,
} from "@/lib/listing/amenities";
import { AMENITIES_HELP, NEARBY_HELP, OTHER_AMENITIES, OTHER_AMENITIES_HELP, SELLER_DECLARED, detailLabel } from "@/lib/listing/listing-details";
import { AMENITIES_EMPTY, AMENITIES_FAILED, AMENITIES_LOADED, AMENITIES_LOADING } from "@/lib/listing/listing-messages";
import type { AmenityCatalogue } from "@/lib/reference/use-reference";

const OPTIONS: { state: AmenityState | ""; text: string }[] = [
  { state: "present", text: STATE_TEXT.present },
  { state: "none", text: STATE_TEXT.none },
  { state: "", text: NOT_ANSWERED_TEXT },
];

/**
 * The Amenities block of the Draft editor (Story 2.8), the control of the registry type `amenities`: the catalogue grouped by kind (On the
 * property, Community, Nearby) with a sub-heading per group, and per item a fieldset of three radios: Present, None and Not answered (the
 * default; it removes the code, and unanswered is never None). The map is held by the editor as one text; every change here replaces only the
 * code that was chosen, so the codes this list does not offer stay as they are and are shown read-only under "Other". Nearby facilities are the
 * owner's own declaration: they carry the "Seller-declared" tag and its helper, and there is no distance and no verification anywhere.
 */
export function AmenitiesSection({
  value,
  errors,
  catalogue,
  onChange,
  conflictRow,
  inConflict,
}: {
  value: string;
  errors: string[] | undefined;
  catalogue: AmenityCatalogue;
  onChange: (next: string) => void;
  conflictRow: (id: string) => React.ReactNode;
  inConflict: (id: string) => boolean;
}) {
  const map = decodeAmenities(value);
  // After a Retry that works: focus moves to the section heading and the loaded state is announced once (the status is the live region).
  const heading = useRef<HTMLHeadingElement>(null);
  const retried = useRef(false);
  const [loadedNote, setLoadedNote] = useState(false);
  const loadedNow = catalogue.status === "ready";
  useEffect(() => {
    if (loadedNow && retried.current) {
      retried.current = false;
      heading.current?.focus();
      setLoadedNote(true);
    }
  }, [loadedNow]);
  const ready = catalogue.status === "ready";
  const status =
    catalogue.status === "loading" || catalogue.status === "idle" ? AMENITIES_LOADING : catalogue.status === "empty" ? AMENITIES_EMPTY : catalogue.status === "error" ? AMENITIES_FAILED : "";
  const note = loadedNote && loadedNow && !status ? AMENITIES_LOADED : "";
  const showRetry = catalogue.status === "error" || catalogue.retrying;
  const kinds = ready ? groupCatalogue(catalogue.items) : [];
  const others = ready ? otherCodes(value, catalogue.items) : [];
  const describedBy = ["amenities-help", errors?.length ? "amenities-error" : null, inConflict("amenities") ? "amenities-latest" : null].filter(Boolean).join(" ");
  return (
    <div id="amenities" tabIndex={-1} role="group" aria-labelledby="amenities-title" aria-describedby={describedBy} data-testid="amenities-block">
      <h3 id="amenities-title" ref={heading} tabIndex={-1} className="section-title">
        {detailLabel("amenities")}
      </h3>
      <p id="amenities-help" className="hint">
        {AMENITIES_HELP}
      </p>
      {errors?.length ? (
        <p id="amenities-error" className="field-error" data-testid="amenities-error">
          <span className="sr-only">Error: </span>
          {errors.join(" ")}
        </p>
      ) : null}
      <p id="amenities-status" role="status" className={status ? "hint" : "sr-only"} data-testid="amenities-status">
        {status || note}
      </p>
      {showRetry && (
        <button type="button" id="amenities-retry" className="secondary-button" data-testid="amenities-retry" aria-disabled={catalogue.retrying ? true : undefined} onClick={() => {
            if (catalogue.retrying) return;
            retried.current = true;
            setLoadedNote(false);
            catalogue.retry();
          }}>
          Retry<span className="sr-only"> loading the amenities</span>
        </button>
      )}
      {kinds.map((kind) => {
        const nearby = kind.kind === "nearby";
        return (
          <div
            key={kind.kind}
            role="group"
            className="mt-0 mx-0 mb-4 p-0 min-w-0"
            aria-labelledby={`amenities-${kind.kind}-title`}
            aria-describedby={nearby ? "amenities-nearby-help" : undefined}
            data-testid={`amenities-${kind.kind}`}
          >
            <div className="label-row">
              <h4 id={`amenities-${kind.kind}-title`} className="group-title">
                {kind.title}
              </h4>
              {nearby && (
                <span className="declared-tag" data-testid="amenities-nearby-tag">
                  {SELLER_DECLARED}
                </span>
              )}
            </div>
            {nearby && (
              <p id="amenities-nearby-help" className="hint" data-testid="amenities-nearby-help">
                {NEARBY_HELP}
              </p>
            )}
            {kind.groups.map((group) => (
              <div key={group.group} className="amenity-group" data-testid={`amenities-group-${kind.kind}-${group.group}`}>
                {group.group !== kind.kind && (
                  <h5 className="text-[0.9375rem] font-semibold mt-3 mx-0 mb-1" data-testid={`amenities-group-title-${kind.kind}-${group.group}`}>
                    {group.title}
                  </h5>
                )}
                {group.items.map((item) => (
                  <AmenityItem key={item.code} item={item} describedBy={nearby ? "amenities-nearby-help" : undefined} state={Object.hasOwn(map, item.code) ? map[item.code] : ""} onChoose={(state) => onChange(withAmenity(value, item.code, state))} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
      {others.length > 0 && (
        <div role="group" className="mt-0 mx-0 mb-4 p-0 min-w-0" aria-labelledby="amenities-other-title" aria-describedby="amenities-other-help" data-testid="amenities-other">
          <h4 id="amenities-other-title" className="group-title">
            {OTHER_AMENITIES}
          </h4>
          <p id="amenities-other-help" className="hint">
            {OTHER_AMENITIES_HELP}
          </p>
          <ul className="m-0 pl-5">
            {others.map((code) => (
              <li key={code} data-testid={`amenity-other-${code}`}>
                {amenityLabel(code, catalogue.items)}: {STATE_TEXT[map[code]]}{" "}
                <button type="button" className="secondary-button" data-testid={`amenity-remove-${code}`} onClick={() => onChange(withAmenity(value, code, ""))}>
                  Remove<span className="sr-only"> {amenityLabel(code, catalogue.items)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {conflictRow("amenities")}
    </div>
  );
}

/** One item: a real fieldset of three radios (keyboard operable: arrows move within the item, Tab moves to the next). */
function AmenityItem({ item, state, describedBy, onChoose }: { item: CatalogueItem; state: AmenityState | ""; describedBy: string | undefined; onChoose: (state: AmenityState | "") => void }) {
  return (
    <fieldset className="amenity-item" data-testid={`amenity-${item.code}`} aria-describedby={describedBy}>
      <legend>{item.label}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-0">
        {OPTIONS.map((option) => {
          const id = `amenity-${item.code}-${option.state || "unanswered"}`;
          return (
            <div key={option.text} className="radio-option">
              <input type="radio" id={id} name={`amenity-${item.code}`} value={option.state} checked={state === option.state} onChange={() => onChoose(option.state)} />
              <label htmlFor={id}>{option.text}</label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

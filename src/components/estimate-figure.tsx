"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatPrice } from "@/lib/listing-labels";
import { ABOUT_ESTIMATES_PATH, ESTIMATE_ABOUT_LINK, ESTIMATE_INFO, ESTIMATE_INFO_LABEL, ESTIMATE_VALUE_LABEL } from "@/lib/listing-messages";

/**
 * The one way an estimated figure is shown (FR-47): the value with a single inline info button. The button opens a short popover inside a
 * live region that is always mounted, so a screen reader hears the note. Escape, a second press, leaving it or pressing outside closes it.
 * The link opens in a new tab, so unsaved input on the page is never lost.
 */
export function EstimateFigure({ value, testId }: { value: string; testId: string }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (wrapper.current?.contains(document.activeElement)) button.current?.focus();
      setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      ref={wrapper}
      className="estimate-figure"
      data-testid={testId}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span className="muted-label">{ESTIMATE_VALUE_LABEL}</span>
      <span className="estimate-line">
        <strong data-testid={`${testId}-value`}>PKR {formatPrice(value)}</strong>
        <button
          ref={button}
          type="button"
          className="info-button"
          aria-label={ESTIMATE_INFO_LABEL}
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => setOpen((now) => !now)}
        >
          <span aria-hidden="true">i</span>
        </button>
      </span>
      <div id={popoverId} role="status" className={open ? "estimate-popover" : "sr-only"} data-testid={`${testId}-note`}>
        {open && (
          <>
            <span>{ESTIMATE_INFO}</span>{" "}
            <Link href={ABOUT_ESTIMATES_PATH} className="text-link" target="_blank">
              {ESTIMATE_ABOUT_LINK}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

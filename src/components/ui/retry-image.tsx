"use client";

import { useState } from "react";
import { IMAGE_LOAD_FAILED } from "@/lib/listing/listing-messages";

/**
 * A plain same-origin `<img>` (an owner-only, no-store URL: the image optimiser must never see it). When it cannot load, the reason and
 * a Retry that mounts a fresh `<img>`. Shared by the Draft's thumbnails (Story 2.10) and the profile picture and logo (Story 2.11).
 */
export function RetryImage({
  url,
  alt,
  label,
  className,
  failedClassName,
  failedTestId = "image-failed",
}: {
  url: string;
  alt: string;
  /** Names the image for the Retry button's screen-reader text ("Retry loading <label>"). */
  label: string;
  className: string;
  failedClassName: string;
  failedTestId?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) {
    return (
      <div className={failedClassName} data-testid={failedTestId}>
        <p>{IMAGE_LOAD_FAILED}</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setFailed(false);
            setAttempt((tick) => tick + 1);
          }}
        >
          Retry<span className="sr-only"> loading {label}</span>
        </button>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a same-origin, owner-only, no-store URL: the image optimiser must never see it
    <img key={attempt} src={url} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />
  );
}

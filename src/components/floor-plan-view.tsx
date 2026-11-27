import { RetryImage } from "@/components/retry-image";

/** The floor plan of a Listing (Story 11.4) on the preview and the public page: apart from the photos. */
export function FloorPlanView({ url, testId }: { url: string; testId: string }) {
  return (
    <section aria-label="Floor plan" data-testid={testId}>
      <h2 className="section-title">Floor plan</h2>
      <RetryImage url={url} alt="Floor plan" label="floor plan" className="image-thumb" failedClassName="image-thumb image-failed" />
    </section>
  );
}

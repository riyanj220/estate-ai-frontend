import Link from "next/link";
import { agencyPath, type Advertiser } from "@/lib/public-listings";

/** Who advertises a public Listing (Story 3.6), as text a screen reader reads in order; an Agency's name links to its page (3.8). */
export function AdvertiserLine({ advertiser, testId }: { advertiser: Advertiser; testId: string }) {
  if (advertiser.type === "individual") {
    return (
      <div className="advertiser" data-testid={testId}>
        <p>Listed by an individual</p>
      </div>
    );
  }
  return (
    <div className="advertiser" data-testid={testId}>
      {advertiser.logoUrl && (
        // Decorative (the name is beside it); same-origin and public only while the Agency is Active, so never the image optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={advertiser.logoUrl} alt="" loading="lazy" className="advertiser-logo" />
      )}
      <p>
        {advertiser.name ? "Listed by agency: " : "Listed by "}
        {advertiser.id ? (
          <Link href={agencyPath(advertiser.id)} className="text-link" prefetch={false}>
            {advertiser.name ?? "an agency"}
          </Link>
        ) : (
          (advertiser.name ?? "an agency")
        )}
      </p>
      {advertiser.verified && <span className="verified-mark">Verified agency</span>}
    </div>
  );
}

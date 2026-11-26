import Link from "next/link";

/** One answer for a hidden and an unknown Agency. */
export default function AgencyNotFound() {
  return (
    <>
      <h1 className="page-title">Agency not found</h1>
      <p className="card" data-testid="agency-not-found">
        This agency is not available.
      </p>
      <p>
        <Link href="/listings" className="text-link">
          Back to browse
        </Link>
      </p>
    </>
  );
}

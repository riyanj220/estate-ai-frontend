import Link from "next/link";

/** The generic success state of both registration forms. It never says whether the address was already registered. */
export function CheckYourEmail({
  email,
  headingRef,
  onUseDifferent,
}: {
  email: string;
  headingRef: React.Ref<HTMLHeadingElement>;
  onUseDifferent: () => void;
}) {
  return (
    <section className="card" aria-labelledby="success-title">
      <h2 id="success-title" tabIndex={-1} ref={headingRef} className="section-title">
        Check your email
      </h2>
      <p>
        If we can use <strong>{email}</strong>, we have sent a message with the next steps. It can take a few minutes;
        look in your spam folder if you do not see it.
      </p>
      <p>
        Already verified your email address?{" "}
        <Link href="/sign-in" className="text-link">
          Sign in
        </Link>
      </p>
      <button type="button" className="secondary-button" onClick={onUseDifferent}>
        Use a different email address
      </button>
    </section>
  );
}

import { StatusScreen } from "@/components/auth/status-screen";

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
    <StatusScreen
      icon="mail"
      title="Check your email"
      headingRef={headingRef}
      action={{ href: "/sign-in", label: "Sign in" }}
      below={
        <button type="button" className="text-link min-h-11 cursor-pointer font-semibold" onClick={onUseDifferent}>
          Use a different email address
        </button>
      }
    >
      <p>
        If we can use <strong className="text-text wrap-anywhere">{email}</strong>, we have sent a message with the next steps.
      </p>
      <p className="text-[0.875rem]">It can take a few minutes; look in your spam folder if you do not see it.</p>
    </StatusScreen>
  );
}

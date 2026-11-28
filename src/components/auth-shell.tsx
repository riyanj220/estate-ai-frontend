import Image from "next/image";

const POINTS = [
  "Search in your own words, by typing or speaking",
  "Save the properties you like and compare them later",
  "Message sellers without sharing your phone number",
];

/** The split layout of the sign-in and registration pages: a photograph beside the form. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-visual">
        <Image src="/images/auth.jpg" alt="" fill sizes="(max-width: 900px) 0px, 50vw" loading="eager" />
        <div className="auth-visual-text">
          <p className="auth-headline">Your next move starts here</p>
          <ul>
            {POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-form">{children}</div>
      </div>
    </div>
  );
}

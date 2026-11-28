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
        <Image src="/images/auth.jpg" alt="" fill sizes="(max-width: 900px) 0px, 50vw" loading="eager" className="object-cover" />
        <div className="auth-visual-text">
          <p className="font-serif text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-[1.1] max-w-[14ch] mb-5">Your next move starts here</p>
          <ul>
            {POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-center py-12 px-(--gutter) bg-surface max-[901px]:items-start">
        <div className="w-full max-w-108">{children}</div>
      </div>
    </div>
  );
}

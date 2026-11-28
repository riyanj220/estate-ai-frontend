import Image from "next/image";

const POINTS = [
  "Search in your own words, by typing or speaking",
  "Save the properties you like and compare them later",
  "Message sellers without sharing your phone number",
];

/** The split layout of the sign-in and registration pages: a photograph beside the form. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth grid min-h-[calc(100vh_-_4.75rem)] flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[901px]:min-h-0 max-[901px]:grid-cols-[minmax(0,1fr)]">
      <div className="relative flex items-end overflow-hidden bg-accent-strong text-white max-[901px]:hidden">
        <Image src="/images/auth.jpg" alt="" fill sizes="(max-width: 900px) 0px, 50vw" loading="eager" className="object-cover" />
        <div className="relative w-full bg-[linear-gradient(transparent,rgb(10_22_16/88%)_45%)] px-[clamp(2rem,4vw,3.5rem)] pt-32 pb-12">
          <p className="font-serif text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-[1.1] max-w-[14ch] mb-5">Your next move starts here</p>
          <ul className="grid list-none gap-2 p-0">
            {POINTS.map((point) => (
              <li key={point} className="before:content-['✓_'_/_'']">
                {point}
              </li>
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

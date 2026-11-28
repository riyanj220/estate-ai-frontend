import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages | EstateAI", robots: { index: false, follow: false } };

/** Nothing open yet: the list beside this is the page. */
export default function InboxPage() {
  return (
    <div className="m-auto max-w-80 p-8 text-center">
      <span aria-hidden="true" className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
      </span>
      <p className="font-serif text-[1.25rem] font-semibold">Your messages</p>
      <p className="text-muted">Choose a conversation to read it and reply.</p>
    </div>
  );
}

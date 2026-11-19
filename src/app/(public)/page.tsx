import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">EstateAI</h1>
      <p>Public pages placeholder.</p>
      <p>
        <Link href="/register" className="text-link">
          Create an account
        </Link>
      </p>
      <p>
        <Link href="/sign-in" className="text-link">
          Sign in
        </Link>
      </p>
    </>
  );
}

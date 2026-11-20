// Shown (inside the admin shell, status 404) to an administrator who opens an unknown admin path. Non-administrators
// never get here: the guard redirects them first.
export default function AdminNotFound() {
  return (
    <>
      <h1 className="page-title">Page not found</h1>
      <p className="muted">This page could not be found.</p>
    </>
  );
}

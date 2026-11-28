/** Backend base URL; an empty or whitespace BACKEND_URL counts as unset. */
export function backendUrl(raw: string | undefined = process.env.BACKEND_URL): string {
  const value = raw?.trim();
  return (value || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

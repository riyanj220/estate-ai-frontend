/**
 * Removes the `token` query parameter from the address bar AND from the router's history state. Next.js keeps the
 * rendered search (and a segment key) in `history.state`, so a bare `replaceState(history.state, ...)` would leave the
 * token there. Every string in the state that contains the old search is rewritten to the new one, keeping the state
 * shape the router expects. Returns the token ("" when absent).
 */
export function scrubTokenFromHistory(): string {
  const oldSearch = window.location.search;
  const params = new URLSearchParams(oldSearch);
  const token = params.get("token")?.trim() ?? "";
  if (!params.has("token")) return token;
  params.delete("token");
  const query = params.toString();
  const newSearch = query ? `?${query}` : "";
  const rewrite = (value: unknown): unknown => {
    if (typeof value === "string") return value.split(oldSearch).join(newSearch);
    if (Array.isArray(value)) return value.map(rewrite);
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, rewrite(inner)]));
    }
    return value;
  };
  history.replaceState(rewrite(history.state), "", window.location.pathname + newSearch + window.location.hash);
  return token;
}

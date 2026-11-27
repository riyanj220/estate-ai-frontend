/** Search by description (Stories 6.1 and 6.2): the answer of `POST /api/v1/public/search`. Only the names read here are used. */
export const SEARCH_MAX_CHARS = 500;

export type SearchAnswer = {
  interpreted: boolean;
  message: string;
  /** Filter parameters of the public list; the browse page address is built from them. */
  params: URLSearchParams;
  unsupported: string[];
  notices: string[];
};

const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item !== "") : []);
const NAME = /^[a-z][a-z0-9_]{0,63}$/;

export function readSearchAnswer(data: unknown): SearchAnswer | null {
  const body = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (body.status !== "interpreted" && body.status !== "fallback") return null;
  const given = typeof body.params === "object" && body.params !== null ? body.params : {};
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(given)) {
    // Never the page's own names: paging and sorting are not part of an interpretation.
    if (NAME.test(name) && !["sort", "limit", "cursor"].includes(name) && typeof value === "string" && value) params.set(name, value);
  }
  return {
    interpreted: body.status === "interpreted",
    message: typeof body.message === "string" ? body.message : "",
    params,
    unsupported: texts(body.unsupported),
    notices: texts(body.notices),
  };
}

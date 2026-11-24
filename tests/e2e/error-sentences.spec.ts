import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SENTENCE_CODES, codeOfSentence } from "../../src/lib/error-sentences";

// The real API reports `error.fields` as static sentences (backend `FIELD_MESSAGES`). `src/lib/error-sentences.ts` is the reverse table and
// `tests/e2e/field-sentences.json` the forward one the stub uses. When the sibling backend repository is present both must agree with it.
const BACKEND = process.env.BACKEND_ERRORS_PY ?? "../estate-ai-backend/apps/kernel/errors.py";

/** The `FIELD_MESSAGES` dict of errors.py as {code: sentence}; adjacent string literals (a parenthesised sentence) are joined. */
function backendMessages(source: string): Record<string, string> {
  const start = source.indexOf("FIELD_MESSAGES");
  const open = source.indexOf("{", start);
  const close = source.indexOf("\n}\n", open);
  const block = source.slice(open, close + 2);
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/"(\w+)":\s*\(?\s*((?:"(?:[^"\\]|\\.)*"\s*)+)\)?\s*,/g)) {
    out[match[1]] = [...match[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((part) => JSON.parse(`"${part[1]}"`)).join("");
  }
  return out;
}

test("error sentences: a known sentence becomes its code, a code and an unknown text pass through", () => {
  expect(codeOfSentence("This text is too long.")).toBe("too_long");
  expect(codeOfSentence("too_long")).toBe("too_long");
  expect(codeOfSentence("Some server sentence.")).toBe("Some server sentence.");
  expect(codeOfSentence("constructor")).toBe("constructor");
});

test("error sentences: the tables agree with the backend's FIELD_MESSAGES", () => {
  const path = resolve(process.cwd(), BACKEND);
  test.skip(!existsSync(path), `the backend repository is not at ${path}: set BACKEND_ERRORS_PY to check the sentence tables`);
  const backend = backendMessages(readFileSync(path, "utf8"));
  expect(Object.keys(backend).length).toBeGreaterThan(40);
  const forward = JSON.parse(readFileSync(join(__dirname, "field-sentences.json"), "utf8")) as Record<string, string>;
  expect(forward).toEqual(backend); // the stub's wire is exactly the backend's
  // Every backend sentence reads as a code with that sentence (shared sentences keep the first code), and the table holds nothing else.
  const expected: Record<string, string> = {};
  for (const [code, sentence] of Object.entries(backend)) if (!Object.hasOwn(expected, sentence)) expected[sentence] = code;
  expect(SENTENCE_CODES).toEqual(expected);
});

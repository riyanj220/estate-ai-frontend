// Fails when the generated client or the committed spec copy is stale.
//   npm run api:check              regenerate and diff, then compare with backend main
//   npm run api:check -- --offline regenerate and diff only (explicitly skips the backend check)
// Every failing check is reported before exiting non-zero.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "./lib/generate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const offline = process.argv.includes("--offline");
const BACKEND_RAW =
  process.env.BACKEND_OPENAPI_URL ??
  "https://raw.githubusercontent.com/riyanj220/estate-ai-backend/main/openapi.yaml";
const HINT = "Run `npm run api:sync` and commit the result.";
const errors = [];

const normalise = (text) =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();

function readFile(rel) {
  try {
    return readFileSync(resolve(root, rel), "utf8");
  } catch (error) {
    errors.push(`Cannot read ${rel} (${error.code ?? error.message}). ${HINT}`);
    return null;
  }
}

const spec = readFile("src/api/openapi.yaml");
const schema = readFile("src/api/schema.ts");

if (spec !== null && schema !== null) {
  try {
    const fresh = await render(resolve(root, "src/api/openapi.yaml"));
    if (normalise(fresh) !== normalise(schema)) {
      errors.push(`Generated client src/api/schema.ts is stale against src/api/openapi.yaml. ${HINT}`);
    }
  } catch (error) {
    errors.push(`Could not generate the client from src/api/openapi.yaml (${error.message}). ${HINT}`);
  }
}

if (offline) {
  console.warn("--offline: SKIPPED comparison of src/api/openapi.yaml with the backend main openapi.yaml.");
} else if (spec !== null) {
  try {
    const response = await fetch(BACKEND_RAW, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      errors.push(`Could not fetch the backend openapi.yaml (HTTP ${response.status}) from ${BACKEND_RAW}.`);
    } else if (normalise(await response.text()) !== normalise(spec)) {
      errors.push(`src/api/openapi.yaml differs from the backend main openapi.yaml. ${HINT}`);
    }
  } catch (error) {
    errors.push(`Could not fetch the backend openapi.yaml from ${BACKEND_RAW} (${error.message}). Use --offline to skip.`);
  }
}

if (errors.length) {
  for (const message of errors) console.error(message);
  process.exit(1);
}
console.log("API client is up to date.");

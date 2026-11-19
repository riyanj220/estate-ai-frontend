// The one script that syncs the backend contract into this repo:
//   1. copies the backend openapi.yaml to src/api/openapi.yaml
//   2. regenerates the typed client in src/api/schema.ts
// Both files are replaced only after generation succeeds.
// Usage: npm run api:sync   (BACKEND_OPENAPI_PATH overrides the default location)
import { copyFileSync, mkdtempSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./lib/generate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, process.env.BACKEND_OPENAPI_PATH ?? "../estate-ai-backend/openapi.yaml");

const stat = (() => {
  try {
    return statSync(source);
  } catch {
    return null;
  }
})();
if (!stat?.isFile() || stat.size === 0) {
  console.error(
    `Backend openapi.yaml not found or not a non-empty file at ${source}.\n` +
      "Clone the backend repo next to this one, or set BACKEND_OPENAPI_PATH to its openapi.yaml.",
  );
  process.exit(1);
}

const apiDir = resolve(root, "src/api");
const tmp = mkdtempSync(join(tmpdir(), "api-sync-"));
try {
  const tmpSpec = join(tmp, "openapi.yaml");
  const tmpSchema = join(tmp, "schema.ts");
  copyFileSync(source, tmpSpec);
  await generate(tmpSpec, tmpSchema);
  // Stage next to the targets so the final renames are atomic on one filesystem.
  copyFileSync(tmpSpec, join(apiDir, ".openapi.yaml.tmp"));
  copyFileSync(tmpSchema, join(apiDir, ".schema.ts.tmp"));
  renameSync(join(apiDir, ".openapi.yaml.tmp"), join(apiDir, "openapi.yaml"));
  renameSync(join(apiDir, ".schema.ts.tmp"), join(apiDir, "schema.ts"));
} catch (error) {
  console.error(`Sync failed; src/api left unchanged. ${error instanceof Error ? error.message : error}`);
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`Synced ${source} -> src/api/openapi.yaml and regenerated src/api/schema.ts`);

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

export const HEADER = `/**
 * GENERATED FILE - DO NOT EDIT.
 * Generated from src/api/openapi.yaml by scripts/sync-api.mjs (npm run api:sync).
 */

`;

export async function render(specPath) {
  const ast = await openapiTS(pathToFileURL(specPath));
  return HEADER + astToString(ast);
}

export async function generate(specPath, outPath) {
  writeFileSync(outPath, await render(specPath));
}

export function read(path) {
  return readFileSync(path, "utf8");
}

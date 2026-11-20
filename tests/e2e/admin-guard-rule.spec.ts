import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const ROOT = join(process.cwd(), "src/app/admin/(protected)");

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pageFiles(path);
    return /^page\.(tsx|ts|jsx|js)$/.test(name) ? [path] : [];
  });
}

// Layouts are not re-run on client navigation, so every guarded admin page must call requireAdmin() itself.
test("every page under src/app/admin/(protected) calls requireAdmin()", () => {
  const pages = pageFiles(ROOT);
  expect(pages.length).toBeGreaterThanOrEqual(2); // the dashboard and the catch-all at least
  for (const file of pages) {
    const source = readFileSync(file, "utf8");
    expect(source, file).toMatch(/await requireAdmin\(\)/);
  }
});

test("the protected layout calls requireAdmin() too and is noindex with a neutral title", () => {
  const layout = readFileSync(join(ROOT, "layout.tsx"), "utf8");
  expect(layout).toMatch(/await requireAdmin\(\)/);
  expect(layout).toMatch(/index: false/);
  expect(layout).toMatch(/title: "EstateAI"/);
});

test("no page under the protected group sets a title with admin wording", () => {
  for (const file of pageFiles(ROOT)) {
    expect(readFileSync(file, "utf8"), file).not.toMatch(/title:\s*"[^"]*admin/i);
  }
});

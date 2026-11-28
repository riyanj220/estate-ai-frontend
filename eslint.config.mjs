import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Layers (see "Source layout" in README.md): routes use features, features use `ui` and `lib`, never the other way round.
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/components/*", "@/app/*", "**/components/**"], message: "lib must not import components or routes." }] }] },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/components/*", "!@/components/ui", "@/app/*"], message: "components/ui is shared: it must not import a feature's components." }] }] },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/app/*"], message: "components must not import from routes." }] }] },
  },
  globalIgnores([".next/**", ".next-e2e-*/**", "out/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

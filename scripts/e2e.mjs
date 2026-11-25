// Runs the Playwright suite as N parallel shards, each with its own stub backend and app server (ports 4010+i / 3100+i; `next build` + `next start` by default, E2E_SERVER=dev for `next dev`).
//   npm run test:e2e                          all shards (N = E2E_SHARDS, default min(3, cores - 1))
//   E2E_SHARDS=1 npm run test:e2e             serial, one shard
//   E2E_SHARDS=3 E2E_ONLY=2 npm run test:e2e  only shard 2 of 3 (1-based), same ports as in the full run
//   npm run test:e2e -- --grep "sign in"      extra arguments go to every shard's `playwright test`
//   npm run test:e2e:smoke | test:e2e:changed  the @smoke tests (plus the spec files changed against main)
// Spec files are spread over the shards by file size; naming spec files falls back to Playwright's --shard.
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const smoke = argv.includes("--smoke");
const changed = argv.includes("--changed");
// Smoke and changed runs are small: one shard unless E2E_SHARDS says otherwise.
const count = Math.max(1, Number(process.env.E2E_SHARDS) || (smoke || changed ? 1 : Math.min(3, os.cpus().length - 1)));
const only = process.env.E2E_ONLY ? Number(process.env.E2E_ONLY) : null;
const extra = argv.filter((a) => a !== "--smoke" && a !== "--changed");
if (smoke || changed) {
  // @smoke tests plus, with --changed, every test of the spec files changed against main (committed, staged, unstaged, untracked).
  const git = (...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const files = changed
    ? [...new Set([...git("diff", "--name-only", "main"), ...git("ls-files", "--others", "--exclude-standard")])]
        .filter((f) => /^tests\/e2e\/[^/]+\.spec\.ts$/.test(f) && fs.existsSync(path.join(root, f)))
        .map((f) => path.basename(f).replaceAll(".", "\\."))
    : [];
  extra.push("--grep", ["@smoke", ...files].join("|"));
  console.log(`e2e: ${changed ? `smoke plus ${files.length} changed spec file(s)` : "smoke"}`);
}
const playwright = path.join(root, "node_modules/.bin/playwright"); // not through npx: a signal then reaches Playwright itself

// Spec files go to shards by weight (largest first onto the lightest shard), as Playwright's own --shard balances by test count and
// leaves one shard with the slowest file. File size is a good enough proxy for duration. A run that names spec files is not split.
const specs = fs.readdirSync(path.join(root, "tests/e2e")).filter((f) => f.endsWith(".spec.ts"));
const named = extra.some((a) => a.endsWith(".spec.ts") || a.includes(".spec.ts:"));
const buckets = Array.from({ length: count }, () => ({ weight: 0, files: [] }));
for (const f of specs.sort((a, b) => size(b) - size(a))) {
  const b = buckets.reduce((m, x) => (x.weight < m.weight ? x : m));
  b.files.push(`tests/e2e/${f}`);
  b.weight += size(f);
}
function size(f) {
  return fs.statSync(path.join(root, "tests/e2e", f)).size;
}
const shards = only ? [only] : Array.from({ length: count }, (_, i) => i + 1);
const t0 = Date.now();
const running = new Set();

function runShard(n) {
  const split = count > 1 ? (named ? [`--shard=${n}/${count}`] : buckets[n - 1].files) : [];
  const args = ["test", ...split, ...extra];
  const child = spawn(playwright, args, {
    env: { E2E_SERVER: "start", ...process.env, E2E_SHARD: String(n - 1), E2E_SHARDS: String(count) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group: a signal reaches Playwright, which then tears its servers down
  });
  running.add(child);
  const prefix = count > 1 ? `[shard ${n}/${count}] ` : "";
  for (const [stream, out] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    let buf = "";
    stream.on("data", (d) => {
      const lines = (buf + d).split("\n");
      buf = lines.pop();
      for (const l of lines) out.write(prefix + l + "\n");
    });
    stream.on("end", () => buf && out.write(prefix + buf + "\n"));
  }
  return new Promise((resolve) =>
    child.on("close", (code) => {
      running.delete(child);
      resolve({ n, code: code ?? 1 });
    }),
  );
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    for (const c of running) {
      try {
        process.kill(c.pid, "SIGINT"); // Playwright shuts its servers down on SIGINT; we wait for it below
      } catch {}
    }
  });
}

const results = await Promise.all(shards.map(runShard));
const failed = results.filter((r) => r.code !== 0);
console.log(`\ne2e: ${results.length} shard(s) in ${Math.round((Date.now() - t0) / 1000)} s, ${failed.length ? `failed: ${failed.map((r) => r.n).join(", ")}` : "all passed"}`);
process.exit(failed.length ? 1 : 0);

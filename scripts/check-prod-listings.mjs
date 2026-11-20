// Production check for the listing pages: builds the app, starts it against the Playwright stub backend on other ports and
// asserts what a Visitor and a signed-in account get from /account/listings, /account/listings/new and
// /account/listings/<uuid>. Run with `npm run check:prod-listings`.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const STUB_PORT = 4120;
const APP_PORT = 3210;
const STUB = `http://127.0.0.1:${STUB_PORT}`;
const APP = `http://127.0.0.1:${APP_PORT}`;
const env = { ...process.env, BACKEND_URL: STUB, STUB_PORT: String(STUB_PORT) };
const children = [];
const ID = "00000000-0000-4000-9000-000000000001";
const PATHS = ["/account/listings", "/account/listings/new", `/account/listings/${ID}`];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}

function start(command, args) {
  const child = spawn(command, args, { env, stdio: "ignore" });
  children.push(child);
  return child;
}

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not come up`);
}

const get = (path, cookie) => fetch(`${APP}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });

try {
  await run("npx", ["next", "build"]);
  start("node", ["tests/e2e/stub-backend.mjs"]);
  start("npx", ["next", "start", "-p", String(APP_PORT)]);
  await waitFor(`${STUB}/__ping`);
  await waitFor(`${APP}/sign-in`);

  for (const path of PATHS) {
    const response = await get(path);
    assert.equal(response.status, 307, `Visitor ${path}: status`);
    assert.equal(response.headers.get("location"), `/sign-in?next=${encodeURIComponent(path)}`, `Visitor ${path}: location`);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/, `Visitor ${path}: no-store`);
    const body = await response.text();
    for (const marker of ["Create draft", "Load more", "What exists so far"]) assert.ok(!body.includes(marker), `Visitor ${path}: body leaks "${marker}"`);
    console.log(`ok  Visitor ${path} -> 307 no-store`);
  }
  await fetch(`${STUB}/__force-session`); // an ordinary session
  for (const path of PATHS) {
    const response = await get(path, "estate_session=stub-live");
    assert.equal(response.status, 200, `Signed in ${path}: status`);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/, `Signed in ${path}: no-store`);
    console.log(`ok  Signed in ${path} -> 200 no-store`);
  }
  console.log("Production listings check passed.");
} finally {
  for (const child of children) child.kill();
}
await new Promise((r) => setTimeout(r, 500));
process.exit(0);

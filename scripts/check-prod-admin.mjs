// Production check for the admin area: builds the app, starts it against the Playwright stub backend on other ports and
// asserts what a Visitor and an ordinary account get from /admin. Run with `npm run check:prod-admin`.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const STUB_PORT = 4110;
const APP_PORT = 3200;
const STUB = `http://127.0.0.1:${STUB_PORT}`;
const APP = `http://127.0.0.1:${APP_PORT}`;
const env = { ...process.env, BACKEND_URL: STUB, STUB_PORT: String(STUB_PORT) };
const children = [];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", ...options });
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

async function expectGuarded(path, cookie, label, expectedNext) {
  const response = await get(path, cookie);
  assert.equal(response.status, 307, `${label} ${path}: status`);
  assert.equal(response.headers.get("location"), `/admin/sign-in?next=${expectedNext}`, `${label} ${path}: location`);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/, `${label} ${path}: no-store`);
  const body = await response.text();
  for (const marker of ["EstateAI Administration", "Platform overview", "Audit log", "Listings"]) {
    assert.ok(!body.includes(marker), `${label} ${path}: body leaks "${marker}"`);
  }
  console.log(`ok  ${label} ${path} -> 307`);
}

try {
  await run("npx", ["next", "build"]);
  start("node", ["tests/e2e/stub-backend.mjs"]);
  start("npx", ["next", "start", "-p", String(APP_PORT)]);
  await waitFor(`${STUB}/__ping`);
  await waitFor(`${APP}/admin/sign-in`);

  await expectGuarded("/admin", undefined, "Visitor", "%2Fadmin");
  await expectGuarded("/admin/anything/else?x=1", undefined, "Visitor", "%2Fadmin%2Fanything%2Felse%3Fx%3D1");
  await fetch(`${STUB}/__force-session`); // an ordinary session
  const cookie = "estate_session=stub-live";
  await expectGuarded("/admin", cookie, "Ordinary account", "%2Fadmin");
  await expectGuarded("/admin/anything/else?x=1", cookie, "Ordinary account", "%2Fadmin%2Fanything%2Felse%3Fx%3D1");

  const signIn = await get("/admin/sign-in");
  assert.equal(signIn.status, 200);
  assert.match(signIn.headers.get("cache-control") ?? "", /no-store/);
  console.log("ok  /admin/sign-in -> 200 no-store");
  console.log("Production admin check passed.");
} finally {
  for (const child of children) child.kill();
}
// Children started through npx can outlive the kill: stop what is listening on the two ports.
await new Promise((r) => setTimeout(r, 500));
process.exit(0);

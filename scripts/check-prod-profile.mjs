// Production check for the profile picture and Agency logo (Story 2.11): builds the app, starts it against the Playwright stub backend on
// other ports and asserts what the production proxy does with the image routes: a 5 MB upload arrives whole, the binary image comes back
// untouched, the owner routes are `private, no-store`, and the public logo is cacheable and cookie-free for a Visitor (and 404 when the
// Agency is not active). Run with `npm run check:prod-profile`.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const STUB_PORT = 4130;
const APP_PORT = 3220;
const STUB = `http://127.0.0.1:${STUB_PORT}`;
const APP = `http://127.0.0.1:${APP_PORT}`;
const env = { ...process.env, BACKEND_URL: STUB, STUB_PORT: String(STUB_PORT) };
const children = [];
const cookie = "estate_session=stub-live";
const AGENCY_ID = "55555555-5555-4555-8555-555555555555";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

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
const get = (path, headers = {}) => fetch(`${APP}${path}`, { redirect: "manual", headers });
const stats = async () => (await fetch(`${STUB}/__profile-image-stats`)).json();

try {
  await run("npx", ["next", "build"]);
  start("node", ["tests/e2e/stub-backend.mjs"]);
  start("npx", ["next", "start", "-p", String(APP_PORT)]);
  await waitFor(`${STUB}/__ping`);
  await waitFor(`${APP}/sign-in`);

  // The page itself: a Visitor is sent to sign in, an account gets it, neither cached.
  const visitor = await get("/account/profile");
  assert.equal(visitor.status, 307, "Visitor /account/profile: status");
  assert.equal(visitor.headers.get("location"), `/sign-in?next=${encodeURIComponent("/account/profile")}`);
  assert.match(visitor.headers.get("cache-control") ?? "", /no-store/);
  await fetch(`${STUB}/__force-session`);
  const signedIn = await get("/account/profile", { cookie });
  assert.equal(signedIn.status, 200, "Signed in /account/profile: status");
  assert.match(signedIn.headers.get("cache-control") ?? "", /no-store/);
  console.log("ok  /account/profile -> 307 for a Visitor, 200 no-store for an account");

  const csrf = (await (await fetch(`${APP}/api/v1/csrf`, { headers: { cookie } })).json()).csrf_token;
  const upload = async (path, padding) => {
    const form = new FormData();
    form.append("file", new Blob([PNG, Buffer.alloc(padding, 0x41)], { type: "image/png" }), "a.png");
    return fetch(`${APP}${path}`, { method: "PUT", body: form, headers: { cookie, "x-csrftoken": csrf } });
  };

  // ---- Individual: owner routes only.
  const PICTURE = "/api/v1/me/profile/image";
  const five = 5 * 1024 * 1024 - 1000;
  const sent = Buffer.concat([PNG, Buffer.alloc(five, 0x41)]);
  const put = await upload(PICTURE, five);
  assert.equal(put.status, 200, "a 5 MB picture passes the proxy");
  assert.match(put.headers.get("cache-control") ?? "", /no-store/, "the upload answer is no-store");
  const image = await put.json();
  assert.equal(image.url, `${PICTURE}/file`);
  assert.equal(image.bytes, sent.length);
  const file = await get(image.url, { cookie });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "image/png");
  assert.equal(file.headers.get("cache-control"), "private, no-store", "an owner route is private, no-store");
  assert.equal(file.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), sent, "the image bytes are untouched by the proxy");
  assert.equal((await get(image.url)).status, 404, "a Visitor gets the not-found answer");
  // The page asks for the owner route with a counter after a change (`?r=1`): the proxy keeps the query and the answer is the same.
  const counted = await get(`${image.url}?r=1`, { cookie });
  assert.equal(counted.status, 200, "the owner route with a counter query");
  assert.equal(counted.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await counted.arrayBuffer()), sent);
  const profile = await (await get("/api/v1/me/profile", { cookie })).json();
  assert.deepEqual(profile.image, image, "the profile carries the image");
  const over = await upload(PICTURE, 6 * 1024 * 1024 + 10);
  assert.equal(over.status, 400, "a body over 6 MiB reaches the backend, which refuses it");
  assert.deepEqual((await over.json()).error.fields, { file: ["The image is too large. Use a file of up to 5 MB."] });
  const huge = await upload(PICTURE, 11 * 1024 * 1024);
  assert.equal(huge.status, 400, "a body over 10 MB reaches the backend in full, which refuses it");
  const state = await stats();
  assert.ok(state.uploads.at(-1).size > 11 * 1024 * 1024, "the whole 11 MB body arrived");
  assert.equal(state.uploads[0].fileSize, sent.length, "the 5 MB file arrived whole");
  const removed = await fetch(`${APP}${PICTURE}`, { method: "DELETE", headers: { cookie, "x-csrftoken": csrf } });
  assert.equal(removed.status, 204);
  assert.equal((await get(image.url, { cookie })).status, 404, "removed: the owner route is not found");
  console.log("ok  Individual picture: 5 MB upload, binary bytes back, owner route private no-store, remove");

  // ---- Agency: the owner routes, then the public logo.
  await fetch(`${STUB}/__me-mode?value=agency`);
  const LOGO = "/api/v1/me/agency-profile/image";
  const logo = await upload(LOGO, five);
  assert.equal(logo.status, 200, "a 5 MB logo passes the proxy");
  const logoImage = await logo.json();
  assert.equal(logoImage.url, `${LOGO}/file`);
  const agency = await (await get("/api/v1/me/agency-profile", { cookie })).json();
  assert.equal(agency.agency_id, AGENCY_ID);
  assert.equal(agency.logo_url, `/api/v1/agencies/${AGENCY_ID}/logo`);
  const own = await get(logoImage.url, { cookie });
  assert.equal(own.status, 200);
  assert.equal(own.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await own.arrayBuffer()), sent);
  const publicLogo = await get(agency.logo_url); // no cookie at all: a Visitor
  assert.equal(publicLogo.status, 200, "a Visitor gets the public logo");
  assert.equal(publicLogo.headers.get("cache-control"), "public, max-age=60", "the public logo is cacheable for a minute");
  assert.equal(publicLogo.headers.get("set-cookie"), null, "no cookie is set on the public logo");
  assert.equal(publicLogo.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await publicLogo.arrayBuffer()), sent, "the logo bytes are untouched by the proxy");
  assert.ok((await stats()).logoRequests.every((entry) => entry.cookie === null), "the proxy sent no cookie for a Visitor");
  await fetch(`${STUB}/__logo-mode?value=suspended`);
  const hidden = await get(agency.logo_url);
  assert.equal(hidden.status, 404, "an inactive Agency's logo is not found");
  assert.match(hidden.headers.get("cache-control") ?? "", /no-store/);
  await fetch(`${STUB}/__logo-mode?value=active`);
  assert.equal((await get(`/api/v1/agencies/00000000-0000-4000-8000-000000000000/logo`)).status, 404, "an unknown id is not found");
  console.log("ok  Agency logo: owner routes private no-store, public logo cacheable and cookie-free, 404 when not active");
  console.log("Production profile check passed.");
} finally {
  for (const child of children) child.kill();
}
await new Promise((r) => setTimeout(r, 500));
process.exit(0);

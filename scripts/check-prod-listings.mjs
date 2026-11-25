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

  // Story 2.10: the production proxy forwards a multipart upload of up to 6 MiB (and more, so the backend's own cap decides) in full,
  // and returns the binary image answer untouched.
  const cookie = "estate_session=stub-live";
  await fetch(`${STUB}/__listings-preset?value=images_none`);
  const csrf = (await (await fetch(`${APP}/api/v1/csrf`, { headers: { cookie } })).json()).csrf_token;
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const upload = async (padding) => {
    const form = new FormData();
    form.append("file", new Blob([PNG, Buffer.alloc(padding, 0x41)], { type: "image/png" }), "a.png");
    return fetch(`${APP}/api/v1/listings/${ID}/images`, { method: "POST", body: form, headers: { cookie, "x-csrftoken": csrf } });
  };
  const near = await upload(5 * 1024 * 1024 - 1000);
  assert.equal(near.status, 201, "a 5 MB upload passes the proxy");
  const created = await near.json();
  const over = await upload(6 * 1024 * 1024 + 10);
  assert.equal(over.status, 400, "a body over 6 MiB reaches the backend, which refuses it");
  assert.deepEqual((await over.json()).error.fields, { file: ["The image is too large. Use a file of up to 5 MB."] });
  // No proxy cap in the way: a body above 10 MB (the default limit of a buffering proxy) also reaches the backend in full.
  const huge = await upload(11 * 1024 * 1024);
  assert.equal(huge.status, 400, "a body over 10 MB reaches the backend, which refuses it");
  assert.deepEqual((await huge.json()).error.fields, { file: ["The image is too large. Use a file of up to 5 MB."] });
  const stats = await (await fetch(`${STUB}/__image-stats`)).json();
  assert.ok(stats.uploads[2].size > 11 * 1024 * 1024, "the whole 11 MB body arrived");
  assert.equal(stats.uploads[0].fileSize, PNG.length + 5 * 1024 * 1024 - 1000, "the file arrived whole");
  assert.ok(stats.uploads[1].size > 6 * 1024 * 1024, "the whole oversized body arrived");
  const file = await fetch(`${APP}${created.url}`, { headers: { cookie } });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "image/png");
  assert.equal(file.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), PNG, "the image bytes are untouched by the proxy");
  assert.equal((await fetch(`${APP}${created.url}`)).status, 404, "a Visitor gets the not-found answer");
  console.log("ok  6 MiB upload and binary image through the proxy");
  // Story 2.7: the reference lists pass through the proxy, an unknown city is 404, and the owner's Draft (private address included) is
  // never cacheable and is not served to a Visitor.
  await fetch(`${STUB}/__listings-preset?value=location_filled`);
  const cities = await fetch(`${APP}/api/v1/reference/cities`);
  assert.equal(cities.status, 200, "the city list passes the proxy");
  const karachi = (await cities.json()).items[0].id;
  const localities = await fetch(`${APP}/api/v1/reference/cities/${karachi}/localities`);
  assert.equal(localities.status, 200, "the locality list passes the proxy");
  assert.ok((await localities.json()).items.every((item) => ["area", "society"].includes(item.kind)), "localities carry a closed kind");
  assert.equal((await fetch(`${APP}/api/v1/reference/cities/00000000-0000-4000-8000-000000000000/localities`)).status, 404);
  const owner = await fetch(`${APP}/api/v1/listings/${ID}`, { headers: { cookie } });
  assert.equal(owner.status, 200);
  assert.match(owner.headers.get("cache-control") ?? "", /no-store/, "the owner's Draft read is no-store");
  assert.equal((await owner.json()).fields.street, "Cedar Lane", "the owner reads the private address");
  const visitor = await fetch(`${APP}/api/v1/listings/${ID}`);
  // 401, not 404: the route requires a session (the backend answers a Visitor with `unauthenticated`); the 404 is for signed-in non-owners.
  assert.equal(visitor.status, 401, "a Visitor gets no Draft");
  assert.ok(!(await visitor.text()).includes("Cedar Lane"), "no private value in the Visitor's answer");
  console.log("ok  location routes and the private Draft read through the proxy");
  // Story 2.8: the public amenity catalogue passes through the proxy; no caching of it is relied on (the backend sets no Cache-Control).
  const amenities = await fetch(`${APP}/api/v1/reference/amenities`);
  assert.equal(amenities.status, 200, "the amenity catalogue passes the proxy");
  const amenityItems = (await amenities.json()).items;
  assert.ok(amenityItems.length > 0 && amenityItems.every((entry) => ["on_property", "community", "nearby"].includes(entry.kind)), "amenities carry a closed kind");
  assert.ok(amenityItems.every((entry) => !("distance" in entry) && !("verified" in entry)), "no distance or verification key");
  console.log("ok  amenity catalogue through the proxy");
  console.log("Production listings check passed.");
} finally {
  for (const child of children) child.kill();
}
await new Promise((r) => setTimeout(r, 500));
process.exit(0);

// Minimal stand-in for the Django backend, used only by the Playwright tests.
import { createServer } from "node:http";

let mode = "up";
let lastCookie = "";

createServer((req, res) => {
  const url = new URL(req.url, "http://stub");
  const json = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/__ping") return json(200, {});
  if (url.pathname === "/__mode") {
    const value = url.searchParams.get("value") ?? "up";
    if (!["up", "down", "broken", "hang"].includes(value)) return json(400, { error: "unknown mode" });
    mode = value;
    return json(200, { mode });
  }
  if (url.pathname === "/__reset") {
    mode = "up";
    lastCookie = "";
    return json(200, { mode });
  }
  if (url.pathname === "/__last-cookie") return json(200, { cookie: lastCookie });
  if (url.pathname === "/api/v1/health") {
    lastCookie = req.headers.cookie ?? "";
    if (mode === "down") return json(503, { status: "unavailable" });
    if (mode === "broken") return req.socket.destroy();
    if (mode === "hang") return; // accept the connection, never answer
    return json(200, { status: "ok" });
  }
  json(404, { error: { code: "not_found", message: "Not found.", fields: {}, request_id: "stub" } });
}).listen(Number(process.env.STUB_PORT ?? 4010), "127.0.0.1");

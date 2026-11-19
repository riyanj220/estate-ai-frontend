// Minimal stand-in for the Django backend, used only by the Playwright tests.
import { createServer } from "node:http";

let mode = "up";
let lastCookie = "";
let registrationMode = "accepted";
let lastRegistration = null;
let registrationCount = 0;
const pending = []; // responses held open by the hang mode

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
    registrationMode = "accepted";
    lastRegistration = null;
    registrationCount = 0;
    while (pending.length) pending.pop().end();
    return json(200, { mode });
  }
  if (url.pathname === "/__registration-mode") {
    const value = url.searchParams.get("value") ?? "accepted";
    if (![
      "accepted", "fields", "required", "empty_fields", "bad_json", "mixed", "forbidden", "bad_gateway",
      "non_field", "rate_limited", "rate_20", "rate_90", "rate_none", "rate_abc", "error", "broken", "hang",
    ].includes(value)) {
      return json(400, { error: "unknown mode" });
    }
    registrationMode = value;
    return json(200, { registrationMode });
  }
  if (url.pathname === "/__last-registration") return json(200, { count: registrationCount, body: lastRegistration });
  if (url.pathname === "/api/v1/registrations/individuals" && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      registrationCount += 1;
      try {
        lastRegistration = JSON.parse(raw);
      } catch {
        lastRegistration = null;
      }
      const envelope = (code, message, fields = {}) => ({ error: { code, message, fields, request_id: "stub" } });
      if (registrationMode === "accepted") return json(202, { status: "check_your_email" });
      if (registrationMode === "fields") {
        return json(
          400,
          envelope("validation_error", "Some fields are invalid.", {
            full_name: ["Enter your full name using letters only."],
            email: ["Enter a valid email address."],
            password: ["Choose a password that is at least 8 characters long."],
            phone: ["Enter a valid Pakistani mobile or international number."],
          }),
        );
      }
      if (registrationMode === "required") {
        const message = ["This field is required."];
        return json(400, envelope("validation_error", "Some fields are invalid.", { full_name: message, email: message, password: message, phone: message }));
      }
      if (registrationMode === "empty_fields") return json(400, envelope("bad_request", "The server rejected this request."));
      if (registrationMode === "bad_json") {
        res.writeHead(400, { "content-type": "text/plain" });
        return res.end("not json");
      }
      if (registrationMode === "mixed") {
        return json(400, envelope("validation_error", "Invalid.", { email: ["Enter a valid email address."], role: ["Unknown field."], non_field_errors: ["Unexpected field."] }));
      }
      if (registrationMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
      if (registrationMode === "bad_gateway") {
        res.writeHead(502, { "content-type": "text/html" });
        return res.end("<html><body>Bad gateway</body></html>");
      }
      if (registrationMode.startsWith("rate_") && registrationMode !== "rate_limited") {
        const retry = { rate_20: "20", rate_90: "90", rate_abc: "soon" }[registrationMode];
        res.writeHead(429, { "content-type": "application/json", ...(retry ? { "retry-after": retry } : {}) });
        return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      }
      if (registrationMode === "non_field") {
        return json(400, envelope("validation_error", "Invalid request.", { non_field_errors: ["Unexpected field."] }));
      }
      if (registrationMode === "rate_limited") {
        res.writeHead(429, { "content-type": "application/json", "retry-after": "1800" });
        return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      }
      if (registrationMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (registrationMode === "broken") return req.socket.destroy();
      // hang: keep the response open; /__reset or server close ends it
      pending.push(res);
    });
    return;
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
})
  .on("close", () => {
    while (pending.length) pending.pop().end();
  })
  .listen(Number(process.env.STUB_PORT ?? 4010), "127.0.0.1");

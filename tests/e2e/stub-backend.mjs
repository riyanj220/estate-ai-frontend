// Minimal stand-in for the Django backend, used only by the Playwright tests.
import { createServer } from "node:http";

let mode = "up";
let lastCookie = "";
let registrationMode = "accepted";
let lastRegistration = null;
let registrationCount = 0;
let confirmMode = "ok";
let confirmCount = 0;
let lastConfirm = null;
let resendMode = "accepted";
let resendCount = 0;
let lastResend = null;
// Session stand-in (Story 1.17): the cookie is stateful, so `me` is 401 before sign-in and after sign-out.
const SESSION_COOKIE = "estate_session=stub-live";
let signInMode = "ok";
let meMode = "up";
let signOutMode = "ok";
let liveSession = false;
let csrfSeed = 0;
let csrfFetches = 0;
let signInCount = 0;
let signOutCount = 0;
let meCount = 0;
let unsafeCount = 0;
let lastSignIn = null;
let lastSignInToken = null;
let lastSignOutToken = null;
let csrfOnceSpent = false;
let csrfMode = "ok";
// Password reset and change stand-ins (Story 1.18).
let forgotMode = "accepted";
let forgotCount = 0;
let lastForgot = null;
let resetMode = "ok";
let resetCount = 0;
let lastReset = null;
let changeMode = "ok";
let changeCount = 0;
let lastChange = null;
let lastChangeToken = null;
// Agency registration and city reference stand-ins (Story 1.19).
let agencyMode = "accepted";
let agencyCount = 0;
let lastAgency = null;
let citiesMode = "ok";
let citiesCount = 0;
const CITIES = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Karachi" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Lahore" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Islamabad" },
];
// Profile and email change stand-ins (Story 1.20). The profile is stateful so a save shows on the next read.
const PROFILE_START = { full_name: "Ayesha Khan", phone: "+923001234567", email: "ayesha@example.com", pending_email: null };
let profile = { ...PROFILE_START };
let profileMode = "ok";
let profileGets = 0;
let profilePatchMode = "ok";
let profilePatchCount = 0;
let lastProfilePatch = null;
let lastProfilePatchToken = null;
let emailChangeMode = "ok";
let emailChangeCount = 0;
let lastEmailChange = null;
let lastEmailChangeToken = null;
let emailConfirmMode = "ok";
let emailConfirmCount = 0;
let lastEmailConfirm = null;
// Agency business profile stand-in (Story 1.21). Stateful like the individual profile; the email and pending address are
// shared with it so the email-change stubs work unchanged. The city is Karachi, which is in the active list.
const AGENCY_PROFILE_START = {
  agency_name: "Sunrise Estates",
  description: "Residential sales and rentals.",
  city_id: "11111111-1111-4111-8111-111111111111",
  business_phone: "+923211234567",
  office_address: "Office 12, Blue Plaza, Main Boulevard",
};
const INACTIVE_CITY = "77777777-7777-4777-8777-777777777777"; // a stored city that is not in the active list
let agencyProfile = { ...AGENCY_PROFILE_START };
let agencyProfileMode = "ok";
let agencyProfileGets = 0;
let agencyProfilePatchMode = "ok";
let agencyProfilePatchCount = 0;
let lastAgencyProfilePatch = null;
let lastAgencyProfilePatchToken = null;
const pending = []; // responses held open by the hang mode

createServer((req, res) => {
  const url = new URL(req.url, "http://stub");
  const json = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const envelope = (code, message, fields = {}) => ({ error: { code, message, fields, request_id: "stub" } });
  if (url.pathname === "/__confirm-mode") {
    const value = url.searchParams.get("value") ?? "ok";
    if (!["ok", "expired", "used", "invalid", "unknown_code", "expired_status_unknown_code", "invalid_status_no_code", "flaky", "error", "broken", "hang"].includes(value)) {
      return json(400, { error: "unknown mode" });
    }
    confirmMode = value;
    return json(200, { confirmMode });
  }
  if (url.pathname === "/__last-confirm") return json(200, { count: confirmCount, body: lastConfirm });
  if (url.pathname === "/__resend-mode") {
    const value = url.searchParams.get("value") ?? "accepted";
    if (!["accepted", "field", "rate_20", "rate_90", "rate_none", "rate_abc", "error", "broken", "hang"].includes(value)) {
      return json(400, { error: "unknown mode" });
    }
    resendMode = value;
    return json(200, { resendMode });
  }
  if (url.pathname === "/__last-resend") return json(200, { count: resendCount, body: lastResend });
  if (url.pathname === "/api/v1/email-verifications/confirm" && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      confirmCount += 1;
      try {
        lastConfirm = JSON.parse(raw);
      } catch {
        lastConfirm = null;
      }
      if (confirmMode === "ok") return json(200, { status: "verified" });
      if (confirmMode === "flaky") {
        return confirmCount === 1 ? json(500, envelope("server_error", "Internal detail that must not show.")) : json(200, { status: "verified" });
      }
      if (confirmMode === "expired") return json(410, envelope("link_expired", "This link has expired."));
      if (confirmMode === "used") return json(409, envelope("link_used", "This link was already used."));
      if (confirmMode === "invalid") return json(400, envelope("link_invalid", "This link is not valid."));
      if (confirmMode === "unknown_code") return json(403, envelope("forbidden", "Forbidden."));
      if (confirmMode === "expired_status_unknown_code") return json(410, envelope("something_else", "Gone."));
      if (confirmMode === "invalid_status_no_code") return json(400, { detail: "not an envelope" });
      if (confirmMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (confirmMode === "broken") return req.socket.destroy();
      pending.push(res);
    });
    return;
  }
  if (url.pathname === "/api/v1/email-verification-requests" && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      resendCount += 1;
      try {
        lastResend = JSON.parse(raw);
      } catch {
        lastResend = null;
      }
      if (resendMode === "accepted") return json(202, { status: "check_your_email" });
      if (resendMode === "field") return json(400, envelope("validation_error", "Some fields are invalid.", { email: ["Enter a valid email address."] }));
      if (resendMode.startsWith("rate_")) {
        const retry = { rate_20: "20", rate_90: "90", rate_abc: "soon" }[resendMode];
        res.writeHead(429, { "content-type": "application/json", ...(retry ? { "retry-after": retry } : {}) });
        return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      }
      if (resendMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (resendMode === "broken") return req.socket.destroy();
      pending.push(res);
    });
    return;
  }
  const choose = (name, allowed, apply) => {
    const value = url.searchParams.get("value") ?? allowed[0];
    if (!allowed.includes(value)) return json(400, { error: "unknown mode" });
    apply(value);
    return json(200, { [name]: value });
  };
  if (url.pathname === "/__signin-mode") {
    return choose("signInMode", ["ok", "unverified", "suspended", "no_name", "rate_limited", "wrong_credentials", "validation", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      signInMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__me-mode") return choose("meMode", ["up", "agency", "agency_no_name", "agency_bare", "admin", "error", "broken", "hang"], (v) => (meMode = v));
  if (url.pathname === "/__signout-mode") {
    return choose("signOutMode", ["ok", "gone", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      signOutMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__csrf-mode") return choose("csrfMode", ["ok", "error", "rate_limited"], (v) => (csrfMode = v));
  if (url.pathname === "/__force-session") {
    liveSession = true;
    return json(200, {});
  }
  if (url.pathname === "/__expire-session") {
    liveSession = false;
    return json(200, {});
  }
  if (url.pathname === "/__session-stats") {
    return json(200, { csrfFetches, signInCount, signOutCount, meCount, unsafeCount, lastSignIn, lastSignInToken, lastSignOutToken, liveSession, csrfToken: `csrf-${csrfSeed}` });
  }
  const hasSession = () => liveSession && (req.headers.cookie ?? "").includes(SESSION_COOKIE);
  const account = () => ({
    id: "00000000-0000-4000-8000-000000000001",
    account_type: meMode.startsWith("agency") ? "agency" : meMode === "admin" ? "admin" : "individual",
    state: signInMode === "unverified" ? "email_unverified" : signInMode === "suspended" ? "suspended" : "active",
    email: profile.email,
    full_name: meMode === "agency" || meMode === "agency_bare" ? "" : signInMode === "no_name" ? "" : profile.full_name,
    agency_name: meMode === "agency" ? agencyProfile.agency_name : "",
    capabilities: ["sign_in", "browse"],
  });
  if (url.pathname === "/api/v1/csrf" && req.method === "GET") {
    csrfFetches += 1;
    if (csrfMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
    if (csrfMode === "rate_limited") {
      res.writeHead(429, { "content-type": "application/json", "retry-after": "120" });
      return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
    }
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "set-cookie": "csrftoken=stub; HttpOnly; Path=/; SameSite=Lax" });
    return res.end(JSON.stringify({ csrf_token: `csrf-${csrfSeed}` }));
  }
  if (url.pathname === "/api/v1/me" && req.method === "GET") {
    meCount += 1;
    if (meMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
    if (meMode === "broken") return req.socket.destroy();
    if (meMode === "hang") {
      pending.push(res);
      return;
    }
    res.setHeader("cache-control", "no-store");
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication required."));
    return json(200, account());
  }
  if (url.pathname === "/api/v1/session" && (req.method === "POST" || req.method === "DELETE")) {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      unsafeCount += 1;
      const isSignIn = req.method === "POST";
      const mode = isSignIn ? signInMode : signOutMode;
      const sentToken = req.headers["x-csrftoken"] ?? null;
      if (isSignIn) {
        signInCount += 1;
        lastSignInToken = sentToken;
        try {
          lastSignIn = JSON.parse(raw);
        } catch {
          lastSignIn = null;
        }
      } else {
        signOutCount += 1;
        lastSignOutToken = sentToken;
      }
      const forbidden = () => json(403, envelope("forbidden", "CSRF check failed."));
      if (mode === "csrf_always") return forbidden();
      if (mode === "csrf_once" && !csrfOnceSpent) {
        csrfOnceSpent = true;
        csrfSeed += 1; // the stale token is what the client holds; a refetch returns the new one
        return forbidden();
      }
      if (sentToken !== `csrf-${csrfSeed}`) return forbidden();
      if (isSignIn) {
        if (mode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
        if (mode === "broken") return req.socket.destroy();
        if (mode === "hang") {
          pending.push(res);
          return;
        }
        if (mode === "rate_limited") {
          res.writeHead(429, { "content-type": "application/json", "retry-after": "120" });
          return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
        }
        if (mode === "wrong_credentials") return json(401, envelope("invalid_credentials", "Internal: no such account."));
        if (mode === "validation") {
          return json(400, envelope("validation_error", "Some fields are invalid.", { email: ["Enter a valid email address."], password: ["This field may not be blank."] }));
        }
        liveSession = true;
        csrfSeed += 1; // the backend rotates the CSRF secret with the new session
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "set-cookie": `${SESSION_COOKIE}; HttpOnly; Path=/; SameSite=Lax` });
        return res.end(JSON.stringify(account()));
      }
      if (mode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (mode === "broken") return req.socket.destroy();
      if (mode === "hang") {
        pending.push(res);
        return;
      }
      const had = hasSession();
      liveSession = false;
      csrfSeed += 1;
      if (mode === "gone" || !had) {
        res.writeHead(401, { "content-type": "application/json", "set-cookie": "estate_session=; Max-Age=0; Path=/" });
        return res.end(JSON.stringify(envelope("unauthenticated", "Authentication required.")));
      }
      res.writeHead(204, { "set-cookie": "estate_session=; Max-Age=0; Path=/" });
      return res.end();
    });
    return;
  }
  if (url.pathname === "/__forgot-mode") {
    return choose("forgotMode", ["accepted", "field", "codes", "rate_limited", "error", "broken", "hang"], (v) => (forgotMode = v));
  }
  if (url.pathname === "/__last-forgot") return json(200, { count: forgotCount, body: lastForgot });
  if (url.pathname === "/__reset-mode") {
    return choose("resetMode", ["ok", "expired", "used", "invalid", "weak", "weak_once", "weak_messages", "weak_unknown", "token_field", "no_fields", "unknown_code", "rate_limited", "forbidden", "error", "broken", "hang"], (v) => (resetMode = v));
  }
  if (url.pathname === "/__last-reset") return json(200, { count: resetCount, body: lastReset });
  if (url.pathname === "/__change-mode") {
    return choose("changeMode", ["ok", "wrong_current", "same", "weak", "server_messages", "session_gone", "unknown_code", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      changeMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__last-change") return json(200, { count: changeCount, body: lastChange, token: lastChangeToken });
  const readBody = (handle) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      handle(parsed);
    });
  };
  const throttled = () => {
    res.writeHead(429, { "content-type": "application/json", "retry-after": "120" });
    return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
  };
  const serverFailure = (mode) => {
    if (mode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
    if (mode === "broken") return req.socket.destroy();
    pending.push(res); // hang
  };
  if (url.pathname === "/api/v1/password-reset-requests" && req.method === "POST") {
    return readBody((parsed) => {
      forgotCount += 1;
      lastForgot = parsed;
      if (forgotMode === "accepted") return json(202, { status: "check_your_email" });
      if (forgotMode === "field") return json(400, envelope("validation_error", "Some fields are invalid.", { email: ["Enter a valid email address."] }));
      if (forgotMode === "codes") return json(400, envelope("validation_error", "Raw server text.", { email: ["invalid"] }));
      if (forgotMode === "rate_limited") return throttled();
      return serverFailure(forgotMode);
    });
  }
  if (url.pathname === "/api/v1/password-resets/confirm" && req.method === "POST") {
    return readBody((parsed) => {
      resetCount += 1;
      lastReset = parsed;
      res.setHeader("cache-control", "no-store");
      const weak = (message) => json(400, envelope("validation_error", "The request contains invalid values.", { password: [message] }));
      if (resetMode === "ok") return json(200, { status: "password_reset" });
      if (resetMode === "expired") return json(410, envelope("link_expired", "This link has expired. Request a new one."));
      if (resetMode === "used") return json(409, envelope("link_used", "This link has already been used or replaced by a newer one."));
      if (resetMode === "invalid") return json(400, envelope("link_invalid", "This link is not valid. Request a new one."));
      if (resetMode === "weak") return weak("password_too_short");
      if (resetMode === "weak_once") return resetCount === 1 ? weak("password_too_common") : json(200, { status: "password_reset" });
      if (resetMode === "weak_messages") return weak("Pick something harder to guess.");
      if (resetMode === "weak_unknown") return weak("mystery_code");
      if (resetMode === "token_field") return json(400, envelope("validation_error", "Raw server text.", { token: ["invalid"] }));
      if (resetMode === "no_fields") return json(400, envelope("validation_error", "Raw server text."));
      if (resetMode === "unknown_code") return json(410, envelope("something_else", "Raw server text that must not show."));
      if (resetMode === "rate_limited") return throttled();
      if (resetMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
      return serverFailure(resetMode);
    });
  }
  if (url.pathname === "/api/v1/me/password" && req.method === "POST") {
    return readBody((parsed) => {
      unsafeCount += 1;
      changeCount += 1;
      lastChange = parsed;
      const sentToken = req.headers["x-csrftoken"] ?? null;
      lastChangeToken = sentToken;
      res.setHeader("cache-control", "no-store");
      const fieldError = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      if (changeMode === "session_gone") {
        liveSession = false;
        return json(401, envelope("unauthenticated", "Authentication is required."));
      }
      if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
      if (changeMode === "csrf_always") return json(403, envelope("forbidden", "CSRF check failed."));
      if (changeMode === "csrf_once" && !csrfOnceSpent) {
        csrfOnceSpent = true;
        csrfSeed += 1;
        return json(403, envelope("forbidden", "CSRF check failed."));
      }
      if (sentToken !== `csrf-${csrfSeed}`) return json(403, envelope("forbidden", "CSRF check failed."));
      if (changeMode === "wrong_current") return fieldError({ current_password: ["incorrect"] });
      if (changeMode === "same") return fieldError({ new_password: ["password_same_as_current"] });
      if (changeMode === "weak") return fieldError({ new_password: ["password_too_short", "password_too_common"] });
      if (changeMode === "rate_limited") return throttled();
      if (changeMode === "unknown_code") return fieldError({ new_password: ["mystery_code"] });
      if (changeMode === "server_messages") {
        return fieldError({ current_password: ["The current password is incorrect."], new_password: ["Choose a password different from your current one."] });
      }
      if (changeMode === "error" || changeMode === "broken" || changeMode === "hang") return serverFailure(changeMode);
      return json(200, { status: "password_changed" });
    });
  }
  if (url.pathname === "/__profile-mode") {
    return choose("profileMode", ["ok", "forbidden", "flaky", "session_gone", "malformed", "error", "broken", "hang"], (v) => {
      profileMode = v;
      profileGets = 0;
    });
  }
  if (url.pathname === "/__profile-patch-mode") {
    return choose(
      "profilePatchMode",
      ["ok", "fields", "required", "sentences", "proto", "empty_ok", "non_field", "unknown_code", "empty_fields", "session_gone", "forbidden", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"],
      (v) => {
        profilePatchMode = v;
        csrfOnceSpent = false;
      },
    );
  }
  if (url.pathname === "/__email-change-mode") {
    return choose(
      "emailChangeMode",
      ["ok", "wrong_password", "invalid_email", "required", "sentences", "proto", "non_field", "unknown_code", "session_gone", "forbidden", "rate_limited", "rate_none", "csrf_once", "csrf_always", "error", "broken", "hang"],
      (v) => {
        emailChangeMode = v;
        csrfOnceSpent = false;
      },
    );
  }
  if (url.pathname === "/__email-confirm-mode") {
    return choose(
      "emailConfirmMode",
      ["ok", "expired", "used", "invalid", "other_400", "unknown_code", "rate_limited", "flaky", "error", "broken", "hang"],
      (v) => (emailConfirmMode = v),
    );
  }
  if (url.pathname === "/__last-profile") return json(200, { gets: profileGets, profile });
  if (url.pathname === "/__last-profile-patch") return json(200, { count: profilePatchCount, body: lastProfilePatch, token: lastProfilePatchToken });
  if (url.pathname === "/__last-email-change") return json(200, { count: emailChangeCount, body: lastEmailChange, token: lastEmailChangeToken });
  if (url.pathname === "/__last-email-confirm") return json(200, { count: emailConfirmCount, body: lastEmailConfirm });
  if (url.pathname === "/api/v1/me/profile" && req.method === "GET") {
    profileGets += 1;
    res.setHeader("cache-control", "no-store");
    if (profileMode === "session_gone") {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    if (profileMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (profileMode === "flaky" && profileGets === 1) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (profileMode === "malformed") return json(200, { full_name: 7 });
    if (profileMode === "error" || profileMode === "broken" || profileMode === "hang") return serverFailure(profileMode);
    return json(200, profile);
  }
  // Signed-in unsafe calls share the session, CSRF self-heal and session-gone behaviour.
  // Answers the shared failures and returns true when it has already sent the response.
  const signedInUnsafe = (mode, sentToken) => {
    const reply = (status, body) => {
      json(status, body);
      return true;
    };
    if (mode === "session_gone") {
      liveSession = false;
      return reply(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return reply(401, envelope("unauthenticated", "Authentication is required."));
    if (mode === "csrf_always") return reply(403, envelope("forbidden", "CSRF check failed."));
    if (mode === "csrf_once" && !csrfOnceSpent) {
      csrfOnceSpent = true;
      csrfSeed += 1;
      return reply(403, envelope("forbidden", "CSRF check failed."));
    }
    if (sentToken !== `csrf-${csrfSeed}`) return reply(403, envelope("forbidden", "CSRF check failed."));
    if (mode === "forbidden") return reply(403, envelope("forbidden", "Forbidden."));
    if (mode === "rate_limited") {
      throttled();
      return true;
    }
    if (mode === "rate_none") {
      res.writeHead(429, { "content-type": "application/json" });
      res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      return true;
    }
    return false;
  };
  if (url.pathname === "/api/v1/me/profile" && req.method === "PATCH") {
    return readBody((parsed) => {
      unsafeCount += 1;
      profilePatchCount += 1;
      lastProfilePatch = parsed;
      lastProfilePatchToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(profilePatchMode, lastProfilePatchToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      if (profilePatchMode === "fields") return fail({ full_name: ["invalid_name"], phone: ["invalid_phone"] });
      if (profilePatchMode === "required") return fail({ full_name: ["required"], phone: ["required"] });
      if (profilePatchMode === "sentences") return fail({ full_name: ["Enter a valid name."], phone: ["mystery_code"], role: ["Some server sentence."] });
      if (profilePatchMode === "proto") return fail({ full_name: ["constructor"], phone: ["__proto__"], non_field_errors: ["toString"] });
      if (profilePatchMode === "empty_ok") {
        if (parsed && typeof parsed.full_name === "string") profile = { ...profile, full_name: parsed.full_name };
        if (parsed && typeof parsed.phone === "string") profile = { ...profile, phone: parsed.phone };
        return json(200, {});
      }
      if (profilePatchMode === "non_field") return fail({ non_field_errors: ["unknown_field"] });
      if (profilePatchMode === "unknown_code") return fail({ phone: ["mystery_code"] });
      if (profilePatchMode === "empty_fields") return json(400, envelope("bad_request", "The server rejected this request."));
      if (profilePatchMode === "error" || profilePatchMode === "broken" || profilePatchMode === "hang") return serverFailure(profilePatchMode);
      if (parsed && typeof parsed.full_name === "string") profile = { ...profile, full_name: parsed.full_name };
      if (parsed && typeof parsed.phone === "string") profile = { ...profile, phone: parsed.phone };
      return json(200, profile);
    });
  }
  if (url.pathname === "/api/v1/me/email-change" && req.method === "POST") {
    return readBody((parsed) => {
      unsafeCount += 1;
      emailChangeCount += 1;
      lastEmailChange = parsed;
      lastEmailChangeToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(emailChangeMode, lastEmailChangeToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      if (emailChangeMode === "wrong_password") return fail({ current_password: ["incorrect"] });
      if (emailChangeMode === "invalid_email") return fail({ new_email: ["invalid_email"] });
      if (emailChangeMode === "required") return fail({ new_email: ["required"], current_password: ["required"] });
      if (emailChangeMode === "sentences") return fail({ new_email: ["This address is already registered."], current_password: ["The current password is incorrect."], role: ["Some server sentence."] });
      if (emailChangeMode === "proto") return fail({ new_email: ["__proto__"], current_password: ["constructor"] });
      if (emailChangeMode === "non_field") return fail({ non_field_errors: ["unknown_field"] });
      if (emailChangeMode === "unknown_code") return fail({ current_password: ["mystery_code"] });
      if (emailChangeMode === "error" || emailChangeMode === "broken" || emailChangeMode === "hang") return serverFailure(emailChangeMode);
      // Free, taken and unchanged addresses all answer alike, and the profile shows the pending address for every one.
      if (parsed && typeof parsed.new_email === "string") profile = { ...profile, pending_email: parsed.new_email };
      return json(202, { status: "check_your_email" });
    });
  }
  if (url.pathname === "/api/v1/email-changes/confirm" && req.method === "POST") {
    return readBody((parsed) => {
      emailConfirmCount += 1;
      lastEmailConfirm = parsed;
      res.setHeader("cache-control", "no-store");
      if (emailConfirmMode === "ok" || (emailConfirmMode === "flaky" && emailConfirmCount > 1)) {
        profile = { ...profile, email: profile.pending_email ?? "ayesha.new@example.com", pending_email: null };
        return json(200, { status: "email_changed" });
      }
      if (emailConfirmMode === "flaky") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (emailConfirmMode === "expired") return json(410, envelope("link_expired", "This link has expired."));
      if (emailConfirmMode === "used") return json(409, envelope("link_used", "This link was already used."));
      if (emailConfirmMode === "invalid") return json(400, envelope("link_invalid", "This link is not valid."));
      if (emailConfirmMode === "other_400") return json(400, envelope("validation_error", "Raw server text that must not show.", { token: ["invalid"] }));
      if (emailConfirmMode === "unknown_code") return json(410, envelope("something_else", "Raw server text that must not show."));
      if (emailConfirmMode === "rate_limited") return throttled();
      return serverFailure(emailConfirmMode);
    });
  }
  if (url.pathname === "/__agency-profile-mode") {
    return choose("agencyProfileMode", ["ok", "forbidden", "flaky", "session_gone", "malformed", "inactive_city", "verified", "odd_status", "error", "broken", "hang"], (v) => {
      agencyProfileMode = v;
      agencyProfileGets = 0;
      if (v === "inactive_city") agencyProfile = { ...agencyProfile, city_id: INACTIVE_CITY }; // a later save of another city replaces it
    });
  }
  if (url.pathname === "/__agency-profile-patch-mode") {
    return choose(
      "agencyProfilePatchMode",
      ["ok", "fields", "required", "contact", "description_codes", "invalid_city", "sentences", "proto", "empty_ok", "non_field", "unknown_code", "empty_fields", "session_gone", "forbidden", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"],
      (v) => {
        agencyProfilePatchMode = v;
        csrfOnceSpent = false;
      },
    );
  }
  if (url.pathname === "/__agency-profile-set") {
    // Test-only: changes the stored profile as if another tab or device had saved it.
    for (const name of Object.keys(AGENCY_PROFILE_START)) {
      const value = url.searchParams.get(name);
      if (value !== null) agencyProfile = { ...agencyProfile, [name]: value };
    }
    return json(200, agencyProfile);
  }
  if (url.pathname === "/__last-agency-profile") return json(200, { gets: agencyProfileGets, profile: agencyProfile });
  if (url.pathname === "/__last-agency-profile-patch") {
    return json(200, { count: agencyProfilePatchCount, body: lastAgencyProfilePatch, token: lastAgencyProfilePatchToken });
  }
  const agencyProfileBody = () => ({
    ...agencyProfile,
    email: profile.email,
    pending_email: profile.pending_email,
    verification_status: agencyProfileMode === "verified" ? "verified" : agencyProfileMode === "odd_status" ? "<b>Odd Status</b>" : "unverified",
  });
  if (url.pathname === "/api/v1/me/agency-profile" && req.method === "GET") {
    agencyProfileGets += 1;
    res.setHeader("cache-control", "no-store");
    if (agencyProfileMode === "session_gone") {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    if (agencyProfileMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (agencyProfileMode === "flaky" && agencyProfileGets === 1) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (agencyProfileMode === "malformed") return json(200, { agency_name: 7 });
    if (agencyProfileMode === "error" || agencyProfileMode === "broken" || agencyProfileMode === "hang") return serverFailure(agencyProfileMode);
    return json(200, agencyProfileBody());
  }
  if (url.pathname === "/api/v1/me/agency-profile" && req.method === "PATCH") {
    return readBody((parsed) => {
      unsafeCount += 1;
      agencyProfilePatchCount += 1;
      lastAgencyProfilePatch = parsed;
      lastAgencyProfilePatchToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(agencyProfilePatchMode, lastAgencyProfilePatchToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      const mode = agencyProfilePatchMode;
      if (mode === "fields") {
        return fail({ agency_name: ["invalid_name"], business_phone: ["invalid_phone"], office_address: ["invalid_address"], city_id: ["invalid"] });
      }
      if (mode === "required") {
        const required = ["required"];
        return fail({ agency_name: required, business_phone: required, office_address: required, city_id: required });
      }
      if (mode === "contact") return fail({ description: ["contains_contact_details"] });
      if (mode === "description_codes") return fail({ description: ["invalid_description", "invalid"] });
      if (mode === "invalid_city") return fail({ city_id: ["invalid_city"] });
      if (mode === "sentences") return fail({ agency_name: ["Enter a valid name."], description: ["mystery_code"], role: ["Some server sentence."] });
      if (mode === "proto") return fail({ agency_name: ["constructor"], description: ["__proto__"], non_field_errors: ["toString"] });
      if (mode === "non_field") return fail({ non_field_errors: ["unknown_field"] });
      if (mode === "unknown_code") return fail({ business_phone: ["mystery_code"] });
      if (mode === "empty_fields") return json(400, envelope("bad_request", "The server rejected this request."));
      if (mode === "error" || mode === "broken" || mode === "hang") return serverFailure(mode);
      for (const name of Object.keys(AGENCY_PROFILE_START)) {
        if (parsed && typeof parsed[name] === "string") {
          // The backend collapses all whitespace in the description.
          agencyProfile = { ...agencyProfile, [name]: name === "description" ? parsed[name].replace(/\s+/g, " ").trim() : parsed[name] };
        }
      }
      if (mode === "empty_ok") return json(200, {});
      return json(200, agencyProfileBody());
    });
  }
  if (url.pathname === "/__cities-mode") {
    return choose("citiesMode", ["ok", "empty", "error", "flaky", "hang", "slow", "other", "malformed", "partial"], (v) => {
      citiesMode = v;
      citiesCount = 0;
    });
  }
  if (url.pathname === "/__last-cities") return json(200, { count: citiesCount });
  if (url.pathname === "/api/v1/reference/cities" && req.method === "GET") {
    citiesCount += 1;
    if (citiesMode === "ok") return json(200, { items: CITIES });
    if (citiesMode === "empty") return json(200, { items: [] });
    if (citiesMode === "other") return json(200, { items: [{ id: "44444444-4444-4444-8444-444444444444", name: "Multan" }, { id: "55555555-5555-4555-8555-555555555555", name: "Peshawar" }] });
    if (citiesMode === "malformed") return json(200, { items: [{ id: 7, name: "Numeric id" }, { id: "66666666-6666-4666-8666-666666666666", name: "  " }, null] });
    if (citiesMode === "partial") {
      return json(200, { items: [CITIES[0], { id: CITIES[0].id, name: "Duplicate id" }, { id: 7, name: "Numeric id" }, { id: "66666666-6666-4666-8666-666666666666", name: "" }, CITIES[1]] });
    }
    if (citiesMode === "flaky") return citiesCount === 1 ? json(500, envelope("server_error", "Internal detail that must not show.")) : json(200, { items: CITIES });
    if (citiesMode === "slow") return void setTimeout(() => json(200, { items: CITIES }), 1500);
    return serverFailure(citiesMode);
  }
  if (url.pathname === "/__agency-mode") {
    return choose("agencyMode", [
      "accepted", "existing", "ok_200", "email_sentence", "fields", "required", "sentences", "invalid_city", "mixed", "non_field", "empty_fields",
      "bad_json", "signed_in", "bad_gateway", "rate_limited", "rate_20", "rate_90", "rate_none", "rate_abc", "error", "broken", "hang",
    ], (v) => (agencyMode = v));
  }
  if (url.pathname === "/__last-agency") return json(200, { count: agencyCount, body: lastAgency });
  if (url.pathname === "/api/v1/registrations/agencies" && req.method === "POST") {
    return readBody((parsed) => {
      agencyCount += 1;
      lastAgency = parsed;
      const fail = (fields) => json(400, envelope("validation_error", "Some fields are invalid.", fields));
      if (agencyMode === "accepted" || agencyMode === "existing") return json(202, { status: "check_your_email" });
      if (agencyMode === "ok_200") return json(200, { status: "check_your_email" });
      if (agencyMode === "email_sentence") return fail({ email: ["This address is already registered."] });
      if (agencyMode === "fields") {
        return fail({
          agency_name: ["invalid_name"],
          email: ["invalid_email"],
          phone: ["invalid_phone"],
          office_address: ["invalid_address"],
          city_id: ["invalid"],
          password: ["password_too_short", "password_too_common"],
        });
      }
      if (agencyMode === "required") {
        const required = ["required"];
        return fail({ agency_name: required, email: required, phone: required, office_address: required, city_id: required, password: required });
      }
      if (agencyMode === "sentences") return fail({ agency_name: ["Enter a valid agency name."], phone: ["mystery_code"] });
      if (agencyMode === "invalid_city") return fail({ city_id: ["invalid_city"] });
      if (agencyMode === "mixed") return fail({ email: ["invalid_email"], role: ["Unknown field."], non_field_errors: ["unknown_field"] });
      if (agencyMode === "non_field") return fail({ non_field_errors: ["Unexpected field."] });
      if (agencyMode === "empty_fields") return json(400, envelope("bad_request", "The server rejected this request."));
      if (agencyMode === "bad_json") {
        res.writeHead(400, { "content-type": "text/plain" });
        return res.end("not json");
      }
      if (agencyMode === "signed_in") return json(403, envelope("forbidden", "Forbidden."));
      if (agencyMode === "bad_gateway") {
        res.writeHead(502, { "content-type": "text/html" });
        return res.end("<html><body>Bad gateway</body></html>");
      }
      if (agencyMode.startsWith("rate_")) {
        const retry = { rate_limited: "1800", rate_20: "20", rate_90: "90", rate_abc: "soon" }[agencyMode];
        res.writeHead(429, { "content-type": "application/json", ...(retry ? { "retry-after": retry } : {}) });
        return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      }
      return serverFailure(agencyMode);
    });
  }
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
    confirmMode = "ok";
    confirmCount = 0;
    lastConfirm = null;
    resendMode = "accepted";
    resendCount = 0;
    lastResend = null;
    signInMode = "ok";
    meMode = "up";
    signOutMode = "ok";
    liveSession = false;
    csrfSeed = 0;
    csrfFetches = signInCount = signOutCount = meCount = unsafeCount = 0;
    lastSignIn = lastSignInToken = lastSignOutToken = null;
    csrfOnceSpent = false;
    csrfMode = "ok";
    forgotMode = "accepted";
    forgotCount = 0;
    lastForgot = null;
    resetMode = "ok";
    resetCount = 0;
    lastReset = null;
    changeMode = "ok";
    changeCount = 0;
    lastChange = lastChangeToken = null;
    agencyMode = "accepted";
    agencyCount = 0;
    lastAgency = null;
    citiesMode = "ok";
    citiesCount = 0;
    profile = { ...PROFILE_START };
    profileMode = profilePatchMode = emailChangeMode = emailConfirmMode = "ok";
    profileGets = profilePatchCount = emailChangeCount = emailConfirmCount = 0;
    agencyProfile = { ...AGENCY_PROFILE_START };
    agencyProfileMode = agencyProfilePatchMode = "ok";
    agencyProfileGets = agencyProfilePatchCount = 0;
    lastAgencyProfilePatch = lastAgencyProfilePatchToken = null;
    lastProfilePatch = lastProfilePatchToken = lastEmailChange = lastEmailChangeToken = lastEmailConfirm = null;
    while (pending.length) pending.pop().end();
    return json(200, { mode });
  }
  if (url.pathname === "/__registration-mode") {
    const value = url.searchParams.get("value") ?? "accepted";
    if (![
      "accepted", "ok_200", "fields", "required", "empty_fields", "bad_json", "mixed", "forbidden", "bad_gateway",
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
      if (registrationMode === "ok_200") return json(200, { status: "check_your_email" });
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

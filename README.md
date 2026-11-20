# EstateAI frontend

Next.js 16 (App Router, TypeScript strict, Tailwind) frontend for EstateAI, an intelligent
property marketplace. The backend lives in
[estate-ai-backend](https://github.com/riyanj220/estate-ai-backend); planning documents
(PRD, architecture, epics, story specs) are kept there under `_bmad-output/`.

## Setup

Requires Node 24 (`.nvmrc`) and npm.

```bash
nvm use
npm ci
npm run dev          # http://localhost:3000
```

The browser only calls `/api/*` on its own origin; Next.js proxies it to the backend at
`BACKEND_URL` (default `http://127.0.0.1:8000`; empty or whitespace counts as unset). Start the Django backend
separately. The rewrite reads `BACKEND_URL` when `next.config.ts` loads, so it is fixed at build time for
`next build`/`next start`; set it before building. Server-side fetches have a 5 s timeout.
Server components call the backend through the generated client and forward the incoming cookie.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run api:sync` | Copy the backend `openapi.yaml` into `src/api/` and regenerate the typed client |
| `npm run api:check [-- --offline]` | Fail if the client is stale; also compares the spec copy with backend `main` unless `--offline` |
| `npx playwright test` | Playwright with axe, against a stubbed backend (`npx playwright install chromium` first; same command as CI) |

## Environment variables

| Variable | Purpose |
| --- | --- |
| `BACKEND_URL` | Backend origin for the proxy and server-side client (see above) |
| `BACKEND_OPENAPI_PATH` | Path to the backend `openapi.yaml` for `npm run api:sync` (default `../estate-ai-backend/openapi.yaml`) |
| `BACKEND_OPENAPI_URL` | Raw URL of the backend `main` `openapi.yaml` used by the online `api:check` |
| `PW_CHANNEL` | e.g. `chrome`: run Playwright against an installed browser instead of the downloaded Chromium |

## Two-repo workflow

The contract is the backend's committed `openapi.yaml`. `src/api/` holds a committed copy of it
and the generated client (`schema.ts`); never edit those by hand. `src/lib/api.ts` is the only
place the client is built.

After a backend change to the API:

1. Merge or check out the backend change (backend `openapi.yaml` regenerated and committed).
2. Run `npm run api:sync` here (the backend repo is expected at `../estate-ai-backend`; set
   `BACKEND_OPENAPI_PATH` to override).
3. Commit `src/api/`.

CI regenerates the client from the committed spec and fails on any diff on every run. The online
check that the spec copy equals the backend `main` `openapi.yaml` runs only on pushes to `main`, so a
frontend PR can precede its backend merge.

## Registration page (`/register`)

Individual registration (Story 1.15). The form (`src/app/(public)/register/register-form.tsx`, a client
component) posts `full_name`, `email`, `password` and `phone` to `POST /api/v1/registrations/individuals`
through the generated client on the same origin (`/api` proxy). It holds no business rules and the form is
`noValidate`, so even empty or malformed input goes to the server: validation messages come from the backend `400` error envelope and are shown under the fields and in a focused summary;
`429` shows the wait time from `Retry-After`; `202` shows "Check your email". Entered values live in component
state only (password and phone are cleared on success). Styling uses the Atlas CSS variables in
`src/app/globals.css`.

To try it against the real backend: start Django (`BACKEND_URL`, default `http://127.0.0.1:8000`), run
`npm run dev` and open `http://localhost:3000/register`. The Playwright tests use the stub backend instead
(`tests/e2e/stub-backend.mjs`, registration modes set through `/__registration-mode`).

## Agency registration page (`/register/agency`)

Story 1.19 (frontend half). The contract is the backend's `docs/registration.md`. A separate page from the Individual
form (`src/app/(public)/register/agency/`, form in `agency-register-form.tsx`) with Agency name, Business email, Business
phone, Office address (textarea, 300 characters), City and Password, all required and labelled with `autocomplete` hints.
It posts exactly `{agency_name, email, phone, office_address, city_id, password}` to `POST /api/v1/registrations/agencies`
(email trimmed, the rest as typed). The `/register` page links to it, it links back, and the home page links to both.

- **Cities**: loaded in the browser on mount from `GET /api/v1/reference/cities` through the typed client with
  `withTimeout`, so the page stays static. While loading the select is disabled ("Loading cities"); the first option is a
  disabled "Select a city". A failure (5xx, timeout, network) shows an inline message with a Retry button and the rest of
  the form stays usable; an empty list shows "No cities are available right now." Either way submit is blocked by the
  required check on the city. The sent value is the city `id`; no list is hard-coded.
- **Required checks** are the only client rule: an empty field shows an error in the focused summary and sends nothing.
  Everything else is the server's: a `400` maps `fields` to the form fields with human text for the known codes
  (`src/lib/registration-messages.ts`, password codes from `src/lib/password-messages.ts`), shows other static server
  sentences as sent and anything else as "Enter a valid value."; `non_field_errors` and unknown keys go to the summary. The
  password is cleared after a `400`, the other values are kept. `invalid_city` also clears the selection and re-fetches the
  list (the usual cause is a city deactivated since the page loaded).
- `202` shows the same generic "Check your email" state as the Individual form (`src/components/check-your-email.tsx`), so
  nothing says whether the address was registered. `429` shows the wait from `Retry-After`; `403` (a signed-in caller)
  shows "You are already signed in. Sign out to register another account."; `5xx`, timeout, network failure and a rejected
  request each have their own message. Password, email, phone and address live in component state only.
- **City loading details**: the status element above the select stays mounted (a focused Retry never disappears) and
  every city message goes through the form's single live region. The select is disabled only during the first load. After
  every load the chosen city is dropped if it is not in the new list; items that are not `{id: string, name: non-empty}`
  or repeat an id are filtered, and a `200` with no usable item counts as a failed load. When the list failed or is
  empty, the City required error says so and its summary link goes to the Retry button.
- **Native submit**: every form that holds a password or private values has `method="post"`, so a submit before the page has
  hydrated can never put values in a GET query string.
- Success needs exactly `202`; any other `2xx` shows the rejected-request message. The email field only ever shows known
  codes (never a server sentence). A multi-line office address is collapsed to one line as it is typed or pasted.
  On success only the password is cleared, so "Use a different email address" keeps the other fields.
- **Follow-up (not done)**: the Individual form does not yet have the agency form's timeout and 403 messages, code maps, 202-only
  success or kept-values behaviour (it still clears the phone on success); porting them is a separate change.
- **Shared code** extracted from the Individual form (whose behaviour and tests are unchanged): `src/components/form-field.tsx`
  (`Field`, `PasswordField` with the show/hide control), `src/components/error-summary.tsx`,
  `src/components/check-your-email.tsx` and `src/lib/use-form-feedback.ts` (announcement, notice and summary focus).
- **Display name**: `displayName(account)` (`src/lib/account.ts`) is the `agency_name` for agency accounts, else the full
  name, else the email; the header and the dashboard use it, and the dashboard shows the account type ("Agency",
  "Individual") as plain text. `GET /api/v1/me` now carries `agency_name`.
- Playwright stub: `/__agency-mode` (`accepted`, `existing`, `ok_200`, `email_sentence`, `fields`, `required`, `sentences`, `invalid_city`, `mixed`,
  `non_field`, `empty_fields`, `bad_json`, `signed_in`, `bad_gateway`, `rate_limited`, `rate_20`, `rate_90`, `rate_none`,
  `rate_abc`, `error`, `broken`, `hang`) with `/__last-agency`; `/__cities-mode` (`ok`, `empty`, `error`, `flaky`, `hang`,
  `slow`, `other`, `malformed`, `partial`) with `/__last-cities` (request count); `/__me-mode` also takes `agency`, `agency_no_name`, `agency_bare` and `admin`. Tests:
  `tests/e2e/agency-register.spec.ts`.
- **Hand-off**: the account is created Email-unverified with agency verification status "unverified"; nothing here
  shows or decides that status. The agency's own profile page (Story 1.21) builds on the `account_type` and
  `agency_name` already in the session summary; the Individual profile page is Story 1.20.

## Email verification page (`/verify-email`)

Story 1.16 (frontend half). The emailed link opens `/verify-email?token=...`. The client component
(`src/app/(public)/verify-email/verify-email-client.tsx`) reads the token, removes it from the address bar with
`history.replaceState`, then sends one `POST /api/v1/email-verifications/confirm` (a ref guard prevents a second
request). The token lives only in a ref: it is never logged, stored or rendered. The state comes from the response
(`error.code` of the standard envelope): success, `link_expired`, `link_used`, `link_invalid`, a missing token, or a
generic retry state (network, timeout, `5xx`, unknown code) with a "Try again" button that reuses the token in
memory. Every link failure shows a request-a-new-link form (`request-link-form.tsx`, `POST
/api/v1/email-verification-requests`): `202` always shows the same generic confirmation, `429` shows the wait from
`Retry-After`, `400` shows the server's message. `next.config.ts` sends `Referrer-Policy: no-referrer` and
`Cache-Control: no-store` for the route. Helpers shared with the registration page live in `src/lib/forms.ts`.
The Playwright stub has `/__confirm-mode` and `/__resend-mode` (see `tests/e2e/stub-backend.mjs`).

## Sign-in, sign-out and the signed-in area

Story 1.17 (frontend half). The contract is the backend's `docs/sessions.md`.

- `src/lib/csrf.ts`: `getCsrfToken()` fetches `GET /api/v1/csrf` once and keeps the token in memory only; concurrent
  callers share one fetch. `clearCsrfToken()` drops it (done after sign-in and sign-out, because the backend rotates
  it). `withCsrf(call)` sends it as `X-CSRFToken`; a `403` refetches the token and retries that call once, a second
  `403` is returned as a failure.
- `src/lib/session.tsx`: `SessionProvider` (mounted in the root layout) restores the session with `GET /api/v1/me` and
  exposes `{status: "loading" | "signed_out" | "signed_in" | "error", account, signIn, signOut, refresh}`. `401` is
  signed out; any other failure is `error` (the header says "Could not check your session" with Retry, never a false
  signed-out claim). The account summary lives in memory only; the session cookie is HttpOnly and never touched by script.
- `src/components/site-header.tsx`: brand link; Sign in and Create account for a Visitor; display name, a state note
  ("Email not verified", "Account restricted", driven only by `state`) and Sign out for a signed-in account.
- `/sign-in` (`src/app/(public)/sign-in/`): email and password, same accessibility pattern as `/register`. One message for
  every credential failure (`401 invalid_credentials`); field messages from a `400` envelope; separate generic messages for
  a rejected request (`403` after the retry), `5xx`, timeout and network failure. A signed-in visitor is redirected to
  `/dashboard`. `?next=` is validated by `src/lib/next-target.ts` (single leading `/`, no `//`, no backslash, no control
  characters, at most 200 characters); anything else goes to `/dashboard`.
- Guard (`src/lib/current-account.ts`, `src/components/guarded.tsx`): the `(app)` and `admin` layouts call the backend
  `GET /api/v1/me` on the server with the forwarded cookie. `401` redirects to `/sign-in?next=<requested path>`; a backend
  failure renders "Temporarily unavailable" and no protected content. The areas are dynamic and sent `Cache-Control:
  no-store`. `src/proxy.ts` (Next.js 16 name for middleware) copies the requested path into the `x-requested-path` request
  header, overwriting any client-supplied value, because layouts cannot see the path. Any signed-in account may see the
  `/admin` placeholder until Story 1.19 adds the role check.
- Playwright stub (`tests/e2e/stub-backend.mjs`): `/api/v1/csrf`, `/api/v1/session` (POST, DELETE), `/api/v1/me` with a
  stateful cookie (`me` is `401` before sign-in and after sign-out) and a rotating CSRF token. Modes:
  `/__signin-mode` (`ok`, `unverified`, `suspended`, `wrong_credentials`, `validation`, `csrf_once`, `csrf_always`,
  `error`, `broken`, `hang`), `/__me-mode` (`up`, `error`, `broken`, `hang`), `/__signout-mode` (`ok`, `gone`,
  `csrf_once`, `csrf_always`, `error`, `broken`), plus `/__session-stats`, `/__force-session`, `/__expire-session`.

## Password reset and change

Story 1.18 (frontend half). The contract is the backend's `docs/password-reset.md`.

- `/forgot-password` (`src/app/(public)/forgot-password/`): email field, `POST /api/v1/password-reset-requests`. A `202`
  always shows the same confirmation ("If that address has an account, we have sent a link. It works once and expires in
  1 hour."), so nothing says whether the address exists; the address is trimmed. `429` shows the wait from `Retry-After`,
  `400` shows field errors on the email field, and `5xx`, timeout and network failure each have their own message. An empty
  field sends nothing. The sign-in page links here ("Forgot your password?").
- `/reset-password` (`src/app/(public)/reset-password/`, the emailed link): `reset-password-client.tsx` reads `token` from
  the query, removes it from the address bar with `history.replaceState` (other parameters stay) and keeps it only in a
  ref. Nothing is sent on load; the person types a new password and `POST /api/v1/password-resets/confirm` sends exactly
  `{token, password}`. `200` shows success with a sign-in link and refreshes the header (every session ended server-side);
  `link_expired` (410), `link_used` (409) and `link_invalid` (400) each have their own state with a "Request a new link" link
  and drop the token; a `400 validation_error` shows the mapped policy message under the field and keeps the form and the
  token (the link is not consumed by a typo); `429`, `5xx`, timeout and network failure keep the form. `next.config.ts`
  sends `Referrer-Policy: no-referrer` and `Cache-Control: no-store` for the route. The page is statically prerendered on
  purpose (no `force-dynamic`), so the token never reaches the served HTML. In `next dev` the framework embeds the requested
  URL in script payloads, so the "no token in the HTML" check is made against the production build:
  `BACKEND_URL=http://127.0.0.1:4010 npm run build`, `npx next start -p 3100` with the stub, then
  `curl -si "http://127.0.0.1:3100/reset-password?token=abc"` shows the headers and no `abc` in the body.
- `/account/password` (`src/app/(app)/account/password/`): signed-in only (same guard as the dashboard; `no-store`).
  Current password and New password, each with a show/hide button, `POST /api/v1/me/password` through `withCsrf`.
  `200` shows "Your password was changed. Your other devices were signed out.", clears both fields and refreshes the
  session provider; `400` maps `current_password` (`incorrect`) and `new_password` codes (policy codes and
  `password_same_as_current`) to text; `401` refreshes the provider (signed out) and goes to
  `/sign-in?next=%2Faccount%2Fpassword`; a second `403`, `5xx`, timeout and network failure show generic messages. The
  header and the dashboard link to it.
- The reset request and the reset confirm are anonymous calls: the backend views set `authentication_classes = []` and
  ignore the session cookie, so they are sent without a CSRF token (no `withCsrf`); only the signed-in change uses it.
  The production check above (`next build && next start`, then `curl -si` on `/reset-password?token=...`) is manual; the
  Playwright header assertions run against `next dev`, which also sends `no-store`, so `password.spec.ts` additionally
  asserts the `headers()` rules in `next.config.ts` directly.
- `src/lib/password-messages.ts`: the one map from backend codes to human text. The backend sends its own static field
  messages (never echoing input) rather than bare codes, so a value that is not a known code but is a sentence is shown
  as sent; anything else becomes "Enter a valid value." The Individual register form shows server messages directly; the agency form maps its codes
  (`src/lib/registration-messages.ts`).
- Playwright stub: `/__forgot-mode` (`accepted`, `field`, `rate_limited`, `error`, `broken`, `hang`), `/__reset-mode`
  (`ok`, `expired`, `used`, `invalid`, `weak`, `weak_once`, `weak_messages`, `rate_limited`, `forbidden`, `error`, `broken`,
  `hang`) and `/__change-mode` (`ok`, `wrong_current`, `same`, `weak`, `server_messages`, `session_gone`, `csrf_once`,
  `csrf_always`, `error`, `broken`, `hang`), with `/__last-forgot`, `/__last-reset` and `/__last-change` for the request
  bodies. Tests: `tests/e2e/password.spec.ts`.

## Layout

- `src/app/(public)` public pages (includes `/health`, `/register`, `/register/agency`, `/verify-email`, `/forgot-password` and `/reset-password`), `src/app/(app)` signed-in pages,
  `src/app/admin` admin area. Placeholders only; no visibility, privacy or quota logic lives here.

`/dashboard` and `/admin` are placeholders guarded on the server (see above); `/admin` has no role check until Story 1.19.
Both are marked `noindex`.

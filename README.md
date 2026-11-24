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
  header, overwriting any client-supplied value, because layouts cannot see the path. The admin area has its own,
  stricter guard (see "Admin area").
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

## Profile and email change

Story 1.20 (frontend half). The contract is the backend's `docs/profile.md`.

- `/account/profile` (`src/app/(app)/account/profile/`): signed-in only (same guard as the dashboard; `no-store` through the
  `/account/:path*` rule). `profile-client.tsx` loads `GET /api/v1/me/profile` on the client (`{full_name, phone, email,
  pending_email}`) with a loading state and a Retry on 5xx, timeout, network or an unreadable body; `403` (not an Individual)
  shows "Profile editing is available for individual accounts." with no form; `401` flips the session provider to signed out
  and goes to `/sign-in?next=%2Faccount%2Fprofile`. Linked from the header and the dashboard as "Profile".
  - `details-form.tsx`: Full name and Phone number, both required (client check sends nothing), prefilled. Submit sends
    `PATCH /api/v1/me/profile` through `withCsrf` with only the fields that changed (nothing changed: no request and "No
    changes to save."). `200` shows "Your profile was saved.", refreshes the form from the answer and the session provider
    (the header name updates); the note clears when a field is edited. `400` maps the codes (`required`, `invalid`,
    `invalid_name`, `invalid_phone`, `unknown_field`) through `PROFILE_MESSAGES` to text against the fields with the summary
    focused; 429 (with the wait), 5xx, timeout, network and a second 403 each have a generic message. The phone appears only
    in this input.
  - `email-change-form.tsx`: shows the current address and, when `pending_email` is set, "We received a request to change to
    ... If that address can be used, we sent it a confirmation link. Your sign-in address stays ... until you open the
    link." (neutral on purpose: the backend sets `pending_email` for free, taken, same and capped addresses alike, and the
    note never claims a link definitely went out; the address is shown in text only; if the quiet re-read after a 202 fails
    the typed address stands in). New email address (`autocomplete="off"`) and Current
    password (`current-password`, show/hide) send exactly `{new_email, current_password}` to `POST /api/v1/me/email-change`
    through `withCsrf`. Any `202` shows the one neutral confirmation ("If that address can be used, we have sent it a
    confirmation link. Your sign-in address does not change until you open it."), clears the password and re-reads the
    profile quietly so the pending note appears. `400` maps `new_email` (known codes only, so no server sentence can hint at
    whether an address is registered) and `current_password: incorrect`, and clears the password; 429, 403, 5xx, timeout and
    network show generic messages.
  - Server text is allow-listed: both forms show only known codes (`PROFILE_MESSAGES`, `CURRENT_PASSWORD_MESSAGES`,
    `GENERAL_FIELD_MESSAGES`) through `mapKnownCodes`; any other sentence, unknown code, prototype key (`constructor`) or
    unknown field key becomes the generic field text or the generic rejected message, never verbatim. `mapFieldMessages` (used
    by the older forms) looks codes up with `Object.hasOwn`.
  - The profile re-reads silently on window focus and `visibilitychange` (never flips to loading; a failure keeps the page).
    While a save is in flight only fields the person has not touched since submitting take the server's value; a trim-only
    difference is set to the trimmed value with "No changes to save."; a 2xx with an unreadable body shows a polite "saved,
    reload to see" note and triggers a re-read. The "Profile" header and dashboard links show for individual accounts only.
    Retry keeps its heading and button mounted (`aria-disabled`) and focuses the form heading on success.
  - A CSRF rejection happens before the backend service runs, so the one CSRF retry in `withCsrf` cannot double-count the
    password throttle; a second 403 is the generic rejected message.
  - The two forms are independent: each has its own error summary (unique title ids), one live region and busy state.
- `/confirm-email-change` (`src/app/(public)/confirm-email-change/`, the emailed link): handled exactly like
  `/reset-password`. `confirm-email-change-client.tsx` reads `token`, removes it from the address bar with
  `history.replaceState` (other parameters stay), keeps it only in a ref, and sends nothing on load: the person presses
  "Confirm the change" (so a prefetch or link scanner cannot consume it) and `POST /api/v1/email-changes/confirm` sends
  exactly `{token}` (anonymous call, no CSRF). `200` shows "Your sign-in email address was changed. Use the new address to
  sign in next time." with links to sign in and the profile, drops the token and refreshes the session provider;
  `link_expired` (410), `link_used` (409) and `link_invalid` (400, any 400) each have their own state with a "Request the
  change again" link to `/account/profile` and drop the token; a missing or blank token shows the invalid state; 429, 5xx,
  timeout, network and unknown codes keep the button and the token with a generic message (a 410 or 409 with an unknown code
  is deliberately the generic message, not a link state: only the documented code and status pairs end the link). The
  scrub (`src/lib/scrub-token.ts`) also rewrites the router's `history.state`, which otherwise keeps the token in
  `renderedSearch`, so Back never restores it. `next.config.ts` sends
  `Referrer-Policy: no-referrer` and `Cache-Control: no-store` for the route and the page is statically prerendered (no
  `force-dynamic`), so the token never reaches the served HTML. Check against the production build:
  `BACKEND_URL=http://127.0.0.1:4010 npm run build`, `node tests/e2e/stub-backend.mjs`, `npx next start -p 3100`, then
  `curl -si "http://127.0.0.1:3100/confirm-email-change?token=abc"` shows both headers and no `abc` in the body.
- Shared code: `PROFILE_MESSAGES` in `src/lib/registration-messages.ts`, `mapKnownCodes` in `src/lib/password-messages.ts`, `src/lib/request-errors.ts` (generic messages for a
  failed answer or a thrown error), and `PasswordField` takes an `autoComplete` prop. The check-your-email component is not
  reused: its text is registration-specific.
- Playwright stub: `/__profile-mode` (`ok`, `forbidden`, `flaky`, `session_gone`, `malformed`, `error`, `broken`, `hang`),
  `/__profile-patch-mode` (`ok`, `fields`, `required`, `sentences`, `proto`, `empty_ok`, `non_field`, `unknown_code`, `empty_fields`,
  `session_gone`, `forbidden`, `rate_limited`, `csrf_once`, `csrf_always`, `error`, `broken`, `hang`),
  `/__email-change-mode` (`ok`, `wrong_password`, `invalid_email`, `required`, `sentences`, `proto`, `non_field`, `unknown_code`,
  `session_gone`, `forbidden`, `rate_limited`, `rate_none`, `csrf_once`, `csrf_always`, `error`, `broken`, `hang`) and
  `/__email-confirm-mode` (`ok`, `expired`, `used`, `invalid`, `other_400`, `unknown_code`, `rate_limited`, `flaky`, `error`,
  `broken`, `hang`), with `/__last-profile`, `/__last-profile-patch`, `/__last-email-change` and `/__last-email-confirm`. The
  profile is stateful (a save shows on the next read, any accepted email request sets `pending_email`, a confirm moves it
  into `email`). Tests: `tests/e2e/profile.spec.ts`.
- Hand-off to Story 1.21 (Agency profile management): done, see "Agency business profile" below. The Individual routes still
  answer `403` for an Agency, so the one page picks its body by account type.

## Agency business profile

Story 1.21 (frontend half). The contract is the backend's `docs/profile.md` (Agency section).

- **One route, two bodies**: `/account/profile` keeps its guard (`requireAccount`) and `no-store`. `page.tsx` switches on the
  session's `account_type`: `individual` renders the Story 1.20 `ProfileClient` unchanged, `agency` renders
  `agency-profile-client.tsx` ("Business profile"), anything else (admin, unknown) shows "Profile editing is available for
  individual and agency accounts." with no form. The header and dashboard link ("Profile" for individuals, "Business profile"
  for agencies) come from `profileLinkLabel` in `src/lib/account.ts`; admins get none.
- `agency-profile-client.tsx` loads `GET /api/v1/me/agency-profile` (`{agency_name, description, city_id, business_phone,
  office_address, email, pending_email, verification_status}`) with the same loading, Retry, silent re-read on focus and
  visibility, `403` ("Business profile editing is available for agency accounts.") and `401` (sign in again, back to the page)
  handling as the Individual page. The verification status is plain read-only text ("Agency verification: Unverified")
  driven only by the server value (a value that is not a plain lower-case token shows "Unknown").
- `agency-details-form.tsx`: agency name, description (textarea, 1000 characters, a plain-text live count that is not a live
  region), city (select), business phone and office address (textarea, 300 characters, newlines collapse to a space as typed).
  All but the description are required (client check sends nothing). Submit sends `PATCH /api/v1/me/agency-profile` through
  `withCsrf` with only the fields that changed (nothing changed: no request and "No changes to save."; an emptied description
  sends `""`). `200` shows "Your business profile was saved.", refreshes the baseline from the answer for untouched fields
  only and refreshes the session provider (the header agency name). `400` maps the codes through `AGENCY_PROFILE_MESSAGES`
  (`src/lib/registration-messages.ts`) with `mapKnownCodes` (unknown codes, prototype keys and unknown field keys are generic
  text, never the server's); `contains_contact_details` explains that descriptions cannot contain phone numbers, email
  addresses or street addresses and that the phone and address are kept private; `invalid_city` clears the selection and
  re-fetches the cities. 429, 5xx, timeout, network and a second 403 each have a generic message; a 2xx with an unreadable
  body shows a polite "saved, reload to see" note and triggers a re-read.
- **Stored city**: the select is filled from the active cities. If the stored city is not in the list it stays selected as a
  disabled "Current city (no longer available)" option (just "Current city" when the list failed to load), so the other
  edits still save; `city_id` is only sent when the person picks another city.
- **Privacy**: a static note says "Your business phone and office address are private. Only your agency name, description and
  city are shown publicly." The phone and address appear only inside the form inputs: not in the header, the dashboard, storage,
  console output or the address bar.
- **Email**: `EmailChangeForm` is reused unchanged (it already posts `{new_email, current_password}`); the client passes it
  `email` and `pending_email` and re-reads the business profile after an accepted request. The emailed
  `/confirm-email-change` page already works for agencies.
- **Shared code** (the Individual page behaviour and tests are unchanged): `src/lib/use-cities.ts` (the cities loader hook, the
  required-city text and the focus target) and `src/components/city-field.tsx` (the City select with its loading, empty and
  failed states), both now also used by `register/agency`; `src/lib/use-profile-load.tsx` (initial read, quiet re-reads,
  Retry that stays mounted, focus to the heading after Retry, session-gone redirect, and the loading and error states) used by
  both profile clients.
- Playwright stub: `/__agency-profile-mode` (`ok`, `forbidden`, `flaky`, `session_gone`, `malformed`, `inactive_city`,
  `verified`, `odd_status`, `error`, `broken`, `hang`), `/__agency-profile-patch-mode` (`ok`, `fields`, `required`, `contact`,
  `description_codes`, `invalid_city`, `sentences`, `proto`, `empty_ok`, `non_field`, `unknown_code`, `empty_fields`,
  `session_gone`, `forbidden`, `rate_limited`, `csrf_once`, `csrf_always`, `error`, `broken`, `hang`), with
  `/__last-agency-profile` (read count and state) and `/__last-agency-profile-patch` (count, body, CSRF token). The profile is
  stateful (a save shows on the next read and in `/api/v1/me` for the header), and its email and pending address are shared
  with the Individual profile stub so the email-change stubs work unchanged; `/__me-mode?value=agency` selects an agency
  session. Tests: `tests/e2e/agency-profile.spec.ts`.
- **Testing note, the agency-profile flake (Epic 1 retro finding 9)**: the file failed once per full-suite run on a different
  cities test. Reproduction in about two minutes: busy-loop every core (`for i in $(seq $(nproc)); do (yes > /dev/null &); done`),
  run `npx playwright test tests/e2e/agency-profile.spec.ts` (`PW_CHANNEL=chrome` if Chromium is not downloaded), then stop the
  loops with `pgrep -x yes | xargs -r kill`. Root cause: not hydration, not stub state and not a double mount, but a locator
  that was ambiguous only after a delay. `page.getByText("We could not load the list of cities.")` matched the visible
  `#city-status` hint, and 50 ms later (the `announce` timer in `use-form-feedback.ts`) also the sr-only live region, which
  carries the same words. On a fast machine the assertion ran inside that 50 ms window and passed; under load the timer had
  already fired and Playwright raised a strict-mode violation (2 elements). The tests now scope to `#city-status` (as
  `agency-register.spec.ts` already did). Serial mode is removed from this file: the stub is reset in `beforeEach`, there is
  one worker, and a failure no longer skips the remaining tests. When a text is also announced, assert on the element that
  owns it, never on a page-wide `getByText`.
- **Hand-off to Story 1.22**: logo upload is out of scope here (Epic 2) and nothing edits or decides the verification status;
  the page only shows the server's value. Story 1.22 can add verification actions next to that text.

## Admin area (`/admin`, Story 1.23)

The frontend decides nothing about administration: it shows what the backend answers and holds no administration rules.

- **Routes**: `/admin/sign-in` is public (`src/app/admin/sign-in/`); every other admin page lives in the guarded group
  `src/app/admin/(protected)/` (dashboard `page.tsx`, a `[...rest]` catch-all so unknown deep paths hit the same guard
  and an administrator gets a plain 404). `src/app/admin/layout.tsx` only forces dynamic rendering; `next.config.ts` sends
  `Cache-Control: no-store` for `/admin/:path*` (which covers `/admin` and `/admin/sign-in`).
- **Guard** (`requireAdmin()` in `src/lib/current-account.ts`, memoised per render by `checkAdmin`): server side, calls
  `GET /api/v1/admin/me` with the forwarded cookie. `200` is an administrator; `401` (Visitor) and `404` (non-administrator,
  expired or disabled administrator) are one answer and redirect to `/admin/sign-in?next=<requested /admin path>`; any
  other answer or a failure renders "Temporarily unavailable" and no admin content. The protected layout AND every
  protected page call it (layouts are not re-run on client navigation). `requireAccount()` is unchanged for the other pages.
- **`next`**: `safeAdminNext` (`src/lib/next-target.ts`) is `safeNext` plus "normalised path is `/admin` or below, not
  `/admin/sign-in`"; anything else becomes `/admin`.
- **Sign-in page**: same accessibility pattern as `/sign-in` (the form is a copy adapted to the admin door), posting
  `POST /api/v1/admin-session` through `withCsrf` via `useSession().signIn(email, password, "admin")`. One generic message
  for every `401` ("The email or password is not correct."), never any administrator or lockout wording. A Visitor, an
  ordinary account and an expired administrator see the form; an administrator already signed in is redirected to the
  validated target. It is not linked from any public page and links to none.
- **Shell** (`admin-shell.tsx`): own chrome (skip link, "EstateAI Administration", a named "Administration" navigation, an
  "Administrator account" navigation with Change password and Sign out, `main`). Only Dashboard is a link
  (`aria-current="page"`); Listings, Users, Reports and Audit log are inert "Coming soon" items with no routes. The public
  site header hides itself under `/admin` (`site-header.tsx`). Sign out uses the provider `signOut` then a hard
  navigation to `/admin/sign-in`.
- **Session expiry** (`admin-session-watch.tsx`): administrator sessions end after 30 idle minutes or 8 hours (backend).
  The watcher follows the session provider (re-checks on focus, visibility and route change) and, on signed out or a
  non-administrator account, replaces the content with a short message and hard-navigates to
  `/admin/sign-in?next=<current path>`; the server guard does the same on the next guarded navigation.
- **Password change**: `/account/password` works for administrators; the three administrator policy codes have human
  text in `src/lib/password-messages.ts`, the page offers "Back to administration", and a lost session returns to the
  admin sign-in.
- **Server fetch deadline** (`src/lib/api.ts`): the 5 second server-side timeout is an explicit timer that aborts and
  rejects with a `TimeoutError` (cleared when the request settles, combined with the request's own signal), because
  `AbortSignal.timeout` alone was seen to leave a hung backend holding a dev render.
- **Playwright stub**: `/api/v1/admin-session` (POST) and `/api/v1/admin/me` (`401` for a Visitor, `404` for an ordinary
  session, `200` for an administrator session). The live session is ordinary or administrator: `/__force-session?kind=admin`
  starts an administrator one (no `kind` an ordinary one), `/__expire-session` ends either. Modes:
  `/__admin-signin-mode` (`ok`, `wrong_credentials`, `validation`, `rate_limited`, `csrf_once`, `csrf_always`, `error`,
  `broken`, `hang`), `/__admin-me-mode` (`up`, `error`, `broken`, `hang`, `slow`, `denied_401`, `denied_403`, `denied_404`, `rate_limited`; the `denied_*` modes keep `/me` an administrator), `/__change-mode?value=admin_weak`;
  `/__session-stats` adds `adminSignInCount`, `adminMeCount`, `lastAdminSignIn`, `lastAdminSignInToken` and
  `sessionAdmin`. Tests: `tests/e2e/admin.spec.ts` (passphrases are low-entropy fake words on purpose: the secret
  scanner flags random-looking literals).
- **Production check**: `npm run check:prod-admin` (`scripts/check-prod-admin.mjs`) runs `next build`, starts the stub
  backend on port 4110 and `next start` on port 3200, and asserts that a Visitor and an ordinary-account cookie get `307`
  to `/admin/sign-in?next=...` for `/admin` and a deep path, with `Cache-Control: no-store` and no admin markup in the body,
  and that `/admin/sign-in` is `200` with `no-store`. It needs those two extra ports, so it is not part of the default
  test command; run it before releasing changes to the admin area.
- **Guard rule**: every page under `src/app/admin/(protected)` must call `requireAdmin()` itself;
  `tests/e2e/admin-guard-rule.spec.ts` reads the files and fails otherwise.
- **bfcache**: the shell reloads through the guard when a page is restored from the back/forward cache.
- **Admin door answers**: on the admin sign-in form `401`, `403` (after the CSRF retry) and `429` all show the one generic
  message, never any rate-limit or "rejected" wording; `5xx`, timeout and network keep their own messages.
- **Shared password page**: the shell links to `/account/password?from=admin`; with exactly that marker a lost session goes
  to the admin sign-in. An administrator there sees the admin chrome (the public header hides itself for them).
- **Hand-off to later admin screens**: add a route under `src/app/admin/(protected)/`, call `requireAdmin()` in its page,
  and turn the matching placeholder in `admin-shell.tsx` into a link. Show only what the backend allows.

## Notifications (`/account/notifications`, Story 1.24)

Story 1.24 (frontend half). The contract is the backend's `docs/notifications.md`. The frontend only renders what the backend
returns: it decides nothing about who is notified or what is private.

- **Page** (`src/app/(app)/account/notifications/`): signed-in only (`requireAccount`, `no-store` through the `/account/:path*`
  rule), for every account type. A Visitor is redirected to `/sign-in?next=%2Faccount%2Fnotifications`; an administrator sees
  the page inside the admin chrome (like `/account/password`; the public header hides itself for them). `page.tsx` is the
  guard and picks the chrome, `notifications-client.tsx` loads `GET /api/v1/notifications?state=all` on the client with a loading
  state and a Retry that stays mounted (it reuses `useProfileLoad`, with `signInPath` and `refreshOnFocus: false` options: the
  list does not re-read on focus, so load-more state is not thrown away). A `401` flips the session provider to signed out and goes to
  `/sign-in?next=%2Faccount%2Fnotifications` (administrators: `/admin/sign-in?next=%2Fadmin`). The heading is a focus target
  (`tabindex="-1"`); focus moves there after a Retry succeeds, as on the profile pages.
  - Each item is a list item with the catalogue title (`<strong>`, no per-item heading), the detail line, a `<time datetime>`
    in the browser's local format, an "Unread" marker in text (plus a left border) and a "Mark as read" button for unread items.
  - **The loaded list is the authority**: button states come from it, the header count is only a hint. Every edit remembers the
    list it started from and a re-read counter; an answer that arrives after the list was replaced edits nothing and has the
    current filter's first page re-read quietly instead. While a filter reload is in flight mark one, mark all and load more are
    refused (`aria-disabled`, no request); the toolbar and the live region stay mounted so focus is never lost.
  - **Filter**: "All" and "Unread" are `aria-pressed` toggle buttons that reload page one from the server with
    `state=all|unread` (the cursor starts over; a stale answer to an earlier choice is dropped). A failed reload shows the load
    error with Retry and keeps the filter buttons.
  - **Load more**: follows the server's `next` link by its `cursor` parameter, appends without duplicates (by id), moves focus
    to the first new item, shows "Loading more…" while pending, and is hidden when `next` is `null`. A failure keeps the list and
    shows the generic failure message (`failureMessage`, 429 with the wait); the button stays as the retry. An answer that
    brings only known items says "No more notifications to show." and ends the list unless the cursor advanced.
  - **Parsing**: a malformed item is skipped, not the page; a non-empty `next` without a usable `cursor` is a load error with
    Retry; a catalogue entry that resolves to an empty title falls back to the unknown-kind line. List load: `429` shows the
    wait, `403` shows "Notifications are not available for this account." with no Retry, anything else keeps Retry.
  - **Mark one read**: `POST /api/v1/notifications/{id}/read` through `withCsrf` (a first 403 refetches the token and retries once;
    a second is the generic "could not be submitted" message). `200`: the item is read in place (removed under the Unread
    filter; if that empties the list while `next` is set, up to 5 further pages are read, then the empty state shows), focus goes
    to the item (or, once removed, to the next one, the previous one, or the heading) and the header count is re-read. `404`
    (already gone): the item is removed quietly and the count re-read. If the item is no longer listed only the count is
    refreshed. Other failures (429 with the wait, 5xx, timeout, network) show one polite message and the item stays unread.
    Requests per item are de-duplicated (double click).
  - **Mark all read**: enabled when the loaded list has an unread item or the header count is above zero; clicking it while
    disabled announces "No unread notifications." and sends nothing. `POST /api/v1/notifications/read-all` through `withCsrf`;
    then every loaded item is marked read in place (under Unread the list is cleared and `next` dropped), the loaded pages stay
    and page one is not re-read; announces "N notifications marked as read." (a missing numeric `marked` gives "Notifications
    marked as read."). One request at a time.
  - **Focus and tab return**: no focus is taken on first load. Back on the tab (focus, `visibilitychange`, at most one per 5
    seconds) the first page of the current filter is re-read quietly, only when no extra pages are loaded and nothing is pending.
  - **Empty**: "You have no notifications." (Unread filter: "You have no unread notifications.").
  - **One live region** (`role="status"`, via `useFormFeedback`, which clears before it sets so an identical message announces
    again) announces results and failures once; failures use the error colour and no `role="alert"`.
- **Kind catalogue** (`src/lib/notification-kinds.ts`): the one place a backend `kind` becomes text. `KINDS` maps a kind to
  `{ title, text }`, each a string or a function of the payload for kinds that carry payload keys. Shipped:
  `account.password_changed` and `account.email_changed`. An unregistered kind renders "You have a notification." with no
  payload at all; payload values are never rendered for unknown kinds, and known kinds read only the keys their entry names
  (through `field`), as plain text (React escapes it; there is no raw HTML anywhere). **How a later epic adds a kind**: register the
  kind and its payload schema in the backend, then add one entry to `KINDS` here (and a Playwright case if it has payload keys);
  nothing else changes.
- **Header link and unread count**: `NotificationsLink` (`src/components/notifications-link.tsx`) is shown for every signed-in
  account in the site header and in the admin chrome ("Administrator account" navigation). With unread items the count is
  visible text and the accessible name is "Notifications, 3 unread" ("99+" above 99); at zero or unknown it is just
  "Notifications". `UnreadCountProvider` / `useUnreadCount()` (`src/lib/use-unread-count.tsx`, mounted in the root layout inside the
  `SessionProvider`) reads `GET /api/v1/notifications/unread-count` once when the session becomes signed in, quietly on window
  focus and `visibilitychange`, and after the page marks something read (`refresh()`); it clears when signed out and never
  asks for a Visitor. There is no polling timer. The count is held per account id (an account switch without a signed-out step
  drops it and reads again); focus and visibility events are coalesced (one request in flight, at most one per 5 seconds);
  a `403` or `429` stops reading until the next sign-in; a `401` asks the session provider to check; if the first read after
  sign-in fails it is retried once after 2 seconds. A failure keeps the last known count and shows nothing (the count is a
  hint, the page is the truth); the count never blocks rendering. The link has `aria-current="page"` on the page.
- **Privacy**: no notification content, id or count goes to storage, the console, the URL or the document title (the title is
  fixed); the page and count calls are `no-store`. New Messages are not notifications (Epic 7 has its own indicator) and there is no
  email alert UI.
- **Playwright stub**: `GET /api/v1/notifications` (newest first, 20 per page, `page_size`, `state`, `cursor` as `pos-<n>`, absolute
  `next` links), `GET /api/v1/notifications/unread-count`, `POST /api/v1/notifications/{id}/read` and `POST .../read-all`. It is
  stateful and seeded with 25 notifications of both known kinds and an unregistered kind (whose payload holds a canary text
  that must never render; ids are repetitive digit patterns). Modes: `/__notifications-mode` (`ok`, `flaky`, `more_fail`, `dup`,
  `malformed`, `session_gone`, `error`, `broken`, `hang`), `/__notification-read-mode` (`ok`, `gone`, `session_gone`, `forbidden`,
  `rate_limited`, `csrf_once`, `csrf_always`, `error`, `broken`, `hang`), `/__notification-readall-mode` (the same without `gone`),
  `/__unread-count-mode` (`ok`, `error`, `broken`, `hang`, `forbidden`, `rate_limited`). `/__notifications-mode` also has
  `more_gone`, `small_pages`, `rate_limited`, `forbidden`, `known_only`, `partial` and `bad_next`. Helpers: `/__notifications-cacheable`
  (answers list and count as cacheable, to prove the client never reuses a cache), `/__account-variant` (changes the account id), `/__notifications-preset?value=` (`default`, `few`,
  `one_unread`, `empty`, `all_read`, `many_unread`, `unread_pages`), `/__notifications-read-elsewhere?n=`,
  `/__notifications-add?kind=` and `/__notifications-stats`. Tests: `tests/e2e/notifications.spec.ts` (axe at desktop and mobile on the
  list, filter, load more, empty, error and admin states; low-entropy fake values only, the secret scanner flags random-looking
  literals).
- **Tech debt**: the list reuses `useProfileLoad` (with `signInPath`, `refreshOnFocus` and an error `message` option) although it
  mirrors list state around it (`list`, `listRef`, `filterRef`, epoch counter). A dedicated list hook would remove that; it is
  deferred. Scroll anchoring after load more and auto-polling are also deliberately not done.
- **Hand-off at the end of Epic 1**: features that raise notifications add their catalogue entry here and nothing else; the
  account-removal and retention rules are the backend's. If a later epic wants a richer link per kind, extend `KindEntry` (for
  example an optional `href`) in `notification-kinds.ts`; the list component already renders only what the catalogue returns.

## Listings: create, My listings and the Draft page (Story 2.1)

Frontend half of Story 2.1. The contract is the backend's `docs/listings.md` and `docs/registry.md`; the client was synced with
`npm run api:sync`. Only the manual path exists (the AI-assisted path arrives in Epic 5); a note on the create page says so.

- **Routes** (`src/app/(app)/account/listings/`, all behind the server guard and `Cache-Control: no-store` through the existing
  `/account/:path*` rule): `/account/listings` ("My listings", `listings-client.tsx`), `/account/listings/new` ("Create listing",
  `new/create-listing-form.tsx`) and `/account/listings/[id]` (the Draft page, `[id]/draft-client.tsx`; the dynamic `params` are a
  promise in this version of Next.js and are awaited in the page). The header and the dashboard link to "My listings" for individual
  and agency accounts only (`canOwnListings` in `src/lib/account.ts`). An administrator who opens a route directly sees "Listings
  are available for individual and agency accounts." and no form (the list page shows the server's `403`; the create page is not
  given a form for an administrator; the Draft page answers like any other 404).
- **Registry hook** (`src/lib/use-registry.tsx`): `useRegistry()` reads `GET /api/v1/registry` once per page load (the browser
  revalidates it by the server's ETag) and answers `{status: "loading" | "ready" | "error", registry, retry, retrying}`.
  `registry` has `purposes`, `categories`, `subtypesOf(category)` and `version`. The shape is validated defensively
  (`readRegistry`): anything malformed, or no usable purpose or Category, is an error with a Retry that stays mounted, never a crash.
  Ids that are not simple tokens (lowercase letters, digits, underscore) and Categories without a Subtype are skipped, so an id
  can never break an element id. A `401` ends the session like on the other pages, and `refetch()` revalidates the registry
  (used once after the server refused a choice, since a stale registry is the likely cause; the user's other valid choices stay). The
  frontend owns no taxonomy: purposes, Categories and Subtypes are rendered only from this answer.
- **Labels** (`src/lib/listing-labels.ts`): the registry carries ids only, so `label(id)` turns `plot_file` into "Plot file" (a
  missing or unknown value is "Not set"); `summaryOf(fields)` builds "Sale · House · House"; `readListing` reads a Listing from a
  response defensively. Error texts are in `src/lib/listing-messages.ts`.
- **Create listing**: Purpose (radio group), Category and Subtype (selects; the Subtype is disabled until a Category is chosen,
  lists only that Category's Subtypes and is cleared when the Category changes to one that does not contain it). Only "required" is
  checked on the client (nothing is sent when a choice is missing). It posts exactly `{purpose, category, subtype}` through
  `withCsrf` and opens the new Draft page on `201`. `400` codes (`required`, `invalid`, `invalid_choice`,
  `subtype_not_in_category`) map to text in the focused error summary and the values are kept; unknown codes and sentences are
  generic. a `403` shows "Your account cannot create listings right now." only when the session says the account is suspended
  (the real backend answers a CSRF rejection and a suspended account alike with `forbidden`); any other persistent `403` (after the
  one CSRF retry) is the generic rejected-request message.
  A `429` with code `throttled` and no `Retry-After` shows the open-drafts limit message with a link to My listings (the number is
  not repeated in the copy); otherwise the usual wait text; `401` signs out and goes to the
  sign-in with `next`; 5xx, timeout and network failures have their own messages and keep the form. After a `201` the form never submits again
  (Create stays `aria-disabled` and reads "Draft created"); if the Draft page has not opened after about 8 seconds, or the id
  cannot be read, a notice points to My listings instead of freezing. A page restored from the back-forward cache re-checks the
  session (`src/lib/use-pageshow-recheck.ts`) and resets a frozen form. Controls use `aria-disabled` (not `disabled`) so focus is
  kept; the Subtype stays reachable with a "Choose a category first." hint; field errors clear when the field is edited.
- **My listings**: the first page of `GET /api/v1/me/listings` (newest first, as the server orders it), a summary line and a
  "Draft" marker per item linking to its page, "Load more" with the server cursor (appended, deduplicated by id, hidden at the
  end, a failed load more keeps the list and says so), an empty state with a Create listing link, a Retry that stays mounted and a
  `401` redirect (to the admin sign-in for an administrator). It reuses the shared loader (`useResourceLoad`, an alias of
  `useProfileLoad`, with `refreshOnFocus: false`, so nothing polls or refreshes on focus). The empty state shows only when there
  is no item and no `next`; items are deduplicated within a page and across pages; a load more that only repeats known items but
  moves the cursor on is followed (a few pages at most); a `403` for an owner type reads "Listings are not available for this
  account right now." (the type-based wording is for administrators).
- **Draft page**: `GET /api/v1/listings/{id}` shown as a summary (status, revision, registry version, the three fields and the
  asking price, a link back) above the editor of Story 2.2 (next section). A `404` (and `400`, `403`, `422`) is one answer for an unknown, someone else's or malformed id and
  for an administrator: "We could not find that listing." An id that is not a canonical UUID gets the same copy without a request.
  A `429` shows the wait with Retry.
- **Privacy**: no listing or registry data goes to storage, the console, the page title or a URL beyond the Draft id in its path.
- **Playwright stub** (`tests/e2e/stub-backend.mjs`): `GET /api/v1/registry` (the real taxonomy, strong ETag, `304` on
  `If-None-Match`; `/__registry-mode`: `ok`, `flaky`, `flaky_slow`, `gone`, `odd_ids`, `error`, `broken`, `hang`, `malformed`, `empty_choices`, `bad_subtypes`;
  `/__registry-taxonomy?value=other|shared` serves another taxonomy (`shared`: one Subtype id in two Categories)), `POST /api/v1/listings` (`/__listing-create-mode`: `ok`, `required`,
  `fields`, `subtype_mismatch`, `sentences`, `non_field`, `no_id`, `forbidden`, `session_gone`, `rate_limited`, `rate_none`,
  `csrf_once`, `csrf_always`, `error`, `broken`, `hang`; it validates against the current taxonomy and enforces the 20-draft cap),
  `GET /api/v1/listings/{id}` (`/__listing-detail-mode`: `ok`, `flaky`, `malformed`, `session_gone`, `error`, `broken`, `hang`;
  `404` for unknown, malformed, other accounts' and administrators) and `GET /api/v1/me/listings` (`/__listings-mode`: `ok`,
  `flaky`, `flaky_slow`, `inpage_dup`, `repeat_cursor`, `known_advance`, `bad_first`, `forbidden`, `more_forbidden`, `more_rate_limited`, `more_fail`, `more_gone`, `small_pages`, `dup`, `bad_next`, `malformed`, `partial`, `rate_limited`, `session_gone`,
  `error`, `broken`, `hang`; 20 per page with `next` cursors; `403` for administrators). It is stateful: created Drafts appear in
  the list and the detail. `/__listings-preset?value=` (`empty`, `few`, `many`, `capped`, `unknown`, `foreign`, plus `titled`, `rent`, `rent_filled` for Story 2.2) and
  `/__listings-stats`. Tests: `tests/e2e/listings.spec.ts` (every row of the story's matrix; axe at desktop and mobile on the form,
  its errors, the registry error, the list, the Draft page, the empty, error and administrator states).
- **Deviations**: the Listing wire shape has no timestamp, so the list shows no created time (the order is the server's, newest
  first); created time arrives with Story 2.13 (draft management).
- **Caching**: `npm run check:prod-listings` (`scripts/check-prod-listings.mjs`) builds the app and proves a Visitor gets `307`
  and the signed-in pages `no-store` for `/account/listings`, `/account/listings/new` and `/account/listings/<uuid>`. The dev-mode
  Playwright test reads the same config, so it cannot fail on it alone.
- **Tech debt**: the list (like the notification list) mirrors list state around `useProfileLoad`; a dedicated list hook would
  serve both and is deferred.
- **Hand-off to Story 2.2**: the Draft page is read-only on purpose. Editing adds forms that send `{base_revision, fields}` and
  handle `409` with the current Listing; field labels and the field list will come from the registry's `fields` (the hook already
  carries the full answer's version; extend `readRegistry` rather than adding a second fetch). Labels are derived from ids until the
  registry carries display text.

## Editing a Draft: conflict-safe saving (Story 2.2)

Frontend half of Story 2.2. The contract is the backend's `docs/listings.md` (the PATCH, the `409` body with `current`) and
`docs/registry.md`; the client was synced with `npm run api:sync`.

- **Where**: the Draft page (`/account/listings/[id]`). `[id]/draft-client.tsx` loads the Draft and keeps the not-found, 401 and
  bfcache handling of Story 2.1; `[id]/draft-editor.tsx` is the summary plus the form.
- **Built from the registry** (`useRegistry`, now also exposing the field definitions: id, type, requirement, `min_length`,
  `max_length`, money `min`/`max`/currency, `allowed_values`, `allowed_values_by_purpose` and applicability): the controls are
  Title, Description, Asking price (a PKR prefix label, `inputmode="decimal"`), Price basis and, only when the registry says the
  field applies to the purpose (rent), Rental period. Hints ("Required before you publish", "Recommended", the character limits,
  the price bounds) and the choices (price basis by purpose, rental period values) come from the definitions; a field the registry
  does not define (or defines with another type) gets no control. Later stories add a field by registry entry plus a small mapping in
  `draft-editor.tsx`. Title and Description have a plain-text counter (code points after whitespace collapse, never a live region, an
  over-limit hint) and no `maxlength`, so a paste is never truncated.
- **Saving** is explicit ("Save changes", no autosave). `PATCH /api/v1/listings/{id}` through `withCsrf` with exactly
  `{base_revision, fields}`: `base_revision` is the revision last loaded and `fields` holds only the fields that changed (an emptied
  field is `null`; no origin, confirmed or status is ever sent). Nothing changed sends nothing and says "No changes to save." The price
  is sent as the text typed (trimmed) and is never converted to a number: it is shown formatted from the server's string by string
  work only (`formatPrice`, `priceKey` in `src/lib/listing-labels.ts`; "1500000" and "1500000.00" are the same amount when deciding
  whether something changed). Commas and currency signs are not valid in the price (the server answers `invalid`); the message says
  digits only with an optional decimal point, and the bounds hint prints the plain digits so it does not invite commas. Text fields are
  compared as the server normalises them (NFC, collapsed whitespace, trimmed), so a value the server would collapse is not a difference. On `200` the answer becomes the new baseline (a field typed while the save ran keeps what was typed),
  "Saved" is announced, focus stays on the button. The button is `aria-disabled` while saving and a double click sends one request.
- **Validation (400)**: the field codes (`required`, `invalid`, `too_short`, `too_long`, `invalid_price`, `contains_contact_details`,
  `not_applicable`, `invalid_choice`, `not_editable`) map to text under the right control with the error summary focused and every
  typed value kept; unknown codes, sentences, prototype keys and unknown field keys are generic, never the server's text; an error on a
  field with no control on this form goes to the list without a link; an error clears when its field is edited.
- **Conflict (409 `stale_revision`)**: nothing is overwritten. The `current` Draft becomes the loaded data and the baseline (the revision
  shown is the new one); what the owner typed stays exactly as typed; a field the owner had not changed simply shows the latest value
  (it was never the owner's input, and keeping it stale would silently undo the other session). A banner (the one live region, it takes
  focus; it goes away, with "Your choices are applied. Save to keep them." announced, once every row is resolved) says "This draft was changed in another session...". Each field where the owner's value differs from the latest gets "Latest
  saved: ..." (price formatted) with "Keep mine" and "Use latest"; the next save sends the new `base_revision` and only the fields that
  differ from the latest data. A second `409` repeats the flow. A `409` without a usable `current` reads the Draft again through GET and
  keeps the input. A retry after a lost response is a `409` whose `current` already holds the typed values: the banner reads "Your
  changes are already saved." only when nothing else changed on the server either (otherwise the normal banner). A `409` whose
  `current` is not this Draft or has no newer integer revision is unusable (GET fallback); a `200` for another Draft or without a
  revision is a server error.
- **Other answers**: `404` shows the Draft not-found copy; `403` says "Your account cannot edit listings right now." only when the
  session says the account is suspended (the real backend answers a CSRF failure with the same `forbidden` code, so every other persistent
  403 is the generic message after the one CSRF retry); `401` signs out and goes to sign-in with `next`; 429, 5xx, timeout and network
  failures show their own generic message with the input kept and Save still available.
- **Unsaved changes**: a `beforeunload` guard while the form differs from the saved Draft (removed after a save). Leaving through an
  in-app link is not intercepted. Nothing typed is stored anywhere; a page restored from the back-forward cache checks the session and
  starts the editor again from the server's data.
- **Playwright stub**: `PATCH /api/v1/listings/{id}` with the real rules (shape errors first, then the stale check, then value
  rules, a change bumps the revision and moves the registry version to 2, a no-op keeps the revision; the price pattern is the real
  one, so commas are `invalid`). Registry version 2 serves the five field definitions
  (`/__registry-fields?value=default|other|none`: `other` has different limits and values). `/__listing-patch-mode`: `ok`, `slow`,
  `codes`, `hidden`, `unknown`, `non_field`, `not_editable`, `empty_fields`, `conflict_no_current`, `conflict_bad_current`, `lost_once`
  (the change lands, the answer is lost), `unreadable`, `not_found`, `forbidden`, `session_gone`, `rate_limited`, `rate_none`,
  `csrf_once`, `csrf_always`, `error`, `broken`, `hang`. `/__other-session?id=<uuid>&title=...&description=...&asking_price=...&price_basis=...&rental_period=...`
  simulates another session (changes the fields and bumps the revision); `/__listing-patch-stats` returns the count, bodies and CSRF
  tokens. Tests: `tests/e2e/listing-edit.spec.ts` (every row of the story's matrix; axe at desktop and mobile on the editor, over the
  limit, errors, conflict, saved and failure states).

## Area and units (Story 2.3)

Frontend half of Story 2.3, on the Story 2.2 editor (same form, one Save, same revision, `409` and typed-input rules). The contract is
the backend's `docs/listings.md` ("Area and units") and `docs/registry.md` (version 3); the client was synced with `npm run api:sync`.

- **The Area block** (`[id]/draft-editor.tsx`, after the price fields, a group titled "Area"): Area value (a text input,
  `inputmode="decimal"`, digits and an optional decimal point; the text typed is sent trimmed and is never a JS number), Unit (a select
  from the registry: Square feet, Square yards, Marla, Kanal, Acre) and Marla basis (a select shown only while the form's unit is marla or
  kanal, with the first option "I don't know yet", meaning `null`, then "225 sq ft", "250 sq ft", "272.25 sq ft"). Its hint is the
  explanation that a marla differs between places and what an unknown size means for filtering and estimates. The value hint, the unit
  list and the basis list come from the registry definitions (`scale`, `min`, `max`, `allowed_values`; `derived` is honoured, a derived field gets no control; `description` is read but not shown, the explanation text is fixed), so
  a stub registry with other bounds or options changes the form. The enum values of a registry may now be numbers written as text
  (`"272.25"`); they stay text.
- **Derived square feet** are read-only, below the block, from the saved Draft: "About 2,722.50 sq ft" when the server's `area_sqft` is not
  null (grouped and padded to two decimals by string work in `formatSqft`; the server's own digits are kept), "Not available until the
  marla size is known" for a saved marla or kanal with a value and no basis, nothing otherwise. It is never computed in the browser, never
  sent, and it is the saved figure (it changes after a save). The Draft summary has an "Area" row ("10 Marla, 272.25 sq ft per marla").
- **Sending**: only changed fields. Area text is compared by amount (`areaKey`: "10" and "10.0000" are the same, commas are not stripped
  so "1,000" is a different text and the server refuses it). When the unit moves away from marla or kanal the basis control disappears, what
  was typed for it is dropped (back to the saved value) and it is not sent; the server clears the stored basis and the answer shows `null`.
  Moving between marla and kanal keeps the basis. A stored basis the registry no longer offers stays selected. Only text in the real shape is compared by amount (no leading zeros, decimals within the registry scale, at least four); padded or comma text is sent so the server refuses it, never taken for "no change".
- **Errors**: `invalid` and `invalid_area` on the value, `invalid_choice` on the unit and the basis, `not_applicable` on the basis (when
  its control is hidden the text goes to the form-level list, no link), `not_editable` and unknown codes as before. Conflict rows
  (Keep mine / Use latest) cover the three fields with formatted latest values ("2,500.5", "Kanal", "225 sq ft"); the basis row follows the
  unit the form will have. "Already saved" is unchanged. A row counts as open only while its control is shown: "Use latest" on a unit that needs no basis resets the typed basis to the latest one and drops its row, so the banner clears. If another session moved the unit away while the owner only edited the basis, the typed basis is reset and the banner adds that the marla size no longer applies. While area input is unsaved the derived line adds "(saved figure, updates after you save)".
- **Playwright stub**: registry version 3 serves `area_value`, `area_unit`, `marla_basis` and the derived `area_sqft` (`scale`, `derived`,
  `description` keys; `other` has other bounds, units and basis choices). PATCH validates like the real service: text only, the real
  pattern (no commas or padding), `invalid` / `invalid_area`, bounds and scale from the registry, enum choices, `not_applicable` on a basis
  for another unit, the basis cleared when the unit moves away, `area_sqft` rejected as `not_editable` and recomputed with BigInt math (sqft 1,
  sqyd 9, acre 43,560, marla = basis, kanal = 20 x basis, half up to four decimals). New patch modes `area_codes` and `area_hidden`; presets
  `area_marla`, `area_unknown`, `area_sqft`; `/__other-session` also takes `area_value`, `area_unit`, `marla_basis` (the derived figure and
  the cleared basis follow). The stub's listing registry version is now 3. Tests are in `tests/e2e/listing-edit.spec.ts` (one or more
  per row of the story's matrix, axe at desktop and mobile on the Area states).

## Details: House and Apartment (Story 2.4)

Frontend half of Story 2.4, on the same editor (one Save, changed fields only, the same revision, `409` and typed-input rules). The contract is
the backend's `docs/listings.md` and `docs/registry.md` (version 4: the new types `integer` and `boolean`, 30 residential fields with
applicability by Subtype; integer bounds are served as text, "0" and "50").

- **A generic registry-driven section**: `[id]/details-section.tsx` renders every registry field that applies to the Draft's purpose,
  Category and Subtype and is not hand-built (not title, description, the price fields, the area fields or identity, never a derived field),
  in registry order, grouped by requirement in fieldsets with legends: "Required before you publish", "Recommended", "More details" (an
  empty group is not shown; a Plot has no applicable detail, so no section). The pure rules live in `src/lib/listing-details.ts`: the label
  map (`DETAIL_LABELS` by registry id, fallback the humanised id), the hint from the registry (its description, then "Whole number from 0 to 50.",
  the decimal and money limits; the requirement is the group's, not repeated), the comparison, the value sent and the "Latest saved" text.
  **Adding a registry field (Stories 2.5 and 2.6) needs only a label entry (and not even that: without one its label is the humanised id)**; its
  control, hint, group, saving, errors and conflict row follow from the definition. A type the section has no control for (text, an unknown
  type) gets none. The id is the control's element id and the `data-testid` of its conflict row (`conflict-<id>`); the Draft summary lists
  the answered details (`draft-detail-<id>`) and nothing unanswered.
- **Controls by type**: `integer` a text input with `inputmode="numeric"`; `boolean` a select "Not answered / Yes / No" (null, true,
  false); `enum` a select with "Not answered" first, then the registry's choices (a stored value it no longer offers stays shown);
  `decimal` and `money` text inputs with the 2.2 and 2.3 string rules (the money control has the currency prefix). Unknown is only ever
  "Not answered"; zero and No are answers and are shown as such. A control never starts as 0 or false.
- **Sending**: an untouched field is never sent. Comparison is normalised (integers trimmed, decimals by amount with the registry's scale,
  money by amount, choices exactly). Emptied or "Not answered" is `null`. An integer is sent as a JSON integer only when its trimmed text
  matches `^(0|[1-9]\d{0,8})$` (ASCII digits, no leading zero, up to nine so `Number` is exact); the server then judges the range
  ("99999" is `invalid_range`). Any other text ("007", "05", "-1", "1.5", "5.0", "1e2", "abc") is sent as typed for the server to refuse as
  `invalid`, and `Number()` never sees arbitrary text. Money text is compared at the registry's scale (padding), and text with a leading zero
  is a change that is sent, never silently "no change". Yes and No are `true` and `false`. Decimals and money stay text.
- **Errors**: `invalid`, `invalid_range`, `invalid_floor`, `invalid_area`, `invalid_price`, `invalid_choice`, `not_applicable` and
  `not_editable` have texts by registry type (`DETAIL_MESSAGES` in `listing-messages.ts`); an unknown code or a sentence is the generic text.
  `invalid_floor` can arrive under a field the owner did not edit (the other floor field): it shows under that control, with a link in the
  summary. A problem between fields (`CROSS_FIELD_GROUPS`: `invalid_floor` belongs to both floor fields) is cleared when one of its fields is
  edited or takes "Use latest". An answer to a save is judged against what was submitted: a field retyped while the save was in flight
  loses its error (and so does a group it belongs to), so no text points at a value the server never saw. The range, decimal and money
  messages do not claim limits "shown above" (a registry may state one bound or none; the hint then says "At least 1."). A code for a detail with no control goes to the form-level list, with no link.
  A conflict banner now also clears when the last open row is hidden by typing the latest value by hand. When another session makes a
  detail the owner changed inapplicable, the typed value is reset to the latest and the banner adds "Some details no longer apply".
- **Values the form cannot show as numbers** (a float or unsafe integer, a decimal or money sent as a JSON number) keep their text in the control
  and the summary (`String(value)`); saving them unchanged sends nothing. A yes/no that is neither true nor false and an enum value the
  registry no longer offers stay selectable (marked "(stored value)" / "(no longer offered)") for as long as they are the saved value, so
  they can be restored. A key such as `__proto__` is ignored.
- **Conflicts** cover every detail with formatted latest values: a number as is, "Yes" / "No", the choice's label, a decimal grouped without
  trailing zeros ("3,000.1"), money as "PKR 3,000.00", "Not answered" for an answer cleared elsewhere. Typed input, bfcache, the privacy
  rules (nothing in storage, console, title or address bar) and `aria-disabled` saving are the Story 2.2 behaviour.
- **Playwright stub**: registry version 4 serves the 30 fields as the backend defines them; `other` has other limits, requirements and
  choices for a few, and `extra` adds fields no label knows plus a text and an unknown-type field (a registry-driven test). PATCH
  validates like the real service: integers only as JSON integers (strings, floats and booleans are `invalid`), booleans only as booleans,
  bounds and choices from the registry, decimal and money text rules, `not_applicable` by Subtype, null a harmless no-op, the floor rule on
  the resulting state (the code on the floor, and on the building when it was sent). New patch modes `detail_codes`, `detail_floor`,
  `detail_hidden`, `detail_unknown`, `detail_not_editable`, `detail_not_applicable`, `detail_codes_slow` (a held 400); presets `house_blank`, `apartment_blank`, `house_details`, `apartment_details`, `house_zero`,
  `plot_blank`, `house_odd` (values the form cannot represent); `/__other-session` also takes the detail ids (integers and booleans keep their wire type). The stub's listing registry
  version is now 4. Tests are in `tests/e2e/listing-edit.spec.ts` ("details" tests, one or more per row of the story's matrix, axe at
  desktop and mobile on the Details states).

## Details: Plot and Commercial, and seller-declared labels (Story 2.5)

Frontend half of Story 2.5 on the same generic Details section: registry version 5 (served payload gains `seller_declared` and
`allowed_values_by_subtype` on every field; plot and commercial fields; `invalid_measure`). The contract is the backend's `docs/listings.md` and
`docs/registry.md`. Adding the fields needed labels only.

- **Labels**: `DETAIL_LABELS` has the new ids (feet fields end with "(feet)", power load "(kW)"); `CATEGORY_LABELS` gives the commercial Category
  "Furnishing or fit-out" for `furnishing`, keyed by Category (`CATEGORY_LABELS`, so a new commercial Subtype inherits it); `CHOICE_LABELS` in `listing-labels.ts` has the readable options (approval authorities such as "Lahore
  Development Authority (LDA)", orientation, balloting, possession). Anything without an entry is the humanised id.
- **Enum options** (`FieldDef.valuesFor(purpose, subtype)`): fail closed. When the payload has an `allowed_values_by_subtype` map (even an empty
  or malformed one) the options are the Subtype's list, intersected with the purpose's list when a by-purpose map is present (a Subtype with no
  entry, or a purpose that map does not list, offers nothing). Only an absent key (the server serves `null`) falls back to the purpose's list, else
  `allowed_values`. A stored value not offered stays visible, marked "(no longer offered)" in the list and the summary, and the field hint adds
  "The saved value is not offered for this type of property." A Plot File is therefore offered only `file_only` for possession, and the form never pre-selects it.
- **Seller-declared**: a field with registry `seller_declared: true` shows a "Seller-declared" tag beside its label (`<id>-seller-declared`) and the
  helper line "You are stating this. EstateAI has not checked it." (`<id>-declared`), both in the control's `aria-describedby`; the Draft summary
  adds the same tag to those details (`draft-detail-<id>-seller-declared`). There is no platform badge, check icon or verification wording
  anywhere (a test scans the page, labels and generated content for them). The "Latest saved" line of a conflict says "(seller-declared)", the
  summary tag is separated from the value for screen readers, and a hand-built field a registry flags gets the same tag and helper. A payload
  without the `seller_declared` key means no flag, so no label.
- **Decimals**: feet and kW are strict text at the registry scale (compared by amount with at most `scale` decimals, so "35.0" is "35.00" and
  "35.001" is sent for the server to refuse; no commas, never `Number`). `invalid_measure` has its own text. Display rule (the payload carries no error code or marker): every decimal shows its value grouped and padded to
  its registry scale ("1,200.50") except `area_value` and `covered_area_sqft` (`TRIMMED_DECIMALS`), which keep the trimmed form. A saved value
  with more decimals than the scale ("10.5000") is compared at the larger of the two, so typing "10.5" is no change. Floors, integers, money and conflict
  rows behave as in Story 2.4 for Shops and Offices too (the floor rule links the two floor fields).
- **Playwright stub**: registry version 5 (ETag `<version>-<hash>-<shape>`, the real descriptions, every new id null when unanswered) with all 25 plot, commercial and utility fields, the widened applicability, the by-subtype map for
  `possession_status` and the `seller_declared` flags exactly as the backend serves them; PATCH mirrors the backend (Plot File versus
  possession values, applicability, measure shapes, scales and ranges with `invalid_measure`, the floor rule for shops and offices, null a no-op).
  Presets `plot_blank`, `plot_file_blank`, `shop_blank`, `office_blank`, `plot_details`, `plot_file_details`, `shop_details`, `office_details`;
  registry variant `plotmap` (another by-subtype and by-purpose map, other seller-declared flags); patch modes `plot_codes` and `commercial_codes`.
  Tests are in `tests/e2e/listing-edit.spec.ts` (plot, plot file, shop, office, seller-declared, by-subtype options, errors, conflicts, registry-driven,
  privacy, axe at desktop and mobile).

## Sale and rent terms and the date control (Story 2.6)

Frontend half of Story 2.6 on the same generic Details section: registry version 6 (shape 5: every field serves `section`, `terms` or
`details`; the new `date` type serves its bounds as ISO text in `min` and `max`; 13 terms fields plus the existing `rental_period` are
`section: terms`; the new error code `invalid_date`). The contract is the backend's `docs/listings.md` and `docs/registry.md`. Where the
story spec grouped terms by applicability, the registry's explicit `section` marker replaces it: the client never guesses from applicability.

- **Terms fieldset** (`details-section.tsx`, `splitTerms` and `termsTitle` in `listing-details.ts`): the applicable fields with
  `section: terms` that the editor does not build by hand go in a fieldset "Terms for sale" / "Terms for rent" (plain "Terms" for a
  purpose the client does not know), grouped by requirement inside it (`terms-required`, `terms-recommended`, `terms-more`, each a
  `fieldset.terms-group` with a legend), after the Area and before the Details block. `rental_period`, the price and the price basis stay
  hand-built where they were. The marker defaults to `details` when missing or unknown (an older payload shows every detail in Details, no Terms
  fieldset). A sale never shows rent terms and a rent never shows `possession_availability` (applicability); the deferred terms (payment
  type, installments, title documents) are not in the registry, so they never appear.
- **Date control**: a native `<input type="date">` whose value is the ISO text; `min` and `max` are the registry's date bounds as plain text.
  There is no `Date` anywhere (no parsing, no time zone, no conversion): comparison is string equality of the trimmed text, "Latest saved"
  shows the ISO text, and the value sent is the trimmed text as it is, so the server judges it (`invalid` for a shape that is not a real date,
  `invalid_date` for a real date outside the window). `isIsoDate` (digit arithmetic, leap years included, in `listing-labels.ts`) decides the
  input type from the SAVED value only, never from what is being typed, so the type never changes under the person's fingers: a saved
  value that is not a real date (no real server holds one) stays a text input (placeholder "YYYY-MM-DD") until it is saved. A browser without
  date support shows text and sends it as typed. **A partly typed date** (the browser reports `value ""` with `validity.badInput`) is not a
  clear: Save is blocked with the error summary ("Finish the date or clear it.", `aria-invalid`), nothing is sent, and the flag goes when the
  date is finished or emptied. Registry date bounds fail closed: each must be a real calendar date and the start not after the end, else
  both are dropped (no `min`/`max` attributes, no "Between" clause); bounds of other types stay decimal text.
- **Summary and heading**: the Terms fieldset's legend holds an h3 ("Terms for sale"), like "Details"; the Draft summary lists answered terms
  before answered details, as the form does.
- **Labels**: "Price negotiable", "Possession availability", "Security deposit (PKR)", "Available from", "Advance rent (PKR)", "Minimum lease
  (months)", "Notice period (days)", "Electricity included" (and gas, water, internet), "Pets allowed", "Occupant restrictions"; readable
  options for possession availability and occupant restrictions (`CHOICE_LABELS`). `possession_availability` is seller-declared exactly like
  the plot claims (tag, helper line, summary tag, "(seller-declared)" in its conflict row, no platform badge).
- **Errors**: `DETAIL_MESSAGES.date` has `invalid` and the new `invalid_date`. The money wording is neutral (a security deposit and an advance
  rent accept `0`): "Enter an amount within the allowed range, with at most two decimal places."; the asking price's text no longer says
  "above zero" either ("within the limits shown above", its own limit line says 0.01).
- **Summary and conflicts**: answered terms are listed in the Draft summary (No and 0 are shown; unanswered is absent); conflict rows,
  Use latest / Keep mine, the cleared banner, linked errors, typed-input and privacy rules are the Story 2.2 to 2.5 behaviour.
- **Playwright stub**: registry version 6, shape 5 (ETag `6-<hash>-5`), all 13 terms fields with the real descriptions and `section`
  flags, the `date` type with ISO bounds; PATCH mirrors the backend (date shape `invalid` versus window `invalid_date` compared as text, money
  zero allowed for the deposit and the advance, integer ranges, booleans, enums, applicability by purpose, null a no-op before applicability,
  deferred ids `unknown_field`). Presets `sale_terms`, `sale_terms_blank`, `rent_terms`, `rent_terms_blank` (no period, nothing set),
  `house_rent_terms_blank`, `terms_unknown_purpose`; registry variants `baddates` (date bounds that cannot be trusted), `termsother` (other date window and ranges, a term moved to the
  details, a terms field of a type with no control), `nosection`, `oddsection`; patch modes `term_codes` and `term_hidden`. Tests are in
  `tests/e2e/listing-terms.spec.ts` (one or more per row of the story's matrix, time zones, the stub's own rules, axe at desktop and mobile);
  the Story 2.4 and 2.5 tests in `listing-edit.spec.ts` now scope their Details group lookups to the Details block.

## Images: upload, order, cover and delete (Story 2.10)

Frontend half of Story 2.10 (the contract is the backend's `docs/media.md`, `docs/listings.md` and `docs/rate-limits.md`). The Draft page has an
**Images** section between the summary and the editor form (`images-section.tsx`). It is its own component with its own state and never shares
the field form's Save.

- **List**: `ListingView.media` (`readMedia` in `listing-labels.ts`) fails closed: a `media` that is not a list, an item whose `url` is not exactly
  `/api/v1/listings/<this listing>/images/<its id>/file`, positions that are not non-negative integers in strictly increasing order, a repeated
  id, or more than one cover makes the whole Listing unreadable (the page shows its load error), because a reorder sends the complete list of ids.
  Gappy positions and no cover at all are trusted (the backend repairs ghost links lazily, so a list may be in that state). Each image is a plain
  same-origin `<img src={url}>` (the browser sends the session cookie; the answer is `private, no-store`) with `alt` "Image N of M" and a visible
  "Cover image" marker on the cover. No preview URL is created (`URL.createObjectURL` is never called), no file name or image is stored (storage,
  caches, IndexedDB) or logged, and the page title and address carry nothing.
- **Upload**: `<input type="file" multiple accept="image/jpeg,image/png,image/webp">` with the visible label "Add images". Choosing files starts
  the upload at once, **one file at a time** (`withCsrf`, multipart `FormData` with a single `file` part, a 60 second deadline), each with its own
  status (Waiting, Uploading, Uploaded, Not uploaded plus the reason). A refused file (400 with a code under `file`) does not stop the others; any
  other failure (409, 429, 503, 5xx, a lost answer, 403) stops the batch and the rest are marked "not sent". At 10 images the picker is
  `aria-disabled` and a file chosen anyway is refused on the page (a hint only: the server decides, and its `too_many_images` 409 is mapped too).
  Codes are mapped by a table of known codes (`UPLOAD_FILE_MESSAGES`, `UPLOAD_CONFLICT_MESSAGES` in `listing-messages.ts`): any other code, key or
  sentence is the generic text, never the server's words. `Retry-After` of a 503 is shown as text only ("Try again in 7 seconds.").
- **Revision sync**: an upload or a delete answers without a revision (201 Image, 204), so the section reads the Draft again (`GET`) after each one
  and hands the Listing to the editor; a reorder or cover choice answers with the Listing resource. The editor (`applyImages`) takes the new
  `revision` and `media` when nothing else changed, so a field save that follows is checked against the right revision (no spurious 409, typed
  text untouched). When the fields changed elsewhere too, it is a normal field conflict (latest data loads, typed text stays). A field-editor
  conflict reload and a successful field save carry `media` as well.
- **Reorder and cover**: "Move earlier", "Move later" (`aria-disabled` at the ends) and "Set as cover" (shown only on non-cover images) send
  `PATCH /api/v1/listings/{id}/images` with `{base_revision, order[, cover_id]}`; the list shown is the answer. Focus stays on the pressed button
  (or moves to the image after a cover choice) and the result is announced. A `409` replaces the list with `current.media` (or a fresh read when
  the answer carries none), shows "Your images were changed in another session. We loaded the latest order." and keeps focus sensible; the notice
  goes when the person acts again. `invalid` on `order` or `cover_id` reads the Draft again with a try-again message.
- **Delete**: "Delete" opens an inline confirmation (focus on Cancel; Escape cancels), then `DELETE`; the cover is promoted by the server and the
  list is read again. Focus goes to the image that took its place, or to the picker when none is left. 404 reads the Draft again ("already gone").
- **Errors and states**: 401 signs out (sign-in with `next`), 404 is the Draft not-found state, 403 is the account message only when the session
  says suspended (else generic), 429 the wait in minutes, 5xx and network text as elsewhere (a 5xx after a delete or an upload also reads the
  list again, because the proxy answers 5xx when the backend drops a connection). The empty state is "No images yet. A listing can be saved as a
  Draft without images, but needs at least one to be published."
- **Accessibility**: one polite live region (`role="status"`) holds the notice and the announcements (counts and results; per-file progress is in
  the visible list, announced once at the end); every control is a native button or input, `aria-disabled` (never `disabled`) while an action runs
  or at an end; visible focus; the list is an ordered list. axe is clean at desktop and mobile in the empty, uploading, populated, upload-error,
  delete-confirmation, conflict and reorder-error states.
- **Exclusion and races**: an image action (upload batch, reorder, cover, delete) and a field save never run together. While images change, Save
  is `aria-disabled` with the text "Saving is paused while images are being changed." (`aria-describedby`; a click announces "Wait for the image
  changes to finish, then save."); while a field save is in flight the image actions and the picker are `aria-disabled`. A module-level lock
  (`src/lib/image-lock.ts`) also stops a second batch after a remount (for example a back-forward cache restore). The editor never moves the
  revision or the images back to an older answer (a late field-save answer keeps the newer revision and media; a stale conflict answer is
  ignored), and without the registry an image answer only moves the revision and media, never typed values. A conflict that also changed
  fields raises the editor's own alert, which takes focus (its effect runs after this section's focus move); the images notice stays in the
  section's live region.
- **Upload details**: a file over 6 MiB is refused on the page as "too large" and never sent (the batch goes on), as is a server 413. A lost
  answer, a timeout or a 5xx makes the row "Unknown" (it may have been stored: check the list) and the Draft is read again. Files beyond the
  free slots are "Not added: the list is full." Every row ends in a final state (nothing stays Waiting). Leaving the page aborts the batch
  (nothing more is sent and nothing is handed to the gone page); a `beforeunload` guard asks first while a batch runs. Files dropped on the
  picker while an action runs get a visible, announced "Wait for the current action to finish."
- **Thumbnails**: `loading="lazy"`; the cover's alt is "Image N of M, cover image" (plus the visible badge). An image that cannot load shows
  "This image could not be loaded." with a Retry that mounts a fresh `<img>` (no cache-buster: the endpoint is `no-store`).
  Focus returns to the acted image's button or item after any failed move, cover or delete, and never falls to the page.
- **Proxy**: `/api/*` is a Next.js rewrite and the page proxy (`src/proxy.ts`) does not run for it (`matcher` excludes `api/`), but Next.js still buffers a proxied request body up to
  `experimental.proxyClientMaxBodySize` (default 10 MB, beyond which it answers 500): `next.config.ts` raises it to 32 MB so the backend's own
  6 MiB cap answers (`400 file: too_large`) instead of the proxy; binary responses pass through untouched. Verified with
  `npm run check:prod-listings` (a real `next build` and `next start`): a 5 MB upload arrives whole, a body just over 6 MiB reaches the backend
  (which answers `file: too_large`), a body of 11 MB also arrives whole (no proxy cap below the backend's), and the image bytes and `private, no-store` header come back unchanged; a Visitor gets 404.
- **Playwright stub**: images per Draft (presets `images_none`, `images_one`, `images_three` (cover is the second), `images_nine`, `images_ten`);
  `POST .../images` parses the multipart body (one `file` part, anything else `unknown_field`/`required`), mirrors the 6 MiB body cap, the 5 MB
  file cap, the type by magic bytes (PNG, JPEG, WebP), the 10-image limit (judged before processing), and bumps the revision; `PATCH .../images`
  mirrors the shape errors, the stale check (409 with `current`), the exact-set rule and the cover rules; `DELETE` promotes the cover and keeps
  positions 0..n-1; `GET .../file` serves a 68 byte PNG to the owner only (`private, no-store`, `nosniff`). Modes: `/__image-mode` (`ok`, `slow`,
  `too_small`, `too_large_dimensions`, `invalid_image`, `too_many`, `cap`, `busy`, `busy_no_retry`, `rate_limited`, `rate_none`, `forbidden`,
  `session_gone`, `not_found`, `unsupported_media`, `csrf_once`, `csrf_always`, `lost_once`, `error`, `broken`, `hang`), `/__image-order-mode`
  (adds `conflict_no_current`, `order_invalid`, `unreadable`), `/__image-delete-mode`, `/__image-file-mode`, `/__image-wire-mode` (media the page
  must refuse, and the trusted ghost states `ghost_gap` and `ghost_no_cover`); upload modes also include `payload_too_large` (413) and `not_editable`
  (a 403 with a valid token); order modes add `cover_invalid`, `revision_invalid`, `order_unknown`; `/__image-stats` also counts `attempts` (every upload request). `/__image-stats` returns the upload records (part names, sizes, sniffed type), PATCH bodies, deletes, file GETs and the server's
  images; `/__other-images?id=&op=reverse|add|delete_first|cover_last` simulates another session. Tests are in
  `tests/e2e/listing-images.spec.ts` (every row of the story's frontend matrix; files are small in-memory PNGs built in the test).

## Profile picture and Agency logo (Story 2.11)

A "Profile picture" section (Individual, `/account/profile`) and an "Agency logo" section (Agency, the Business profile page) sit above the
text form on each profile page. Each is its own component (`src/app/(app)/account/profile/image-section.tsx`, one component for both kinds) with its own state and no
shared Save. Backend routes: `PUT`/`DELETE /api/v1/me/profile/image` and `GET .../image/file` (Individual), the same under
`/api/v1/me/agency-profile/image` (Agency), and the public `GET /api/v1/agencies/{agency_id}/logo` (anyone, only while the Agency is Active,
`public, max-age=60`). The profile answers carry `image` (`null` or `{content_type, width, height, bytes, url}`); the Agency answer also carries
`agency_id` and `logo_url`, which are validated but never shown.

- **What is shown**: the current image from the owner route (a same-origin `<img>`, alt "Your profile picture" / "Your agency logo", `loading="lazy"`)
  or a neutral, text-free placeholder with "No picture yet." / "No logo yet.". Choosing a file uploads it at once (one file, JPEG/PNG/WebP, the
  picker is labelled "Choose a picture" / "Choose a logo"); a file over 6 MiB is refused in the page and never sent (the server's own 5 MB rule answers
  for anything between). "Remove picture" / "Remove logo" asks first ("Yes, remove" / "Cancel", Escape cancels, focus goes to Cancel).
- **Errors**: known codes only (`file`: `too_large`, `unsupported_type`, `too_large_dimensions`, `too_small`, `invalid_image`, `required`; `409
  storage_cap_exceeded` ("You have reached your storage limit. Free up space and try again."); `503 busy` with the wait; `429` in minutes; 401 goes to sign-in; 403 says "Your account cannot change images right now." only
  when the session itself is Suspended, else the generic text; network and timeout text). The mapping is shared with the Draft's Images section
  (`src/lib/upload-errors.ts`), as are the busy lock (`src/lib/image-lock.ts`, now keyed by scope: "listing" and "profile") and the `<img>` with its
  load-failure Retry (`src/components/retry-image.tsx`). A 5xx or a lost answer may have changed the image: the profile is read again and the text
  says "It may have been saved: check the image shown." (a removal that meets 404 or 409 also reads the profile and says "We loaded the latest image."; a 503 means nothing changed and gets no such suffix). A read that a newer read superseded is not a failure.
- **One live region** (`role="status"`) holds the result or failure and the sr-only "Uploading your picture." announcement. Controls are
  `aria-disabled` (never `disabled`) while an action runs. Focus: the picker after an upload or a removal, Cancel when asking, Remove (or the
  picker when no image is left) after any failure, and never the page.
- **Mutual exclusion**: while an image action runs, the text form's Save is `aria-disabled`, says "Saving is paused while images are being
  changed." and does nothing (it announces "Wait for the image changes to finish, then save."); while a text save is in flight the picture actions
  wait ("Wait for your changes to be saved, then change the image."). A module-level lock (scope "profile") is held for the whole action; when the section unmounts the request is aborted and the lock is released (so a remount can start a new action at once), and a stale instance that finishes later no longer holds the lock and does not touch the page's busy flag. The text save sets its own module-level flag synchronously in the submit, so a choice made in the very next event already waits. A second choice, a double click on "Yes, remove" or a too-large file while an action of this very section runs is ignored quietly (no notice, focus stays); a request blocked by a text save or another action says why; `beforeunload` asks first while an upload runs; a back-forward cache restore checks the session,
  closes an open prompt and reads the profile again.
- **Never regress**: every profile read takes a stamp before it asks (`src/lib/read-stamp.ts`) and a finished change takes one when its answer
  arrives; an older read never replaces a newer picture, a read started after a change does (a change made in another tab appears). The shown
  address carries a counter (`?r=N`) after a change, because the owner route itself never changes and a browser would reuse the old bytes. The
  PATCH answer's `image` is ignored (a text save never touches the image). The wire carries no identity of the bytes, so the first read that is newer than a change this page made itself mounts the image afresh (one extra image request); this also catches a same-size replacement made in another tab right after, but a same-size replacement in another tab with no change of our own is only noticed when the type, size or dimensions differ (accepted limitation).
- **Wire shapes fail closed**: an `image` that is not exactly the documented shape with the owner route as its `url` (or an Agency `agency_id` that
  is not a UUID, or a `logo_url` that is not its own public route) makes the whole profile read unreadable ("We could not load your profile" with
  Retry); nothing is rendered from it.
- **Privacy**: no file name is read, no preview URL is made, nothing is stored (no local/session storage), no URL is shown as text.
- **Production check**: `npm run check:prod-profile` (`scripts/check-prod-profile.mjs`, ports 3220/4130, run in CI) builds the app and proves, through
  the real proxy, that a 5 MB upload arrives whole on both owner routes, bodies over 6 MiB and 11 MB reach the backend (`file: too_large`), the binary
  image comes back untouched with `private, no-store`, and the public logo is `public, max-age=60`, cookie-free for a Visitor, and 404 when the
  Agency is not active.
- **Playwright stub**: `PUT`/`DELETE`/`GET .../file` for both kinds with the real validation (multipart with one `file` part, magic bytes, 5 MB, 6 MiB,
  account type checked before the body, the 10-uploads-an-hour limit counted per `PUT`), the uploaded bytes served back, the profile answers
  with `image` (the Agency's also `agency_id` `55555555-5555-4555-8555-555555555555` and `logo_url`), and a public logo route that serves only while
  `/__logo-mode` is `active` (`suspended` makes it 404). Modes: `/__profile-image-mode` (`ok`, `hold` (the answer waits for `/__profile-image-release`),
  `slow`, the error modes of `/__image-mode`, `lost_once`, `error`, `broken`, `hang`), `/__profile-image-delete-mode`, `/__profile-image-file-mode`
  (`ok`, `not_found`, `broken`), `/__profile-image-wire-mode` (`string_image`, `bad_url`, `other_route`, `bad_type`, `zero_dims`, `bad_agency_id`,
  `bad_logo_url`), `hold` for `/__profile-mode` and `/__agency-profile-mode` (a read whose answer waits for `/__profile-release`), `/__profile-image-set`
  (a picture stored "elsewhere", `clear=1` removes it) and `/__profile-image-stats` (attempts, uploads, deletes, tokens, stored image, public-logo
  requests with their cookie). A suspended session is `/__signin-mode?value=suspended` (the stub session then reports `suspended`).
  Tests: `tests/e2e/profile-image.spec.ts` (every row of the story's matrix for both kinds; axe at desktop and mobile in empty, populated,
  asking, uploading, error and image-failed states; Playwright treats `aria-disabled` as disabled, so clicks on such a control use `force`).

## Layout

- `src/app/(public)` public pages (includes `/health`, `/register`, `/register/agency`, `/verify-email`, `/forgot-password`, `/reset-password` and `/confirm-email-change`), `src/app/(app)` signed-in pages (dashboard, profile, password, notifications, listings),
  `src/app/admin` admin area (`sign-in` public, everything else in the guarded `(protected)` group). Shells only; no visibility, privacy or quota logic lives here.

`/dashboard` is a placeholder guarded on the server (see above); `/admin` is the administrator area (see "Admin area").
Both are marked `noindex`.

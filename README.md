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
- **Hand-off to Story 1.22**: logo upload is out of scope here (Epic 2) and nothing edits or decides the verification status;
  the page only shows the server's value. Story 1.22 can add verification actions next to that text.

## Layout

- `src/app/(public)` public pages (includes `/health`, `/register`, `/register/agency`, `/verify-email`, `/forgot-password`, `/reset-password` and `/confirm-email-change`), `src/app/(app)` signed-in pages,
  `src/app/admin` admin area. Placeholders only; no visibility, privacy or quota logic lives here.

`/dashboard` and `/admin` are placeholders guarded on the server (see above); `/admin` has no role check until Story 1.19.
Both are marked `noindex`.

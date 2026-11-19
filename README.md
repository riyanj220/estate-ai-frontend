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

Hand-off to Story 1.18: add the "Forgot your password?" link to the sign-in page; the backend ends other sessions on a
password change, so a later `401` on any call means the session ended (return to the signed-out state).

## Layout

- `src/app/(public)` public pages (includes `/health`, `/register` and `/verify-email`), `src/app/(app)` signed-in pages,
  `src/app/admin` admin area. Placeholders only; no visibility, privacy or quota logic lives here.

`/dashboard` and `/admin` are placeholders guarded on the server (see above); `/admin` has no role check until Story 1.19.
Both are marked `noindex`.

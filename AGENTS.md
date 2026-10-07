# fast-ticket-frontend — Agent Guide

The web frontend for **fast-ticket**, a FastAPI REST + WebSocket API over osTicket. This is its **own repository**,
separate from the backend (`../fast-ticket`, FastAPI). Framework: **Next.js**; the remaining choices are under
"Decisions made" and "Open decisions" below.

## Goal

**Demonstrate that osTicket's functionality is faithfully implemented by the FastAPI backend.** The UI therefore takes
the shape of osTicket's own staff panel (`/scp`): the same screens, navigation, queues, ticket view with thread, and
Admin Panel pages, so a viewer can compare the two side by side and see the same data and behaviour. Fidelity to
osTicket's *workflow* matters more than pixel-perfection, and a screen is only done when it works against the real
stack, not a mock.

- Reference for layout and fields: the osTicket source at `../osticket/osTicket` — `scp/*.php` (the pages) and
  `include/staff/*.inc.php` (their templates). The reference *stack* for comparison runs at http://localhost:8080/scp,
  the API at http://localhost:8000 (see the backend's `/dev-stack` skill).
- osTicket is GPL-2.0. **Recreate** its layout and behaviour; do not copy its CSS, images, logo or template code into
  this repo.
- Build in the backend's order of value: login → ticket queues and ticket view → reply/note/assign/close → tasks →
  users/organizations → knowledge base/canned → Admin Panel. Show osTicket's behaviour, including its refusals (a
  failed command's `error_message`) — that is what proves the backend.
- What the API cannot do yet (`../fast-ticket/notes/KNOWN_LIMITS.md`: no upload, no export, no custom queues, …) is
  shown as absent or disabled in the UI, never faked.

## Decisions made

- **Next.js** (2026-10-04), TypeScript, App Router.
- **Same-origin through Next.js (option B):** the browser only talks to Next.js. `/api` is proxied to FastAPI
  (rewrite), and route handlers act as a thin backend-for-frontend that logs in, keeps the access token in an
  **httpOnly cookie** (never in `localStorage`/JS), and attaches it to proxied calls. The browser therefore needs no
  CORS and never sees the token. Because the API has no refresh tokens, a 401 sends the agent to the login screen.
- **Live updates (2026-10-05): Server-Sent Events relayed by Next.js, not a browser WebSocket.** The backend's socket
  needs the access token as a subprotocol, and the token lives in an httpOnly cookie that page JavaScript cannot read.
  Handing the page the real token (the API cannot mint a separate short-lived one) would undo that decision, and Next
  route handlers cannot upgrade a WebSocket. So `GET /api/events` (`src/app/api/events/route.ts`) opens the WebSocket
  server-side with the cookie's token and relays each event as SSE, keeping only `type`, `aggregate_type` and
  `aggregate_id` (the payload is a hint, per `EVENTS.md`). The browser uses a same-origin `EventSource`
  (`src/components/live-updates.tsx`): an event invalidates the queries that read its aggregate
  (`src/lib/live/keys.ts`), batched; there is no replay, so every reconnect refetches everything on screen. The
  relay closes its socket when the page goes away (the backend allows 10 per agent), and answers `unauthorized` when
  the token is dead so the page goes back to the login screen.
- **Content-Security-Policy (2026-10-06):** a per-request nonce set in `src/proxy.ts` (scripts: `'self'` + nonce +
  `strict-dynamic`; no remote images, no frames, no objects). Every page is therefore rendered per request (the root layout
  awaits `connection()`). React's `style={{}}` attributes need `style-src-attr 'unsafe-inline'`; the dev server also needs
  `'unsafe-inline'` styles and `'unsafe-eval'`. `e2e/csp.spec.ts` checks the header and that nothing is blocked; the
  whole suite was also run against `next build && next start`.
- **Admin Panel generic screens (2026-10-07):** a resource is a config entry (`src/lib/admin/resources.ts`) plus a menu item;
  anything that needs more is a hand-built `screen` in the menu (logs, system information, plugins, settings) or an
  editor under the generic view (`admin-relations.tsx`, `admin-filters.tsx`). The eight settings pages are one generic
  editor that renders each key by its value type and sends only what changed; osTicket's field-by-field refusal is shown
  as worded.
- **Custom columns (2026-10-07):** the Columns menu on the ticket, task, user and organization lists keeps its choice in
  the URL (`cols=`) and sends the names as the API's `?fields=`, so answers arrive on the list request.
- **Tailwind CSS** for styling (no component kit): osTicket's look is utilitarian, and recreating it is easier with
  utility classes than by fighting a kit's defaults.
- **npm** as the package manager (already installed here; Node 24).
- **TanStack Query** (2026-10-04) for server state: the 202 + `GET /commands/{id}?wait=` pattern maps onto its
  mutations, and invalidation covers refetch-after-write and later refetch-on-event.
- **Testing** (2026-10-04): Vitest for the pure pieces (Testing Library has not been needed); Playwright against the
  live stack for the demo flows, comparing each screen with osTicket's own page. The Playwright suite sweeps what it
  creates (`e2e/sweep.ts`).
- **Types come from the schema:** generated from the backend's `/openapi.json`, never hand-written. The schema is a
  **committed snapshot** at `openapi/openapi.json`, refreshed by an npm script (`npm run api:pull`) from a running dev
  backend, and the types are generated from the snapshot (`npm run api:types`, e.g. `openapi-typescript`). Builds
  never need the backend; a backend contract change arrives as a reviewable diff of the snapshot. Pull it whenever
  the backend's API changes, and say so in the commit.

## Boundary with the backend

- The frontend talks to the backend **only through its published HTTP/WebSocket contract**. It never imports backend
  code, reads osTicket's database, or assumes anything the contract does not state.
- The contract is documented in the backend repo; read these before building anything that calls the API:
  - `../fast-ticket/notes/CLIENTS.md` — auth, the 202 command pattern (writes are queued; poll
    `GET /commands/{id}?wait=`), idempotency keys, errors, CORS, deployment.
  - `../fast-ticket/notes/EVENTS.md` — the WebSocket event stream and its delivery limits (no replay: refetch on
    reconnect).
  - `../fast-ticket/notes/KNOWN_LIMITS.md` — what the API does not do yet (no upload, no export, …).
  - The schema itself: `/openapi.json` of a running backend (`http://localhost:8000/openapi.json` in dev).
- Generate the API client's types **from the schema**; do not hand-write request or response types.
- **The backend's rules are not this repo's rules.** Its `AGENTS.md`/`CLAUDE.md` (bridge, osTicket handlers, the
  `make test-e2e` routine, its session protocol) do not apply here.
- If the frontend needs something the API lacks or gets wrong, **do not work around it silently**: record it in
  `notes/BACKEND_REQUESTS.md` here (what the screen needs, what the API gives) so it can be raised in the backend repo.
- The server enforces permissions; the UI only hides what the agent cannot do (`GET /api/v1/auth/me`). A 404 means
  "gone or not yours".

## Working agreements

- Local git repository, no remote yet. Atomic commits, `<type>(<scope>): <summary>`.
- Never commit secrets or `.env` files; commit a `.env.example` for any variable the app reads.
- Keep this file current as decisions are made. Open questions for the user go under an "Open decisions" heading.
- This is Next.js 16, newer than most training data: read the relevant guide in `node_modules/next/dist/docs/` before
  using an API you are unsure of (route handlers, cookies, proxying, caching).
- `next dev` rewrites `AGENTS.md` when it detects an AI agent. The `dev` script unsets the agent environment variables
  so it never edits our guidance; do not run bare `next dev` from an agent session.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Invoice Maker

Invoice and estimate SaaS for freelancers and small businesses. The product spec is `docs/Invoice Maker — Spec-Driven Development.md` (Portuguese); where the code deliberately differs from it, `docs/decisions.md` wins. The visual source of truth is `docs/design_handoff_invoice_maker_web/` (tokens in its README, screenshots a1–g5).

Status: phases 1–3 (foundation, invoicing, estimates) are done. Next: phase 4 (email via Resend), then phase 5 (billing and plan gating).

## Working rules

- Write all code, comments, tests, commit messages and docs meant for developers in English. Talk to the user in Portuguese.
- Never commit unless the user asks. They review and commit by hand.
- Every feature ships with tests at the levels it touches: unit, component, integration and E2E.
- Before calling work done, run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e` when UI flows change.
- Never commit secrets. `.env` is local; add new variables to `.env.example` with a comment.
- Leave the `nextjs-agent-rules` block above untouched; `next dev` maintains it.

## Local environment

- Postgres 17 runs in Docker (`invoicesweb-postgres`) on port **5434**, with `invoices_dev` and `invoices_test` databases. Production uses Neon.
- Setup: `npm run db:up`, `npm run db:migrate`, `npm run db:seed`. The seed recreates `demo@invoicemaker.test` / `demo-password-123` with invoices and estimates in every status.
- Prisma refuses `migrate reset` when an agent runs it. Don't bypass that consent guard; ask the user to run it. Tests use `migrate deploy` plus TRUNCATE instead.
- The repo lives on `/mnt/c` under WSL: `next dev` doesn't notice newly created route files, so restart it after adding routes. The C: drive is often nearly full; check `df -h /mnt/c` before installs or builds (deleting `.next` frees space).
- The PDF renderer needs Chromium: `npx playwright install chromium`.

## Tests

| Command | What runs |
|---|---|
| `npm run test:unit` | Vitest `unit` (node) and `components` (jsdom) projects |
| `npm run test:int` | Vitest `integration`: route handlers and services against the real `invoices_test` database, with `@/server/auth/context` mocked |
| `npm run test:e2e` | Playwright against a production build on port 3100, desktop and phone projects |

- `test:int` and `test:e2e` both wipe `invoices_test`, so never run them at the same time. The setup refuses any database whose name doesn't end in `_test`.
- Helpers: `tests/setup/db.ts` (truncate, factories), `tests/setup/http.ts` (`callRoute`), `tests/setup/auth-state.ts`; E2E helpers in `tests/e2e/support/`.
- Test files sit next to the code: `*.test.ts(x)` for unit and component tests, `*.int.test.ts` for integration tests.

## Architecture

- **API-first.** Everything the UI does goes through `/api/v1` route handlers, which stay thin: `withApi()` (`src/server/api/handler.ts`) handles auth, JSON parsing and errors, then calls a service.
- **Responses** always use `{ data }`, `{ data, pagination }` or `{ error: { code, message, details } }`. Throw `ApiError` (`src/server/api/errors.ts`) rather than building error responses by hand.
- **Layers:** `src/server/services` holds business rules and transactions; `src/server/repositories` holds Prisma queries. Every query is scoped by `businessId`, and a record owned by another business returns 404, never 403.
- **Validation:** Zod schemas in `src/lib/validation` are shared by the API and the forms.
- **Money:** decimal.js via `src/lib/documents/math.ts`, rounded half-up per line. Money travels as strings. Business dates are `@db.Date` values handled as ISO strings, and "today" is always computed in the business's timezone (`todayIn` in `src/lib/dates.ts`).
- **Statuses:** OVERDUE (invoices) and EXPIRED (estimates) are derived on read and never stored. Allowed actions per status live in `src/lib/invoices/status.ts` and `src/lib/estimates/status.ts`; PATCH never changes status.
- **Invoices and estimates share one document layer:** `DOCUMENT_KINDS` (`src/features/documents/editor/kinds.ts`) configures the shared editor. `src/features/documents/document-templates.tsx` with `DOCUMENT_CSS` (`document-styles.ts`) is the single template source for the editor preview, the public pages and the PDF (`src/server/documents/render.ts`, headless Chromium). A new template or layout change must look right in all three.
- **Plan limits** live in `src/server/entitlements/plans.ts` and are exposed through `/api/v1/me`. They are not enforced yet; enforcement comes with phase 5.
- **Auth:** Auth.js v5 with JWT sessions. `src/proxy.ts` (Next 16's replacement for middleware) guards pages; public paths are listed in `src/lib/proxy-rules.ts`.

# Invoice Maker — web

SaaS for freelancers and small businesses to create, send and track invoices and estimates.
The product spec lives in [`docs/Invoice Maker — Spec-Driven Development.md`](docs/) and the
high-fidelity design in [`docs/design_handoff_invoice_maker_web/`](docs/design_handoff_invoice_maker_web/README.md).

**Status: phase 1 (foundation).** Accounts (email + password, Google), onboarding, business
profile and invoice defaults, clients, and the items catalog — over a versioned REST API.
Invoicing, estimates, email and billing follow in phases 2–5.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) ·
Prisma 7 + PostgreSQL (Docker locally, Neon in production) · Auth.js v5 · Zod 4 ·
Vitest + Testing Library · Playwright.

## Getting started

Requirements: Node.js 24, Docker.

```bash
cp .env.example .env          # then set AUTH_SECRET: npx auth secret
npm install                   # also generates the Prisma client
npm run db:up                 # Postgres 17 on localhost:5434 (dev + test databases)
npm run db:migrate            # apply migrations to the dev database
npm run db:seed               # optional: demo@invoicemaker.test / demo-password-123
npm run dev
```

Google sign-in is disabled until `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set
(redirect URI: `http://localhost:3000/api/auth/callback/google`).

> **WSL tip:** on `/mnt/c` the dev server may not notice new files. Restart `npm run dev`
> after adding routes, or keep the repository on the Linux filesystem.

## Tests

| Command | What it runs |
|---|---|
| `npm run test:unit` | Unit tests (`*.test.ts`, Node) and component tests (`*.test.tsx`, jsdom) |
| `npm run test:int` | Integration tests (`*.int.test.ts`): services and route handlers against the real `invoices_test` database |
| `npm run test:e2e` | Playwright against a production build on port 3100, desktop and phone viewports |
| `npm test` | Unit, component and integration tests |

Integration and E2E tests both use `DATABASE_URL_TEST` and wipe it, so run them one at a
time. Both refuse to run unless the database name ends in `_test`. The first E2E run needs
a browser: `npx playwright install chromium`.

Also: `npm run lint`, `npm run typecheck`.

## Architecture

API-first: every business rule lives on the server, and the web app is the first client of
`/api/v1` (the Flutter apps will be the next).

```
src/
  app/
    (auth)/            sign-in, sign-up
    (app)/             overview, clients, products, settings (require a business)
    onboarding/
    api/v1/            thin route handlers → services
  features/            UI per domain (auth, clients, products, settings, onboarding)
  components/          ui/ (shadcn), app-shell/, list/, forms/
  lib/                 shared by client and server: validation schemas, api client, money, formatting
  server/
    api/               error codes, response envelope, withApi() wrapper
    auth/              session helpers, password hashing, rate limiting
    services/          business rules and validation
    repositories/      Prisma queries, always scoped to a business
    entitlements/      plan limits (single source of truth)
  auth.ts              Auth.js configuration
  proxy.ts             redirects signed-out visitors to /sign-in
```

- **Reads** in Server Components call services directly; **writes** from client components go
  through `/api/v1` with `src/lib/api-client.ts`.
- **Authorization:** repositories filter every query by `businessId`; another business's
  resource is always a `404`, never a `403`.
- **Money** is `Decimal` in Postgres and a string with two decimals on the wire — never a float.
- **Deletes** of clients and items are soft (`deletedAt`), so future invoices keep their references.

### API

Responses follow `{ "data": … }`, `{ "data": [], "pagination": { page, limit, total } }` or
`{ "error": { "code", "message", "details"? } }`.

| Method | Path | |
|---|---|---|
| `POST` | `/api/v1/auth/sign-up` | Create an account (rate limited) |
| `GET` | `/api/v1/me` | User, business, plan and entitlements |
| `GET` `POST` `PATCH` | `/api/v1/business` | `POST` once, during onboarding |
| `GET` `POST` | `/api/v1/clients` | `?page&limit&q&sort=name\|createdAt&order=asc\|desc` |
| `GET` `PATCH` `DELETE` | `/api/v1/clients/:id` | |
| `GET` `POST` | `/api/v1/products` | `sort` also accepts `unitPrice` |
| `GET` `PATCH` `DELETE` | `/api/v1/products/:id` | |

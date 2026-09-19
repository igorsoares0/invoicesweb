# Invoice Maker — web

SaaS for freelancers and small businesses to create, send and track invoices and estimates.
The product spec lives in [`docs/Invoice Maker — Spec-Driven Development.md`](docs/) and the
high-fidelity design in [`docs/design_handoff_invoice_maker_web/`](docs/design_handoff_invoice_maker_web/README.md).

**Status: phase 5 (billing) — the web MVP is complete.** Accounts (email + password, Google), onboarding, business
settings, clients and the items catalog (phase 1); invoices with server-side totals, continuous
numbering, an autosaving editor, five PDF templates, public links, manual payments and the
overview dashboard (phase 2); estimates that clients accept or decline from a public link,
expire on their own and convert into invoices with prices locked (phase 3); sending invoices
and estimates by email through Resend, with the PDF attached, a logged attempt per send and
the result on the document's history (phase 4); plans and billing through Paddle — Free with three sent
invoices a month and a "Made with" mark, Pro at $9/month or $90/year, a 14-day Pro trial for new
accounts, enforced on the server when a document is sent (phase 5).

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
npm run db:seed               # optional: recreates demo@invoicemaker.test / demo-password-123
npm run dev
```

Google sign-in is disabled until `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set
(redirect URI: `http://localhost:3000/api/auth/callback/google`).

Sending email is disabled until `RESEND_API_KEY` is set; the send dialog then only marks
documents as sent. `EMAIL_FROM` defaults to Resend's sandbox sender, which **only delivers to
the address of your own Resend account** — verify a domain before emailing real clients. To
exercise the flow without a key, set `EMAIL_TRANSPORT=capture`: emails are logged in
`EmailLog` and never leave the machine (the test runners set this themselves, and sending to
`fail@capture.test` simulates a provider failure).

Billing is disabled until `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN` and both `PADDLE_PRICE_PRO_*` ids
are set; plan limits apply either way. To try a real checkout in the Paddle sandbox:

1. Create an API key and a client-side token in the Paddle dashboard and put them in `.env`. The
   account needs a default payment link (any approved URL) before it can create transactions.
   Leave `PADDLE_CHECKOUT_URL` empty locally: Paddle only accepts approved domains, never localhost.
2. `npm run dev`, then `ngrok http 3000` (ngrok hosts are allowed as dev origins in `next.config.ts`), and add a notification destination for
   `https://<ngrok-host>/api/webhooks/paddle` with the `subscription.*` events. Put its secret in
   `PADDLE_WEBHOOK_SECRET`. (Without the webhook, the page still activates Pro by syncing the
   checkout; the webhook keeps cancellations and renewals in step.)
3. Open `/pricing`, upgrade with the test card `4242 4242 4242 4242`, any future expiry, CVC `100`.

PDFs are printed by headless Chromium (`playwright-core`). Locally, `npx playwright install chromium`
provides it. The production image needs it too: `npx playwright install --with-deps chromium`.

> **WSL tip:** on `/mnt/c` the dev server may not notice new files. Restart `npm run dev`
> after adding routes, or keep the repository on the Linux filesystem.

## Tests

| Command | What it runs |
|---|---|
| `npm run test:unit` | Unit tests (`*.test.ts`, Node) and component tests (`*.test.tsx`, jsdom) |
| `npm run test:int` | Integration tests (`*.int.test.ts`): services and route handlers against the real `invoices_test` database |
| `npm run test:e2e` | Playwright against a production build on port 3100, desktop and phone viewports |

Integration and PDF tests need Chromium installed (see above).
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
    (app)/             overview, invoices, clients, products, settings (require a business)
    i/[token]/         public invoice page and PDF (no account needed)
    e/[token]/         public estimate page, accept/decline and PDF
    onboarding/
    api/v1/            thin route handlers → services
  features/            UI per domain (auth, clients, products, settings, invoices, estimates, public)
    documents/         shared by invoices and estimates: editor, templates, detail cards
  components/          ui/ (shadcn), app-shell/, list/, forms/
  lib/                 shared by client and server: validation schemas, api client, money, formatting
  server/
    api/               error codes, response envelope, withApi() wrapper
    auth/              session helpers, password hashing, rate limiting
    services/          business rules and validation
    invoices/          snapshots, document rendering, public tokens
    email/             transport (Resend or capture), message template, base URL
    billing/           Paddle configuration, webhook signatures, subscription mapping
    pdf/               Chromium renderer and embedded fonts
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
- **Deletes** of clients and items are soft (`deletedAt`), so invoices keep their references.
- **Invoices:** numbers are assigned when the draft is created (row-locked counter, never reused);
  totals are computed on the server with per-line rounding; status changes only through actions;
  `OVERDUE` is derived when reading. Sending freezes the issuer and client into the invoice.
- **Documents:** one set of React templates + CSS (`src/features/documents`) renders the editor
  preview, the public page and the PDF, so all three always match. Invoices and estimates share
  the editor, line math, validation and templates; `DOCUMENT_KINDS` holds what differs.
- **Estimates:** their own `EST-` sequence; only drafts are editable; `EXPIRED` is derived when
  reading; a reply is recorded once (by the client on the link, or by you) and conversion to an
  invoice happens only from `ACCEPTED`, under a row lock.
- **Plans:** sending an invoice is where the plan is enforced: the monthly count and Pro-only
  options are checked inside the send transaction, under a lock on the business, so every path
  (mark as sent, email, convert and send) obeys it and two sends can't race past the limit.
- **Email:** the send transition commits first, then the PDF and the provider call run outside
  any transaction. A provider failure is therefore an outcome, not an error: the document stays
  sent, the attempt is stored in `EmailLog`, and the history shows both lines. One user action
  is one history line — a first send reads "Emailed to …", a re-send adds its own entry.

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
| `GET` `POST` | `/api/v1/invoices` | `?status=draft\|sent\|overdue\|paid\|cancelled&q&sort=number\|dueDate\|issueDate\|total&order`; `POST` creates a numbered draft |
| `GET` `PATCH` `DELETE` | `/api/v1/invoices/:id` | `PATCH` autosaves drafts (replaces all lines); `DELETE` drafts only |
| `POST` | `/api/v1/invoices/:id/send` | Mark as sent: validates, freezes snapshots, publishes the link |
| `POST` | `/api/v1/invoices/:id/email` | `{ to[], subject?, message?, attachPdf?, sendCopy? }`; sends a draft first. Answers 200 with `data.email.status` — the document is sent even when the provider refuses |
| `POST` | `/api/v1/invoices/:id/duplicate` · `/cancel` · `/mark-paid` | |
| `POST` `DELETE` | `/api/v1/invoices/:id/public-link` | New link / revoke |
| `GET` `POST` | `/api/v1/invoices/:id/pdf` | `?download=1` for an attachment |
| `GET` `POST` | `/api/v1/invoices/:id/payments` | `POST` accepts an `Idempotency-Key` header |
| `DELETE` | `/api/v1/invoices/:id/payments/:paymentId` | |
| `GET` | `/api/v1/dashboard` | `?currency=EUR`; never converts between currencies |
| `GET` | `/api/v1/billing` | Plan summary: plan, where it comes from (subscription, trial, free), this month's usage |
| `POST` | `/api/v1/billing/checkout` | `{ interval: "MONTH" \| "YEAR" }` → a Paddle transaction for the overlay; 409 when already subscribed |
| `POST` | `/api/v1/billing/sync` | `{ transactionId }` after checkout: stores the subscription without waiting for the webhook |
| `POST` | `/api/v1/billing/portal` | Signed-in links to Paddle's customer portal (overview, card, cancel) |
| `POST` | `/api/webhooks/paddle` | Paddle notifications, verified with `PADDLE_WEBHOOK_SECRET`; each event is applied once |
| `GET` | `/i/:token/pdf` | Public PDF, rate limited per IP |
| `GET` `POST` | `/api/v1/estimates` | `?status=draft\|sent\|accepted\|declined\|expired\|converted&q&sort=number\|expiryDate\|issueDate\|total` |
| `GET` `PATCH` `DELETE` | `/api/v1/estimates/:id` | `PATCH` and `DELETE` for drafts only |
| `POST` | `/api/v1/estimates/:id/send` · `/accept` · `/decline` · `/reopen` · `/duplicate` | `accept`/`decline` record a reply you received |
| `POST` | `/api/v1/estimates/:id/email` | Same body as the invoice route; refused once expired or converted |
| `POST` | `/api/v1/estimates/:id/convert` | `{ issueDate, dueDate, send? }` → `{ invoice, estimate }` |
| `POST` `DELETE` | `/api/v1/estimates/:id/public-link` · `GET` `POST` `/pdf` | |
| `GET` | `/api/v1/estimates/summary` | Awaiting reply, accepted-not-invoiced, win rate, reply time |
| `GET` · `POST` | `/e/:token/pdf` · `/e/:token/accept` · `/e/:token/decline` | Public, rate limited per IP |

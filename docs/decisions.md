# Implementation decisions

The product spec (`Invoice Maker — Spec-Driven Development.md`) describes what to build. This file records where the implementation deliberately goes further than the spec or differs from it, and why. When the two disagree, this file wins; don't "fix" the code back to the spec without revisiting the decision here.

Add an entry whenever a phase makes a decision the spec doesn't cover. Section numbers (§) refer to the spec.

Phases 1–3 are done (foundation, invoicing, estimates).

## Structure and routes

- **App routes are top level:** `/overview`, `/invoices`, `/invoices/[id]`, `/estimates`, `/estimates/[id]`, `/clients`, `/products`, `/settings`, inside the `(app)` route group, rather than under `/dashboard/*` (§41). URLs stay short, and they match the design handoff.
- **Layout (§41):** `src/lib` holds framework-free code shared by the client and the server (validation, money, dates, status rules). Server-only code lives under `src/server` (`api`, `auth`, `services`, `repositories`, `documents`, `pdf`, `entitlements`). `src/features/documents` holds what invoices and estimates share (editor, templates, detail cards), and `src/features/invoices` and `src/features/estimates` only add what's specific to each.
- **`proxy.ts`** guards pages instead of `middleware.ts`, which is deprecated in Next 16.
- **Onboarding:** after sign-up, users without a business go to `/onboarding` before reaching the app.

## Data model

- **IDs** are CUIDs. `Invoice.number` and `Estimate.number` are formatted labels, and the integer `sequence` next to them is unique per business.
- **Business (§6) extra fields:**
  - `defaultTaxRate` and `paymentTermsDays` prefill new invoices.
  - `timezone` decides what "today" means.
  - `estimatePrefix`, `estimateNextNumber` and `estimateValidityDays` configure estimates.
  - `paymentInstructions` (bank details, IBAN) is printed on invoices only.
- **Client and product extra fields:** a client can have a default `currency`. A product has an optional `currency`, plus `taxExempt` and `taxExemptReason`.
- **Soft delete for clients and products** (`deletedAt`): removing one hides it from lists and pickers, while documents keep referencing it.
- **Snapshots:** on send, `issuerSnapshot` and `billToSnapshot` freeze the business and client data. Drafts render live data, sent documents render the snapshot, so editing a client later never changes an issued invoice.
- **Lifecycle timestamps:** `sentAt` and `viewedAt` on both documents; `cancelledAt` on invoices; `acceptedAt`, `declinedAt`, `respondedBy` (`"client"` or `"you"`) and `convertedAt` on estimates.
- **Conversion link:** `Estimate.convertedInvoiceId` (unique) links an estimate to the invoice it became, and the invoice reads it back through the `fromEstimate` relation.
- **Line items (§8, §10)** also store `productId`, `discountType` (`PERCENT`/`FIXED`) with `discountValue`, and `taxExempt` with `taxExemptReason`. `unitPrice` may be null on a draft line; sending requires it.
- **Payments** have an optional `idempotencyKey`, unique per invoice (§52).
- **Events:** besides the spec's examples (§12), invoices log `PAYMENT_REMOVED`, `LINK_REVOKED` and `DUPLICATED`. Estimates have their own `EstimateEvent` table: `CREATED`, `SENT`, `VIEWED`, `ACCEPTED`, `DECLINED`, `REOPENED`, `CONVERTED`, `LINK_REVOKED`, `DUPLICATED`. The `MARKED_PAID` example isn't a separate type: marking an invoice paid records a payment for the balance, which logs `PAYMENT_ADDED`.
- **Not yet in the schema:** `EmailLog` (phase 4) and `Subscription` (phase 5).

## Statuses and transitions

- **OVERDUE and EXPIRED are derived when reading, never stored** (§7, §9, §62).
  - An invoice is OVERDUE when it's SENT, VIEWED or PARTIALLY_PAID, its due date is before today in the business's timezone, and it still has a balance.
  - An estimate is EXPIRED when it's SENT or VIEWED and its expiry date is before today.
  - Deriving them means no cron job, and the status can never go stale. The list filters `overdue` and `expired` query on the same rule.
- **Documents lock once sent.** Only DRAFT invoices and estimates can be edited or deleted. To change a sent estimate, duplicate it. Status changes go through action endpoints only; PATCH never changes status.
- **Invoice actions** (`src/lib/invoices/status.ts`):
  - Send: from DRAFT.
  - Record a payment: from SENT, VIEWED or PARTIALLY_PAID.
  - Remove a payment: from PARTIALLY_PAID or PAID.
  - Cancel: from DRAFT, SENT or VIEWED only. Once money has come in, cancelling would hide it, and refunds are out of scope.
  - After a payment changes, the status is recomputed from all payments on file: PAID, PARTIALLY_PAID, or back to VIEWED/SENT when nothing is paid.
- **Estimate actions** (`src/lib/estimates/status.ts`):
  - Send: from DRAFT.
  - Accept or decline: from SENT or VIEWED, and only while not expired. The client answers on the public page (`respondedBy: "client"`), or the business records a reply received by phone or email (`"you"`).
  - Reopen: DECLINED goes back to SENT, for when the client changes their mind.
  - Convert: from ACCEPTED only.
  - Duplicate: from any status.
- **VIEWED** is set on the first visit to the public link. Visits by the document's owner and by link-preview bots don't count.

## Numbering (§33)

- **Numbers are assigned when the draft is created**, not when it's sent. An atomic `UPDATE "Business" … RETURNING` hands out the next number, so concurrent creations never collide. Deleting a draft does not return its number, so the sequence can have gaps.
- **Separate sequences:** invoices (`INV-`) and estimates (`EST-`) are numbered independently.
- **Settings guard:** the next number can be changed in Settings, but never to a number already in use.

## Money, tax and currency (§34, §66)

- **Arithmetic** uses decimal.js with half-up rounding, applied per line. Totals are the sum of the rounded lines. Money travels as strings in the API, never as JS numbers.
- **Discounts and tax are per line** (percent or fixed discount, then VAT). A discount never makes a line negative. Document-level `discount` and `tax` are sums of the lines.
- **Tax exemption:** a tax-exempt line carries a reason, which is printed on the document.
- **Currency** is a label on each document. There's no conversion, and dashboard totals are grouped per currency instead of being added up.
- **Business dates** (issue, due, expiry, payment) are `@db.Date` values handled as `YYYY-MM-DD` strings, so they don't shift across timezones.

## API (§23–§30, §60, §61)

- **Envelope:** as in the spec, plus `details` (field errors) on validation errors.
- **Error codes:** validation errors return 422. `CONFLICT` (409) was added for writes that clash with existing data (for example, creating a second business), alongside `INVALID_STATUS_TRANSITION` (409).
- **Authorization (§38):** a resource belonging to another business returns 404, not 403, so its existence isn't revealed.
- **Endpoints beyond the spec:**
  - `POST /api/v1/auth/sign-up` for email-and-password registration.
  - `GET /api/v1/dashboard` for the overview stats, per currency.
  - `DELETE /api/v1/invoices/:id/payments/:paymentId` to undo a mistaken payment.
  - `POST /api/v1/invoices/:id/mark-paid` records a payment for the remaining balance.
  - `POST` and `DELETE` on `/api/v1/{invoices,estimates}/:id/public-link` recreate or revoke the public link.
  - `GET` and `POST` on `/api/v1/{invoices,estimates}/:id/pdf`. GET was added so a plain link can download the file.
  - `POST /api/v1/estimates/:id/reopen` and `POST /api/v1/estimates/:id/duplicate`.
  - `GET /api/v1/estimates/summary` for the estimates page cards (awaiting reply, accepted but not invoiced, won this quarter, average reply time).
  - Estimate conversion takes `{ issueDate, dueDate, send? }`. With `send: true`, the new invoice is sent in the same request. If the invoice can't be sent, nothing is converted.
- **Idempotency:** payments accept an `Idempotency-Key` header. Conversion and state transitions take row locks (`SELECT … FOR UPDATE`), so concurrent requests can't convert an estimate twice or double-count a payment.

## Public documents (§30, §63, §64)

- **Tokens** are `inv_` or `est_` followed by 20 Crockford base32 characters. A revoked link can be replaced with a new token.
- **Accepting and declining estimates** was listed in §30 as future work. It's implemented: `POST /e/:token/accept` and `/e/:token/decline`.
  - Repeating the same answer is harmless, but giving the opposite answer afterwards returns 409.
  - An expired estimate shows its own page, with a PDF download and a way to ask the sender for a new one.
- **One error page:** revoked links, cancelled invoices and unknown tokens all show the same "link no longer works" page, so a link's history isn't disclosed.
- **Rate limits:** public pages, PDFs and replies are limited per IP (60/min). Sign-in is limited per email (5 per 15 min) and sign-up per IP (10 per 15 min). The limiter is in memory (§54: no Redis yet). If the app ever runs on more than one instance, move it to a shared store.

## PDF and templates (§31, §32)

- **Rendering:** PDFs come from headless Chromium (`playwright-core`) printing the same React template used by the editor preview and the public pages. There is one template source, so what the user sees is what the client gets.
- **Fonts** are embedded as base64 (`@fontsource`), so rendering never depends on the network.
- **Templates:** all five templates are built. Free-plan template limits aren't enforced yet (see below).
- **Payment instructions** from Settings print on invoices only. Estimates show "Scope & terms" instead.

## Phasing

- **Pulled into phase 2:** manual payments and "mark as sent", which publishes the public link without emailing it. Phase 4 adds the email itself.
- **Estimate decisions (phase 3):** estimates lock after sending, and conversion requires ACCEPTED.
- **Plan limits (§49, §50):** defined in `src/server/entitlements/plans.ts` and returned by `/api/v1/me`, but not enforced; phase 5 adds enforcement. Until billing exists, everyone is on FREE with an ACTIVE status.
- **Not built yet:** email (phase 4); billing, subscriptions and webhooks (phase 5); logo upload; reports; global search; languages other than English.

## Development environment

- **Database:** Postgres 17 in Docker (port 5434) for development and tests; Neon only in production.
- **Test isolation:** integration and E2E tests run against a dedicated `invoices_test` database, which is migrated with `migrate deploy` and truncated between tests, never reset.

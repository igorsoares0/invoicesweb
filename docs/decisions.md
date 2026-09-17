# Implementation decisions

The product spec (`Invoice Maker — Spec-Driven Development.md`) describes what to build. This file records where the implementation deliberately goes further than the spec or differs from it, and why. When the two disagree, this file wins; don't "fix" the code back to the spec without revisiting the decision here.

Add an entry whenever a phase makes a decision the spec doesn't cover. Section numbers (§) refer to the spec.

Phases 1–4 are done (foundation, invoicing, estimates, email).

## Structure and routes

- **App routes are top level:** `/overview`, `/invoices`, `/invoices/[id]`, `/estimates`, `/estimates/[id]`, `/clients`, `/products`, `/settings`, inside the `(app)` route group, rather than under `/dashboard/*` (§41). URLs stay short, and they match the design handoff.
- **Layout (§41):** `src/lib` holds framework-free code shared by the client and the server (validation, money, dates, status rules). Server-only code lives under `src/server` (`api`, `auth`, `services`, `repositories`, `documents`, `pdf`, `entitlements`). `src/features/documents` holds what invoices and estimates share (editor, templates, detail cards), and `src/features/invoices` and `src/features/estimates` only add what's specific to each.
- **`proxy.ts`** guards pages instead of `middleware.ts`, which is deprecated in Next 16.
- **Onboarding:** after sign-up, users without a business go to `/onboarding` before reaching the app.
- **On a phone, a document screen hides the bottom tab bar** (`/invoices/:id`, `/estimates/:id`). The editor has its own fixed bar with the total and the send button (design g3), and the tab bar would sit on top of it; the header's back link is the way out.

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
- **`EmailLog` (§13) carries four fields the spec doesn't list:** `recipients` (the design's To field takes several addresses, and `recipient` keeps the spec's singular reading as the first of them), `subject`, `attachedPdf`/`copyToSelf` (what the sender chose), and `error` (why it failed, in words meant for the user — the provider's own wording only reaches the logs). A database CHECK constraint enforces that a row belongs to exactly one document, an invoice or an estimate.
- **`EmailStatus` starts at `QUEUED`**, which means the row exists but the provider hasn't answered. Sending is synchronous, so a row that stays QUEUED means the process died mid-send; it is never read as delivered. `DELIVERED`/`OPENED` wait for provider webhooks.
- **Not yet in the schema:** `Subscription` (phase 5).

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

## Email (§13, §39, §40, §71)

- **`/email` is its own endpoint**, next to `/send`. `POST /api/v1/{invoices,estimates}/:id/email` sends a draft first (the existing transition: status, snapshots, public link) and then emails it; `/send` keeps meaning "mark as sent, I'll share the link myself". Two endpoints keep both paths honest and leave the older contract untouched.
- **A provider failure is an outcome, not an error.** The send transition commits before the provider is called, so the document is already sent when an email fails. The route answers 200 with `{ data: { invoice | estimate, email } }` and `email.status` is `SENT` or `FAILED` — the error envelope has no room for data, and the UI needs the document back to offer a retry. Only pre-flight problems throw: unauthenticated (401), not found (404), wrong status (409), invalid input or an unready draft (422), rate limit (429), no transport configured (503 `EMAIL_DISABLED`).
- **A failed PDF takes the same path.** The attachment was asked for, so sending without it would misrepresent what the client received.
- **One action, one history line.** `send()` takes a channel and stores it on the `SENT` event, so a first send reads "Emailed to …" (design b3) and a hand-shared one reads "Marked as sent". `EMAIL_SENT` is only for re-sends; `EMAIL_FAILED` is added whenever an attempt fails, which is what keeps the pair of lines honest.
- **Idempotency (§52):** the `EmailLog` row is created before the send and its id becomes the key (`invoice-email/<id>`). One row per attempt means a retry of *that* attempt can't send twice, while a legitimate re-send with edited text never collides. Keying on the document id would let Resend silently swallow a real re-send within 24h.
- **Re-sending is a new action** (`email` in both status modules), allowed in every status except cancelled invoices, expired estimates (the client can't answer any more) and converted ones. It never re-freezes the snapshot or changes the status. A revoked public link is recreated first, so an email never carries a dead link.
- **Sender:** the sandbox `onboarding@resend.dev` until a domain is verified, with the business name in front of it. `replyTo` is always the business (or account) address — without it, a client's reply would go to the provider.
- **Email sending is not a Pro feature**, though spec §49 lists it as one. The design gives the Free plan five invoices a month that it can actually send, and its pricing table gates only automatic reminders. The dialog shows that reminder toggle disabled with its `PRO` chip, and nothing is persisted for it.
- **A client without an email doesn't block anything.** It isn't an issue in `findIssueProblems`, since that would also block the PDF and "mark as sent"; the dialog opens with an empty To field and a hint, so you can send the document to yourself.
- **The email template shares no CSS with the PDF.** Gmail clips messages near 102 KB, so the email is a small inline-styled table with no embedded fonts — only the data is shared.
- **The email log is not in the shared detail include.** `invoiceDetailInclude` also feeds the public page, which has no business loading recipient addresses; the owner's read uses `invoiceOwnerInclude`/`estimateOwnerInclude`, with an integration test guarding the public payload.
- **Not in this phase:** reminders (manual or scheduled) and the design's working "Send reminder" button; provider webhooks and the `DELIVERED`/`OPENED` states; the Settings → Email sub-page the design lists as "not yet designed" (defaults live in `src/lib/documents/email-text.ts` for now); the plan-limit modal, which needs the phase 5 gating.
- **Test transport:** `EMAIL_TRANSPORT=capture` records emails instead of sending them and is set explicitly by both test runners, because they load `.env` and a real key would otherwise reach the provider. The transport also refuses to build a real client against a `*_test` database. E2E asserts through `EmailLog` — the capture buffer lives in the built server's own process.

## Phasing

- **Pulled into phase 2:** manual payments and "mark as sent", which publishes the public link without emailing it. Phase 4 added the email itself.
- **Estimate decisions (phase 3):** estimates lock after sending, and conversion requires ACCEPTED.
- **Plan limits (§49, §50):** defined in `src/server/entitlements/plans.ts` and returned by `/api/v1/me`, but not enforced; phase 5 adds enforcement. Until billing exists, everyone is on FREE with an ACTIVE status.
- **Not built yet:** billing, subscriptions and webhooks (phase 5); payment reminders; logo upload; reports; global search; languages other than English.

## Development environment

- **Database:** Postgres 17 in Docker (port 5434) for development and tests; Neon only in production.
- **Test isolation:** integration and E2E tests run against a dedicated `invoices_test` database, which is migrated with `migrate deploy` and truncated between tests, never reset.

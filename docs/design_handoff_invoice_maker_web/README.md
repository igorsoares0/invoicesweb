# Handoff: Invoice Maker — web app

## Overview

Invoice Maker is a web app for freelancers and small agencies (2–10 people) to create, send and track invoices and estimates. The core promise from the product spec: **a professional invoice, as a PDF, sent to a client in a few minutes.** One user owns one business; there are no teams and no role-based permissions, so the navigation is deliberately shallow.

This bundle documents the **web** surface only: desktop (1280px), tablet (834px) and phone (390px). Native iOS/Android are out of scope here, though the plan entitlement is shared across platforms (see *Plans & billing*).

This design covers: dashboard, invoice editor (the screen that decides the product), estimates and estimate→invoice conversion, clients, item catalog, payments, settings, reports, the five PDF templates, auth, pricing and checkout, the public client-facing pages, and the phone/tablet layouts.

## About the Design Files

`Invoice Maker Web v2.dc.html` in this folder is a **design reference created in HTML** — a prototype showing intended look, layout and copy. **It is not production code to copy.**

Your task is to **recreate these designs in the target codebase's existing environment**, using its established patterns, component library and conventions. The product spec (`original-spec.md`, included) calls for **Next.js + React + TypeScript + Tailwind + shadcn/ui**; if that stack exists, build with its primitives (`Button`, `Table`, `Dialog`, `Sheet`, `Popover`, `Badge`, `Tabs`) rather than reproducing the inline styles. If no environment exists yet, that spec's stack is the recommended choice.

Two things about the HTML file that are artifacts of the design medium, **not** design intent:

1. **Modals and popovers are laid out as flow cards**, each with its own caption ("Send invoice", "Line adjustments popover", "Record payment", "Convert to invoice", "Folha de edição de linha"). In the real product these are **overlays** — `Dialog` for modals, `Popover` for the line-adjustments control, `Sheet` (bottom) for the phone item editor. They were flattened here so each is legible in isolation.
2. **Phone and tablet frames are fixed-size boxes** (390px / 834px wide). In the product these are breakpoints, not fixed canvases.

The file is a canvas document: sections are ordered newest-first, each with an id badge (`g`, `f`, `e`, `d`, `c`, `b`, `a`, `base`) and each screen with an option id (`a1`, `a2`, `g3`…). Notes under every screen record the decision behind it. Section `base` at the bottom states the direction and the four locked product decisions.

## Fidelity

**High-fidelity.** Final colors, typography, spacing and copy. Recreate the UI faithfully using the codebase's existing libraries. All copy in the designs is the intended production copy, in English (the spec targets English first). Every hex value, font size and spacing value in this README is taken from the design file.

One caveat: notes and the `base` section in the HTML are written in Portuguese — they are commentary for the design review, **not** product copy. Nothing user-facing in the app is Portuguese.

---

## Locked product decisions

These four were explicitly decided with the product owner and the designs depend on them. They have backend consequences.

| Decision | Choice | Consequence in the UI |
|---|---|---|
| **Multi-currency** | Currency is a **label per document**. No conversion, no consolidated cross-currency totals. | The editor header has a Currency field per invoice. Reports show **one currency at a time** via a toggle; the dashboard "Outstanding" card is labelled *USD only*. Never sum across currencies. |
| **Reports across currencies** | Reported **separately per currency**. | `USD / EUR` segmented toggle above the chart; a second line states the other currency's total ("EUR: €14,300 across 4 invoices"). |
| **Numbering** | **Sequential, continuous** (`INV-0044`), never resets by year. Assigned **when the draft is created**, not on send. | The empty editor already shows its number and says so. Settings shows "Next invoice will be INV-0045 · Assigned when the draft is created. Deleting a draft leaves a gap." The send modal says the number is *already* assigned and only the status changes. The invoice history logs "Created — number assigned". |
| **Tax** | **Per line**, in a popover. Only two MVP scenarios: **0%/exempt** (reason required) and **simple European VAT**. No reverse charge, no US sales tax, no withholding, no Brazilian NFS-e. | Line grid has a `VAT` column; the popover offers 0/6/13/23% plus an "Exempt — reason required" checkbox with a free-text reason that prints on the PDF. Item catalog stores a VAT rate per item. |

Also locked from the spec: **status is derived on the server** from `amountPaid` and dates — the client never computes it. Totals are recalculated server-side; the UI mirrors them. Payments are recorded **manually** by the issuer in the MVP (no payment gateway on the invoice), which is why the public invoice page has no "Pay now" button.

---

## Design Tokens

### Colors

| Token | Hex | Use |
|---|---|---|
| Ink | `#18181b` | Primary text, headings, table amounts, dark buttons, total rules |
| Ink 2 | `#3f3f46` | Field labels, body text in dense blocks |
| Ink 3 | `#52525b` | Secondary text, inactive tabs, active nav icon stroke |
| Muted | `#5f5f68` | Explanatory copy, meta text, inactive segmented labels |
| Muted 2 | `#71717a` | Column headers, placeholders, timestamps, row glyphs (`⠿`, `×`, `···`), chevrons |
| Line strong | `#a1a1aa` | Inactive nav icon stroke, separators (`/`, `|`), small chevrons `›` |
| Border | `#e4e4e7` | All card and input borders, dividers, progress track |
| Divider light | `#f4f4f5` | Row separators, chip backgrounds, skeleton fill, active nav pill |
| Surface | `#ffffff` | Cards, sidebar, topbar, documents |
| Canvas | `#f8f8f9` | App background |
| Canvas 2 | `#fafafb` | Subtle row/footer emphasis, zebra rows |
| Canvas 3 | `#fcfcfd` | Draft row tint |
| Document canvas | `#f4f4f5` | Background behind a rendered document (preview pane, public page) |
| **Primary** | `#1e40af` | The only action color: primary buttons, links, active tab underline, logo mark, selection inset, chart current bar |
| Primary tint | `#eff6ff` | "Sent" badge background, Modern template amount block |
| Primary tint 2 | `#e0e7ff` | Client avatar background, Pro badge background |
| Primary tint 3 | `#c7d2fe` | Chart bars (non-current), aging "not due yet" |
| Success | `#15803d` | Paid, accepted, positive delta, accept button |
| Success tint | `#f0fdf4` | Paid/accepted badge and banner background |
| Success ink | `#166534` | Text on success banners |
| Success border | `#bbf7d0` | Accepted banner border |
| Warning | `#b45309` | Discounts, partially paid, exempt VAT, aging 1–30 |
| Warning tint | `#fffbeb` | Partially paid badge, plan-limit usage card |
| Warning border | `#fed7aa` | Plan-limit usage card border |
| Warning ink | `#92400e` | Text on the maxed usage card |
| Danger | `#b91c1c` | Overdue, validation errors, destructive actions |
| Danger tint | `#fef2f2` | Overdue badge, error banner background |
| Danger tint 2 | `#fffafa` | Errored table row background |
| Danger border | `#fecaca` | Error banner border |
| Danger ink | `#991b1b` | Error banner heading text |
| Danger soft | `#fee2e2` | Avatar background when the client is in error |
| Indigo | `#4338ca` | "Viewed" estimate status |
| Indigo tint | `#eef2ff` | "Viewed" badge background |
| Violet | `#6d28d9` | "Converted" estimate status |
| Violet tint | `#f5f3ff` | "Converted" badge background |
| Neutral status | `#5f5f68` on `#fafafa` | "Expired" estimate status |
| Chart amber | `#fcd34d` | Aging 1–30 days |
| Chart red | `#f87171` | Aging 31–60 days |
| Accent options | `#1e40af` `#18181b` `#15803d` `#b45309` `#7c3aed` | Per-document accent swatches |
| Bold template lime | `#d6ff3f` | Bold PDF template accent only |

Status badge pairs (background / text): Draft `#f4f4f5`/`#52525b` · Sent `#eff6ff`/`#1e40af` · Viewed `#eef2ff`/`#4338ca` · Accepted `#f0fdf4`/`#15803d` · Paid `#f0fdf4`/`#15803d` · Partially paid `#fffbeb`/`#b45309` · Overdue `#fef2f2`/`#b91c1c` · Declined `#fef2f2`/`#b91c1c` · Expired `#fafafa`/`#5f5f68` · Converted `#f5f3ff`/`#6d28d9`.

### Typography

**Public Sans** (Google Fonts) — the entire app UI and four of the five PDF templates. Weights 400/500/600/700, plus 300 for the Minimal template's large amount.
**Newsreader** — serif, Classic PDF template only (400/500/600).
**Archivo** — Bold PDF template only (400/500/600/700).
**`ui-monospace, Menlo, monospace`** — document numbers, IBANs, card numbers, tax IDs, timestamps, sidebar counts.

`font-variant-numeric: tabular-nums` is set on every screen and document root — mandatory, per the spec.

App scale (size/weight/line-height):

| Role | Value |
|---|---|
| Screen title (topbar `h1`) | 16px / 600 |
| Breadcrumb document number | 15px / 600 / mono |
| Breadcrumb parent | 13px / 500 / `#71717a` |
| Section/card title | 14px / 600 |
| Body, table cells | 14px / 400 / 1.45 |
| Table cell emphasis (client, amount) | 14px / 500–600 |
| Field label | 12px / 600 / `#3f3f46` |
| Field value | 14px / 400 |
| Column header | 11px / 600 / uppercase / `letter-spacing:.02em` / `#71717a` |
| Section eyebrow | 11px / 600 / uppercase / `letter-spacing:.04em` / `#71717a` |
| Meta, helper | 12–12.5px / 400 / `#5f5f68` or `#71717a` |
| Stat value | 26px / 600 / line-height 1 |
| Stat label | 12px / 500 / `#71717a` |
| Editor total | 22px / 700 |
| Payments hero amount | 30px / 600 |
| Button | 13px / 600 (primary), 13px / 500 (secondary) |
| Badge | 11.5px / 600 |
| Auth heading | 21px / 600; left-column headline 26px / 600 / 1.25 / `-.01em` |
| Pricing headline | 27px / 600 / `-.01em`; price 32px / 700 |

Phone scale: body 15px, section title 16–17px, field label 12px/600, field value 14.5px/500, list card client 15px/600, list card amount 16px/600, hero amount 30–34px/700, bottom-bar total 21px/700, tab label 11px.

### Spacing, radius, shadow

- Spacing steps in use: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 30, 34, 38, 44px.
- Standard page padding: `22px 24px`. Editor content padding: `20px 22px`. Card padding: `14px 16px` (compact) or `18px 20px` / `20px 22px` (prose).
- Radius: `4px` document sheet · `5px` small thumb · `6px` inputs, buttons, chips, badges (non-pill) · `7px` inline callouts · `8px` cards, popovers · `9px` phone cards and buttons · `10px` modals, hero blocks · `11px` empty-state icon tile · `12px` phone document cards · `16px` FAB · `18px 18px 0 0` bottom sheet · `99px` pills · `50%` avatars and dots.
- Shadows: card `0 1px 3px rgba(0,0,0,.06)` · document in preview `0 2px 8px rgba(0,0,0,.06)` · public document `0 2px 10px rgba(0,0,0,.05)` · popover `0 14px 34px rgba(0,0,0,.14)` · modal `0 18px 48px rgba(0,0,0,.22)` · bottom sheet `0 -8px 30px rgba(0,0,0,.14)` · FAB `0 6px 18px rgba(30,64,175,.34)` · segmented active `0 1px 2px rgba(0,0,0,.08)`.
- Focus ring: `border-color:#1e40af` + `box-shadow:0 0 0 3px rgba(30,64,175,.12)`. Error ring: `border-color:#b91c1c` + `box-shadow:0 0 0 3px rgba(185,28,28,.1)`.
- Modal scrim: `rgba(24,24,27,.32)` (documented; flattened in the HTML).

### Control geometry

| Control | Desktop | Phone |
|---|---|---|
| Button height | 32px (topbar/inline), 38–40px (form/modal primary) | 46px |
| Input height | 38px (app), 40px (auth/checkout) | 46px |
| Table row | 52px (list), 50px (editor line), 54–58px (two-line rows, `min-height`) | — |
| Column header row | 36px (list), 38px (editor) | — |
| Topbar | 56px | 54px |
| Sidebar | 230px wide; 60px collapsed (tablet) | — |
| Preview aside | 330px | full width, as a tab |
| Bottom tab bar | — | 62px |
| List row / tappable row | — | ≥44px, enforced |

---

## Screens / Views

Referenced by their id badge in the HTML file.

### `a1` Dashboard — Overview

**Purpose.** Answer "what do I need to do today" in one glance, then get out of the way.

**Layout.** Sidebar 230px + main column. Topbar: `h1` "Overview", right-aligned search (190px) + `New estimate` (secondary) + `+ New invoice` (primary). Content `22px 24px`, `gap:18px`: a 4-up stat grid (`repeat(4,minmax(0,1fr))`, `gap:14px`) then the invoice table filling remaining height.

**Stat cards.** Paid this month `$18,420.00` / "+14% vs August" in `#15803d`; Outstanding `$12,640.00` / "Across 5 invoices · USD only"; Overdue `$3,180.00` in `#b91c1c` / "2 invoices · oldest 21d" in `#b91c1c`; Avg. days to pay `11` / "Net 14 terms". Cents are rendered as a 13px/500 `#71717a` span appended to the 26px value.

**Table.** Header bar 48px: title "Invoices", then filter pills `All · Draft · Sent · Overdue · Paid` (active = `#18181b`/white, 12px/600, `padding:4px 10px`, pill), right-aligned "Due date ↓". Grid `104px minmax(0,1fr) 112px 92px 112px 116px 28px` → Number (13px/500 mono) · Client (`Client · Description`, description in `#71717a`, ellipsis) · Issued · Due (`#b91c1c` + 500 when overdue) · Amount (right, 14px/600) · Status (centered badge) · `···` menu. Rows 52px. Draft row: `#fcfcfd` background, number/client/amount all `#71717a`.

**Footer strip.** `#fafafb`, 13px/500: green dot + "Pine & Co. accepted EST-0014 — INV-0044 is already drafted from it." + `Open draft` primary. This is the only interruption in the table, reserved for accepted-but-uninvoiced work.

**Sidebar.** Business chip (26px `#1e40af` rounded-7 avatar with initial, name 13px/600, "Free plan" 11px `#71717a`), then nav: Overview, Invoices (count 12), Estimates (count 3), Clients, Products, divider, Settings. Active item: `#f4f4f5` pill, 13px/600, icon stroke `#52525b`; inactive `#3f3f46` 13px/500, icon stroke `#a1a1aa`. Counts are 11px mono `#5f5f68`. Usage card pinned to the bottom: "3 of 5 invoices used" 12px/600, "Resets Oct 1", 5px progress track `#e4e4e7` with `#1e40af` fill at 60%, then a full-width `#18181b` "Upgrade to Pro" button (12px/600, `border-radius:6px`).

### `a2` Invoice editor — three states

The most important screen. Same geometry in all three states: left column (header block + item grid) and a 330px preview aside.

**Item grid.** `18px minmax(0,1fr) 42px 76px 48px 42px 78px 16px`, `gap:7px`, columns: drag handle `⠿` (`#71717a`) · Description (14px/500, ellipsis) · Qty · Price · Disc (`#b45309` when set, else `—` in `#71717a`) · VAT · Total (14px/600) · remove `×` (`#71717a`). Rows 50px, separated by `#f4f4f5`. Selected row: `#fafafb` + `box-shadow:inset 2px 0 0 #1e40af`. Below the rows, a 46px action row: `+ Add item` (`#1e40af` 13px/600) `|` `+ From catalog` (`#5f5f68`). Footer: `minmax(0,1fr) 270px` — Notes textarea left, totals right (Subtotal / Discount / VAT / 1px rule / **Total due** 14px/600 label + 22px/700 value / Currency).

**Header block.** `minmax(0,1fr) 148px 148px` — Bill to (client combobox: 22px rounded-5 avatar, name 14px/500, email 13px `#71717a`, `▾`), Issue date, Due date.

**State: working** (`Saved 2s ago` in the topbar). Three lines, second selected. Preview aside shows the rendered document at 9px/1.5 plus an accent-color card (five 24px swatches, selected one ringed `0 0 0 2px #fff, 0 0 0 3.5px #1e40af`). Preview header has template tabs `Modern · Classic · +3`.

**State: new draft, no items** (`Draft created · number assigned`). Client field reads "Search clients…", due date "Pick a date". The grid body is an empty state: two skeleton bars at 55% opacity, "No items yet" 15px/600, explanatory line, `Add first item` + `From catalog ⌘J`, then "INV-0044 is already assigned to this draft — deleting it leaves a gap in the sequence." `Send invoice` is **disabled** (`#e4e4e7` bg, `#5f5f68` text) — disabled, not hidden. Preview renders the skeleton document. Aside card: "The number is taken".

**State: validation blocked.** Error banner above the header block: white card, `border:1px solid #fecaca`, `border-left:3px solid #b91c1c`, heading "Three things to fix before sending" in `#991b1b` with an 18px `#b91c1c` circle `!`, right-aligned "The draft is saved — nothing is lost". Three bullets, each `**problem** — fix`. Then the same errors appear **again in place**: client field with error ring, `no email` in `#b91c1c`, helper "Add an email to send by email"; due date field errored with "Must be on or after Sep 12"; line 2 with `#fffafa` background, `—` price in `#b91c1c`/600, followed by a 34px sub-row (padded `0 16px 0 39px`) "Unit price is required — the server rejects the line otherwise". **Both `Download PDF` and `Send invoice` are disabled; editing is never blocked.** Aside card: "Why the preview still renders".

### `a3` Overlays (documented as flow cards)

**Line adjustments popover** (268px, `Popover` on the Disc/VAT cells). "Line adjustments" 12.5px/600; Discount as a 2-up toggle `10 %` (active `#18181b`) / `$ fixed`; VAT rate chips `0% 6% 13% 23%`; an "Exempt — reason required on the PDF" checkbox; a reason input pre-filled "Art. 53 CIVA — small business exemption"; and a `#fafafb` result line "6 × $140 − 10% = **$756.00** · no VAT". The arithmetic is spelled out because the server owns the calculation and the user must be able to check it.

**Send invoice modal** (560px `Dialog`). Header "Send invoice" 17px/600 + "INV-0044 · $6,996.00 · due Sep 26". Fields: To (token chip `billing@pineco.com ×` + "+ Add recipient"), Subject (pre-filled "Invoice INV-0044 from Alvorada Studio"), Message (pre-filled body; helper "Client name, amount, due date and the view button are filled by the template"). Three toggles (34×20px pill, 16px knob): Attach the PDF (on), Send me a copy (on), "Remind me if unpaid after the due date" (off, with a `PRO` chip — visible, not hidden). Footer `#fafafb`: "The number **INV-0044** is already assigned. On send the status becomes Sent." + `Cancel` / `Send invoice`.

**Plan limit modal** (470px `Dialog`). "You've used all 5 invoices this month"; "This draft is safe and stays editable. Sending it needs either Pro or a wait until **October 1**." A bordered Pro block ($9/mo) listing: nothing already sent changes, cancel any time, cross-platform entitlement. Footer: "Keep as draft" as plain text left, `Copy public link` + `Upgrade to Pro` right. **The gate fires on send, never on create.** When the limit is reached the sidebar usage card switches to the warning palette (`#fffbeb` bg, `#fed7aa` border, `#92400e` text, full `#b45309` bar, "See Pro").

### `b1` Clients

Table + detail aside (340px), no separate route for reading a client. Grid `minmax(0,1fr) 96px 116px 100px 28px`: Client (avatar + name 14px/600 over email 12px `#71717a`) · Invoices (count) · Outstanding (14px/600, `#71717a` when `$0.00`) · Activity (`#b91c1c` when overdue) · `···`. Rows `min-height:56px` with `padding:9px 16px`. Last row is the inline action "+ New client · Import from CSV".

Aside: 40px avatar + name + "Client since Mar 2026" + `Edit`; two mini stat cards (Outstanding `$6,400.00`, Paid lifetime `$19,700.00` — both aggregates, not stored fields); Details key/value card; Invoices card with badges; bottom `New invoice` + `New estimate` (the primary carries the client through to the editor).

### `b2` Items & services

Same table+aside pattern. Grid `minmax(0,1fr) 96px 120px 72px 28px`: Item (name + description) · Unit ("per month") · Price · VAT (`Exempt` shown in `#b45309`) · `···`. Rows `min-height:58px`.

Aside is an edit form: Name, Description, Unit + Unit price, VAT rate + Currency, then a `#fafafb` callout **"Changing the price is safe — invoices already issued keep the price they were sent with. New invoices pick up $5,200.00."** Footer: `Save item`, `Duplicate`, and `Delete` as right-aligned `#b91c1c` text.

### `b3` Payments

Invoice detail for a partially paid invoice. Hero card: Amount due `$2,260.00` (30px/600), Paid `$2,000.00` (`#15803d`), Total `$4,260.00`, a "47% collected" progress bar (6px, `#15803d` fill), and Due date right-aligned.

Payments table: grid `112px minmax(0,1fr) 130px 110px 28px` — Date · Method · reference (reference in mono `#71717a`) · Amount · By · `···`. One row. Below it, an inline note: amber dot + "$2,260.00 still open. Recording the rest flips this invoice to **Paid** automatically." Footer: **History** timeline (colored dot + label + right-aligned mono timestamp) reading Payment added → Viewed by client → Emailed → **Created — number assigned**. This is the spec's `InvoiceEvent` surfaced.

Aside (290px): Invoice facts, Actions (`Send reminder`, `Download PDF`, `Duplicate`, then `Cancel invoice` in `#b91c1c`), Public link (mono `#1e40af`, "Copy · Open · Revoke").

**Record payment modal** (456px `Dialog`): Amount pre-filled with the **full open balance** in a focused split field (`USD $` prefix segment + value 15px/600) + Date; Method as five chips (Bank transfer active); optional Reference; and a `#f0fdf4` confirmation strip "This closes the balance — status becomes Paid." before the buttons. The UI predicts the server-derived status rather than computing it.

### `b4` Settings

Sub-navigation 196px: Business profile (active), Invoice defaults, Templates, Email, Plan & billing. Content max-width 740px.

*Business profile* — logo dropzone (74px, dashed `#d4d4d8`, "Drop logo") with `Upload` / `Remove` and the note "PNG or SVG, at least 240px wide. Top-left on every template."; then a 2-up field grid: Business name, Tax ID / VAT, Email, Phone, Address (full width).

*Invoice defaults* — 3-up grid: Number prefix, Next number, Estimate prefix, Default currency, Default VAT, Payment terms. Below: `#fafafb` strip "Next invoice will be **INV-0045** · Assigned when the draft is created. Deleting a draft leaves a gap." The numbering rule is the one surprise in the model, so it is stated where it is configured.

### `b5` Reports

`minmax(0,1fr) 360px`. Left: "Paid per month" with a `USD / EUR` segmented toggle, total `$82,100` right-aligned, the line "Each currency is reported on its own — nothing is converted, so nothing is guessed. EUR: €14,300 across 4 invoices.", and a 6-bar column chart (current month `#1e40af`, others `#c7d2fe`, `border-radius:5px 5px 0 0`, value above, month below). Right: "Outstanding by age" (four labelled bars: not due `#c7d2fe`, 1–30 `#fcd34d`, 31–60 `#f87171`, 60+ `#b91c1c`; total row; plus "In EUR, separately €3,180.00") and "Top clients" (avatar + name + amount + share) ending with "Basic reporting only — revenue, outstanding and paid. Deeper reports are post-MVP."

### `c1` Estimates

Four stat cards framed around **the reply**, not the document: Awaiting reply `$9,630`, Accepted-not-invoiced `$6,996` (value in `#15803d`), Won this quarter `62%`, Avg. reply time `4 days`. Filter pills cover all seven statuses. Grid `100px minmax(0,1fr) 96px 100px 112px 116px 28px` with Expires in `#b91c1c` when expired. Footer strip pushes the only state that is money sitting still: "EST-0014 was accepted 2 days ago and hasn't been invoiced yet." + `Convert to invoice`.

### `c2` Estimate editor + conversion

Deliberately the **same editor as the invoice** — same item grid, same totals block — with `Due date` replaced by `Expires` (showing "Sep 22" + "14 days") and Notes replaced by `Scope & terms`. One layout to learn.

Aside (300px): a `#f0fdf4`/`#bbf7d0` "Accepted by client" banner with `Convert to invoice`; a Status timeline (Accepted → Viewed → Sent → Created); a "Record the reply yourself" pair (`Mark accepted` / `Mark declined`) for replies that arrive by phone or email; and the public link.

**Convert modal** (480px): "EST-0014 stays untouched and is marked **Converted**."; a preview block (`INV-0045` + Draft badge + `$6,996.00`; Client, "3 lines, prices locked", "Notes & terms carried over"); Issue date + Due date; two checkboxes ("Open the new invoice after converting" checked, "Send it to the client right away" unchecked); and the note "The invoice gets its number **now**, at creation — not on send."

### `d1` Public invoice — `/i/{token}`

760px card, `#f4f4f5` canvas, `padding:26px`. Action bar: `Invoice sent` badge + "Due in 14 days" + `Print` / `Download PDF`. Then the document (white, radius 4, `padding:34px 32px`): logo + issuer block left, `INVOICE` 20px/700 + mono number right; a 3-up row (Bill to / Issued+terms / **Amount due** 22px/700 right-aligned with "by Sep 26, 2026"); line table under a 2px `#18181b` rule; then payment instructions left and totals right, total separated by a 1px `#18181b` rule. Closing line "Questions? Reply to hello@alvorada.studio". **No "Pay now"** — payment is recorded manually by the issuer in the MVP.

### `d2` Public estimate — `/e/{token}`

Same document treatment, `ESTIMATE` in the corner, "Valid until Sep 22, 2026" under the total. **Above** the document, a decision bar: "Does this look right?" + "Accepting doesn't charge you — Alvorada will send an invoice with these prices." + `Decline` (neutral) / **`Accept estimate`** (`#15803d`). The reassurance is load-bearing; without it clients hesitate and phone. Declining is neutral, never red — a refusal is not an error.

### `d3` Dead links

Two 620px centered cards, max-width 460px, tone scaled to risk.

*Expired* — neutral `#f4f4f5` tile with `—`, "This estimate has expired", "EST-0012 was valid until August 26, 2026. Prices may have changed since, so it can't be accepted from this link anymore.", `Download the PDF` / `Ask for a new one`.

*Revoked* — `#fef2f2` tile with `×` in `#b91c1c`, "This link no longer works", **"The sender revoked it, or the document was cancelled. If you were about to pay something, check with them before sending money."**, `Contact hello@…`, footer "Nothing was charged and no data was shared." This is the invoice-fraud scenario; the warning is explicit on purpose.

### `e1` The five PDF templates

Each A4 (620px wide, `min-height:876px` ≈ 1:1.414), `box-sizing:border-box`, tabular numerals, all rendering the same invoice.

All five carry the same information in the same order — issuer, payer, how much and when, lines, totals, how to pay — and differ only in typography, density and where the amount lands.

1. **Modern** — Public Sans. `padding:52px 50px`. Rounded logo 42px `#1e40af`; "Invoice" 26px/700; the amount due sits in an `#eff6ff` rounded-10 block with the due date opposite; 2px `#18181b` header rule; totals right with a 2px top rule; footer 2-up How to pay / Notes.
2. **Classic** — Newsreader for the masthead, name, total and closing line; Public Sans for labels and data. `padding:48px 52px`. Centered masthead over a **3px double** `#18181b` rule; "Invoice" 15px letter-spaced `.22em`; a right-hand meta list with 1px underlines; total wrapped in 1px-top/3px-double-bottom rules; italic "Thank you for your business."
3. **Minimal** — Public Sans, `padding:58px 56px`, no rules at all. Name and number on one baseline; then `Amount due` in 11px `.14em` caps and the value at **42px/300**; three-column From / To / Issued; 10px `.14em` caps column headers; totals with a single hairline above the total.
4. **Professional** — the densest, for filing. `padding:44px 48px`. Full-bleed `#f4f4f5` header band (negative margins) with logo + issuer + `INVOICE` letter-spaced; a 3-cell bordered facts strip (Bill to / Dates / Amount due); table with an `#18181b` header row in white text, a `#` index column, zebra `#fafafa` rows, and an **inverted `#18181b` total cell**; two bordered footer boxes; a centered registration line.
5. **Bold** — Archivo. `padding:46px 46px`. Full-bleed `#18181b` masthead: lime `#d6ff3f` rounded logo, `INVOICE` 28px/700, amount due 38px/700 in `#d6ff3f`, due date and number alongside. Body in Archivo with a 3px `#18181b` header rule; total in a `#18181b` rounded-8 block with the figure in lime.

### `e2` Template picker (in the editor)

Card with "Template" + "Applies to this invoice only · changing it never alters what you already sent". Five `1/1.414` thumbnails in `repeat(5,minmax(0,1fr))`, each a schematic of its template (Professional gets a grey header band, Bold a dark one with a lime tick). Selected = `box-shadow:0 0 0 2px #1e40af`. Labels 12.5px, with a `PRO` chip on Minimal, Professional and Bold — **two templates on Free, three on Pro.** Below a hairline: "Accent color" + five 22px swatches + the honest caveat "Minimal and Classic ignore the accent by design."

### `f1` / `f2` Auth

Split layout, 740px tall. Left 470px on `#f8f8f9`: wordmark, headline "Send your first invoice in the next five minutes." (26px/600/1.25), subhead about the free plan, three check bullets, and pinned to the bottom a **miniature invoice card** (amount `$2,400.00` 24px/700 + skeleton lines) — the product is the document, so the promise shows a document, not an illustration. Right column centers a 352px form.

*Sign up* — `Continue with Google` (full-width 40px secondary, 4-color Google glyph) first, `or` divider, then **only** Work email + Password with a 4-segment strength meter (3 filled `#15803d`) and "Strong — 12 characters, mixed case", `Create account`, and a legal line ending "We email you about your invoices, not about features." Business name is collected in onboarding, not here.

*Sign in* — same Google-first order, plus an error banner: "That email and password don't match. Two attempts left before a short lockout." — it does **not** say which field was wrong (no account enumeration) but does disclose remaining attempts. Password field errored. "Keep me signed in" checked + "Forgot password?". Footer handles the most common support case: "Signed up with Google before? Use the button above — the password field won't work for that account."

### `f3` Pricing

Centered headline "One price, everything unlocked" + Monthly / Yearly `−20%` toggle. Two cards (`1fr 1fr`, max-width 720px): **Free** `$0` with four features and, instead of a button, a `#fafafb` "Your current plan" plate — so the page has exactly one action; **Pro** `$9` with a 2px `#1e40af` border, a "Most picked" pill beside the title, five features, `Upgrade to Pro`, and "Cancel any time · handled by Paddle". Then a 9-row comparison table (`minmax(0,1fr) 130px 130px`, zebra) which **also lists what Free has without limit** (unlimited clients and items, public link) — hiding that would make Free look unusable and Pro look like a hostage fee. Footer row: cross-platform entitlement + `Restore purchase`.

### `f4` Checkout and billing

*Checkout* (520px, Paddle). Header "Upgrade to Pro / Secure checkout by Paddle". A summary block: "Pro — monthly $9.00", **VAT (PT 23%) $2.07**, "Total today **$11.07**", "Then $11.07 on the 12th, monthly". Method chips Card / PayPal / Apple Pay. Card number (mono, focused), Expiry + CVC, Country + optional VAT number. `Pay $11.07 and upgrade`. Closing line names Paddle as merchant of record. The VAT and the real charge are shown **before** the button because the final figure differs from the advertised $9 and that surprise produces chargebacks.

*Plan & billing* (1000px). Pro badge; a 3-cell strip (Next charge $11.07 / Oct 12, Payment method •••• 4242, Invoices this month 23 / "No limit on Pro"); actions `Update payment method`, `Switch to yearly (−20%)`, and **`Cancel subscription` visible** in `#b91c1c`, not buried. Receipts table with Paid badges and "Receipts come from Paddle and include VAT for your accountant."

### `g1`–`g5` Responsive

**`g1` Rules.** Four bands: **≤640 mobile** (one column; tables become cards; preview becomes a tab; actions move to a fixed bottom bar) · **641–1023 tablet** (sidebar collapses to icons; item table survives; preview becomes an on-demand panel) · **1024–1279 laptop** (full sidebar; two-column editor with a narrow preview) · **≥1280 desktop** (as documented above). Only two elements need real redesign — the item table and the side-by-side preview. Everything else is a single column that already reflows. **44px minimum touch target on phone**, which is what forces cards instead of 32px rows.

**`g2` Phone invoice list** (390px). Topbar with search + Filter. A fixed header block: "Outstanding · USD" + `$12,640.00` (30px/600) + a horizontal filter chip row. Then invoice cards (radius 9, `padding:13px 14px`): client 15px/600 and amount 16px/600 on the first line; number (mono 12.5px), status text (colored) and badge on the second. Bottom tab bar 62px: Invoices / Estimates / Clients / More.

**`g3` Phone editor.** Topbar `‹ INV-0044` + "Saved". `Edit` / `Preview` tabs (active underlined `inset 0 -2px 0 #1e40af`) with the Draft badge right-aligned. Header fields become a tappable list (each row ≥48px, label left, value right, `›`). Items become cards: description 14.5px/500 on top, `12 × $320.00` and `$3,840.00` with a `›` below. `+ Add item` / `From catalog` as two 46px buttons. A totals card. **Fixed bottom bar**: "Total due / $6,996.00" (21px/700) beside a 190px `Send invoice` — the amount never leaves the screen while sending.

*Line edit sheet* (`Sheet`, side="bottom", radius `18px 18px 0 0`, 38×4px grabber). "Edit item" + `Remove` in `#b91c1c`; Description (46px, focused); **Qty as a stepper** (44px `−` / value / 44px `+` — two buttons beat a numeric keyboard); Unit price with a `USD` suffix; Discount + VAT; a `#f4f4f5` result strip "6 × $140 − 10% → $756.00"; `Cancel` / `Save item` as two 46px buttons.

**`g4` Phone public invoice.** The most-viewed screen in the product — clients open the link on a phone, from email. Stacked cards on `#f4f4f5`: issuer chip; hero (Amount due 34px/700, "by September 26, 2026 · Net 14", number + Sent badge); Items card with `qty × price` and line amounts, then Subtotal/Discount/Total due; How to pay card with the **IBAN in a `#f4f4f5` strip and a `Copy` action** (nobody transcribes an IBAN by hand); issuer legal block last, where an accountant looks. Fixed bottom bar: `Print` / `Download PDF`.

**`g5` Tablet editor (834px).** 60px icon sidebar; topbar with `Edit`/`Preview` segmented control + `Send invoice`. Header block collapses to `minmax(0,1fr) 132px` (Bill to + Due date). Item grid drops to `minmax(0,1fr) 44px 80px 86px 20px` — **Disc and VAT leave the columns and live in the per-line popover**. A footer strip states the tradeoff and offers `Open preview`. The sidebar collapses to icons rather than becoming a drawer: four destinations don't justify a hidden menu.

---

## Interactions & Behavior

**Navigation.** Sidebar destinations: Overview, Invoices, Estimates, Clients, Products, Settings. `/invoices/:id` and `/estimates/:id` are editors; clients and products use an inline detail aside instead of a detail route. Public routes `/i/{token}` and `/e/{token}` are unauthenticated.

**Invoice lifecycle.** Create draft (**number assigned here**) → edit → send (status → Sent) → client opens link (→ Viewed) → payments recorded manually (→ Partially paid → Paid) → past due with a balance (→ Overdue). Cancel is available from the detail aside. All transitions are **derived server-side**; the client renders what it is told and only *predicts* in copy ("This closes the balance — status becomes Paid").

**Estimate lifecycle.** Draft → Sent → Viewed → Accepted / Declined / Expired → Converted. Accept and decline happen either on the public page or by the issuer recording it manually. Conversion creates a new draft invoice (numbered at creation), copies lines with prices locked, carries notes and terms, and marks the estimate Converted while leaving it otherwise untouched.

**Validation.** Blocks **send** and **PDF** only — never editing, and never autosave. Each error appears twice: in a summary banner (how many remain) and on the field or row (where it is). Rules visible in the design: client must have an email to send by email; every line needs a unit price; due date must be on or after the issue date; exempt VAT requires a reason. Mirror the API's `VALIDATION_ERROR` rather than reimplementing rules client-side.

**Plan gating.** Free: 5 invoices/month, 3 open estimates, 2 templates, no logo, no accent color, no reminders, no CSV export. The gate fires **on send**, not on create: the user builds the invoice, then hits the door. The sidebar usage card switches to the warning palette at the limit. Pro purchased in the mobile apps unlocks the web (`Restore purchase`).

**Autosave.** The editor autosaves; the topbar reports "Saved 2s ago" / "Saved" / "Draft created · number assigned". No explicit save button in the editor.

**Keyboard.** `⌘J` opens the catalog picker from the editor; `⌘K` search; `⌘N` new client from the client combobox. Shown as hints in the UI.

**States to build beyond the happy path** (designed for the editor; **still to be designed** for the other screens — see *Not yet designed*): empty, loading skeleton, validation error, plan-limited, expired link, revoked link, cancelled document.

**Responsive.** Per `g1`. The two structural changes are the item table (→ cards on phone; → fewer columns on tablet) and the preview (→ tab).

## State Management

Server state (fetch/cache — React Query or the codebase's equivalent):

- `business` — profile, logo, defaults (prefixes, next number, currency, VAT, terms), plan and usage counters.
- `invoices` — list with filters (status, search, sort) and pagination; detail with `items[]`, `payments[]`, `events[]`, derived `status`, `amountPaid`, `totals`, `publicToken`.
- `estimates` — same shape plus `expiresAt`, `acceptedAt`, `convertedInvoiceId`.
- `clients` — list plus derived `outstanding` and `paidLifetime` aggregates.
- `products` — catalog items with `unit`, `unitPrice`, `vatRate`, `currency`.
- `reports` — revenue by month **per currency**, aging buckets, top clients.
- `subscription` — plan, next charge, payment method, receipts (from Paddle).

Client state:

- Editor: draft entity + dirty flag + autosave status; selected line; open popover (line id + anchor); selected template and accent; currency.
- Lists: active status filter, search term, sort key.
- Overlays: send modal (recipients, subject, body, attachPdf, sendCopy, reminder), record-payment modal (amount defaulted to the open balance, date, method, reference), convert modal (issue date, due date, openAfter, sendNow).
- Validation: server error map keyed by field and line id, rendered in both the banner and the field.
- Phone: active editor tab (Edit/Preview), open bottom sheet (which line).

**Totals and status are never computed client-side** beyond optimistic display — recalculate on the server and render the response.

## Assets

- **Fonts** — Public Sans, Newsreader, Archivo, all from Google Fonts. Loaded in the design via one `<link>`; in production, self-host or use the codebase's font pipeline. Mono is the system stack `ui-monospace, Menlo, monospace`.
- **Icons** — all hand-written inline SVG in the design (16px, `viewBox="0 0 18 18"`, `stroke-width:1.4`, round caps and joins): grid/overview, document, estimate, user, box, cog, search, three-dot. **Replace with the codebase's icon set** (Lucide matches the weight and metrics closely). The only multi-color icon is the Google `G` in auth, which is the official 4-color mark and should keep its exact fills: `#4285f4` `#34a853` `#fbbc04` `#ea4335`.
- **Logos** — the "Alvorada Studio" mark is a placeholder: a 26–42px `#1e40af` rounded square with the letter `A`. Real businesses upload their own logo (Settings → Business profile). Client avatars are the same pattern in `#e0e7ff`/`#1e40af`.
- **No raster images anywhere.** Skeletons and document placeholders are plain divs.
- **All data is fictional** — Alvorada Studio, Halcyon Labs, Northwind Café, Mercado Vivo, Pine & Co., Vale Coffee, Ruan Media, the IBAN, the tax IDs and the `4242` card. Copy that is *instructional* (helper text, empty states, error messages, the notes that explain numbering and currency) **is production copy** and should be carried over.

## Not yet designed

Flag these before you estimate — they are missing, not implied:

- Empty states for invoices, clients, items, estimates and reports; loading skeletons; onboarding (3 steps); cancelled invoice as the client sees it. *(These exist in the earlier design file in the project, `Invoice Maker Web.dc.html`, but that file has a known structural defect — overlays detached from their parents — so treat it as content reference only, never as layout truth.)*
- Estimate editor on phone.
- Settings → **Templates**, **Email**, and **Plan & billing** as sub-pages. Billing content exists in `f4` but sits outside the settings navigation.
- Empty and error states on phone.
- Forgot-password / password-reset flow.
- Marketing site.

## Files

| File | What it is |
|---|---|
| `Invoice Maker Web v2.dc.html` | **The design.** Open it in a browser. Sections newest-first: `g` responsive · `f` auth & plans · `e` PDF templates · `d` public pages · `c` estimates · `b` operations · `a` core app · `base` direction & decisions. |
| `support.js` | Runtime required by the HTML file to render. Not part of the design; do not port. |
| `original-spec.md` | The product spec this design was built from — data model, API surface, status machine, plan limits, phasing. Read it alongside this README. |
| `screenshots/` | PNG of every screen at 2×, named `<id>-<screen>.png` matching the ids used throughout this README. |

The HTML is a single self-contained design document; there is no CSS or JS to lift. Every value you need is in this README or inline in that file. Each screen card in the HTML carries an id of the form `shot-<id>-<n>` if you need to re-capture one.

### Screenshot index

| File | Screen | Section |
|---|---|---|
| `a1-dashboard.png` | Dashboard — Overview | `a1` |
| `a2-editor-working.png` | Invoice editor, working | `a2` |
| `a2-editor-empty.png` | Invoice editor, new draft with no items | `a2` |
| `a2-editor-validation.png` | Invoice editor, validation blocking send | `a2` |
| `a3-popover-line-adjustments.png` | Line adjustments popover (discount, VAT, exemption) | `a3` |
| `a3-modal-send-invoice.png` | Send invoice modal | `a3` |
| `a3-modal-plan-limit.png` | Plan limit reached on send | `a3` |
| `b1-clients.png` | Clients, list + detail aside | `b1` |
| `b2-items-catalog.png` | Items & services catalog | `b2` |
| `b3-payments.png` | Invoice detail, partially paid | `b3` |
| `b3-modal-record-payment.png` | Record payment modal | `b3` |
| `b4-settings.png` | Settings — business profile + invoice defaults | `b4` |
| `b5-reports.png` | Reports, one currency at a time | `b5` |
| `c1-estimates.png` | Estimates list | `c1` |
| `c2-estimate-editor.png` | Estimate editor, accepted | `c2` |
| `c2-modal-convert.png` | Convert to invoice modal | `c2` |
| `d1-public-invoice.png` | Public invoice `/i/{token}` | `d1` |
| `d2-public-estimate.png` | Public estimate `/e/{token}` with accept bar | `d2` |
| `d3-link-expired.png` | Expired estimate link | `d3` |
| `d3-link-revoked.png` | Revoked link | `d3` |
| `e1-template-1-modern.png` | PDF template — Modern | `e1` |
| `e1-template-2-classic.png` | PDF template — Classic | `e1` |
| `e1-template-3-minimal.png` | PDF template — Minimal | `e1` |
| `e1-template-4-professional.png` | PDF template — Professional | `e1` |
| `e1-template-5-bold.png` | PDF template — Bold | `e1` |
| `e2-template-picker.png` | Template picker in the editor | `e2` |
| `f1-sign-up.png` | Sign up | `f1` |
| `f2-sign-in-error.png` | Sign in with error | `f2` |
| `f3-pricing.png` | Pricing | `f3` |
| `f4-checkout.png` | Paddle checkout | `f4` |
| `f4-plan-billing.png` | Settings — plan & billing | `f4` |
| `g1-breakpoints.png` | Breakpoint rules | `g1` |
| `g2-phone-invoice-list.png` | Phone — invoice list | `g2` |
| `g3-phone-editor.png` | Phone — invoice editor | `g3` |
| `g3-phone-line-sheet.png` | Phone — line edit bottom sheet | `g3` |
| `g4-phone-public-invoice.png` | Phone — public invoice | `g4` |
| `g5-tablet-editor.png` | Tablet 834px — invoice editor | `g5` |

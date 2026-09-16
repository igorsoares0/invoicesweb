/**
 * Print styles for the five document templates. Plain CSS (not Tailwind) so the exact same rules
 * can be injected into the editor preview, the public page and the headless-Chromium PDF.
 * Every template is laid out on a 620px-wide A4 page (the design's canvas); the PDF scales it up.
 */
export const DOCUMENT_CSS = /* css */ `
.doc {
  --doc-sans: var(--font-public-sans, "Public Sans"), ui-sans-serif, system-ui, sans-serif;
  --doc-serif: var(--font-newsreader, "Newsreader"), Georgia, serif;
  --doc-grotesk: var(--font-archivo, "Archivo"), var(--doc-sans);
  --doc-mono: ui-monospace, Menlo, "DejaVu Sans Mono", monospace;
  --doc-ink: #18181b;
  --doc-muted: #5f5f68;
  --doc-muted-2: #71717a;
  --doc-line: #e4e4e7;
  --doc-divider: #f0f0f1;
  --doc-accent: #1e40af;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 620px;
  min-height: 877px;
  background: #fff;
  color: var(--doc-ink);
  font-family: var(--doc-sans);
  font-size: 12px;
  line-height: 1.55;
  font-variant-numeric: tabular-nums;
  text-align: left;
  overflow-wrap: anywhere;
}
.doc *, .doc *::before, .doc *::after { box-sizing: border-box; margin: 0; padding: 0; }
.doc table { width: 100%; border-collapse: collapse; }
.doc thead { display: table-header-group; }
.doc tr { break-inside: avoid; }
.doc .mono { font-family: var(--doc-mono); letter-spacing: 0; }
.doc .muted { color: var(--doc-muted); }
.doc .num { text-align: right; white-space: nowrap; }
.doc .strong { font-weight: 600; }
.doc .label { font-size: 9.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--doc-muted-2); margin-bottom: 4px; }
.doc .adjust { color: var(--doc-muted-2); }
.doc .exempt-tag { color: #b45309; font-size: 10.5px; }
.doc .pre { white-space: pre-line; }
.doc .spacer { flex: 1 0 14px; }
.doc .avoid { break-inside: avoid; }
.doc .logo { display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; font-weight: 700; color: #fff; }
.doc .logo img { width: 100%; height: 100%; object-fit: contain; }
.doc .totals { margin-left: auto; width: 50%; }
.doc .totals-row { display: flex; justify-content: space-between; gap: 16px; padding: 2px 0; }
.doc .totals-row > :first-child { color: var(--doc-muted); }
.doc .footnotes { margin-top: 10px; font-size: 10.5px; color: var(--doc-muted); }

/* Modern ---------------------------------------------------------------- */
.doc-modern { padding: 46px 50px 40px; }
.doc-modern .head { display: flex; justify-content: space-between; align-items: flex-start; }
.doc-modern .logo { width: 42px; height: 42px; border-radius: 9px; background: var(--doc-accent); font-size: 18px; }
.doc-modern .issuer-name { margin-top: 14px; font-size: 15px; font-weight: 600; }
.doc-modern .title { font-size: 26px; font-weight: 700; line-height: 1.1; text-align: right; }
.doc-modern .title-number { margin-top: 4px; text-align: right; font-size: 11px; color: var(--doc-muted); }
.doc-modern .due-block { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-top: 26px; padding: 16px 20px; border-radius: 10px; background: color-mix(in srgb, var(--doc-accent) 8%, #fff); }
.doc-modern .due-block .label { color: var(--doc-accent); }
.doc-modern .due-amount { font-size: 29px; font-weight: 700; line-height: 1.1; }
.doc-modern .due-date { text-align: right; }
.doc-modern .due-date strong { display: block; font-size: 15px; font-weight: 600; }
.doc-modern .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 22px; }
.doc-modern .party-name { font-size: 14px; font-weight: 500; }
.doc-modern .lines { margin-top: 22px; }
.doc-modern .lines th { padding: 0 0 8px; border-bottom: 1px solid var(--doc-ink); font-size: 9.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--doc-muted-2); }
.doc-modern .lines td { padding: 10px 0; border-bottom: 1px solid var(--doc-divider); vertical-align: top; }
.doc-modern .lines td + td, .doc-modern .lines th + th { padding-left: 12px; }
.doc-modern .totals { margin-top: 12px; }
.doc-modern .grand { margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--doc-ink); align-items: baseline; }
.doc-modern .grand > :first-child { color: var(--doc-ink); font-size: 13.5px; font-weight: 600; }
.doc-modern .grand > :last-child { font-size: 20px; font-weight: 700; }
.doc-modern .foot { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

/* Classic --------------------------------------------------------------- */
.doc-classic { padding: 48px 52px; }
.doc-classic .masthead { text-align: center; padding-bottom: 20px; border-bottom: 3px double var(--doc-ink); }
.doc-classic .issuer-name { font-family: var(--doc-serif); font-size: 21px; font-weight: 600; }
.doc-classic .masthead .issuer-line { margin-top: 4px; font-size: 11px; color: var(--doc-muted); }
.doc-classic .title { margin: 26px 0 20px; text-align: center; font-family: var(--doc-serif); font-size: 15px; letter-spacing: .22em; text-transform: uppercase; }
.doc-classic .parties { display: grid; grid-template-columns: 1fr 200px; gap: 40px; }
.doc-classic .party-name { font-family: var(--doc-serif); font-size: 15px; font-weight: 500; }
.doc-classic .meta div { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--doc-line); }
.doc-classic .meta dt { color: var(--doc-muted); }
.doc-classic .meta dd { text-align: right; }
.doc-classic .lines { margin-top: 26px; border-top: 1px solid var(--doc-ink); }
.doc-classic .lines th { padding: 9px 0; border-bottom: 1px solid var(--doc-ink); font-size: 9.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--doc-muted); }
.doc-classic .lines td { padding: 10px 0; border-bottom: 1px solid var(--doc-line); vertical-align: top; }
.doc-classic .lines td + td, .doc-classic .lines th + th { padding-left: 12px; }
.doc-classic .totals { margin-top: 14px; width: 45%; }
.doc-classic .grand { margin-top: 6px; padding: 8px 0 6px; border-top: 1px solid var(--doc-ink); border-bottom: 3px double var(--doc-ink); align-items: baseline; }
.doc-classic .grand > :first-child { color: var(--doc-ink); }
.doc-classic .grand > :last-child { font-family: var(--doc-serif); font-size: 20px; }
.doc-classic .thanks { margin-top: 18px; text-align: center; font-family: var(--doc-serif); font-style: italic; color: var(--doc-muted); }

/* Minimal --------------------------------------------------------------- */
.doc-minimal { padding: 58px 56px; }
.doc-minimal .label { font-weight: 500; letter-spacing: .14em; }
.doc-minimal .head { display: flex; justify-content: space-between; align-items: baseline; }
.doc-minimal .issuer-name { font-size: 13px; }
.doc-minimal .due { margin-top: 48px; }
.doc-minimal .due-amount { font-size: 42px; font-weight: 300; line-height: 1.1; letter-spacing: -.01em; }
.doc-minimal .parties { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; }
.doc-minimal .lines { margin-top: 38px; }
.doc-minimal .lines th { padding-bottom: 12px; font-size: 9.5px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--doc-muted-2); }
.doc-minimal .lines td { padding: 7px 0; vertical-align: top; }
.doc-minimal .lines td + td, .doc-minimal .lines th + th { padding-left: 12px; }
.doc-minimal .totals { margin-top: 24px; width: 42%; }
.doc-minimal .grand { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--doc-line); }
.doc-minimal .grand > :first-child { color: var(--doc-ink); }

/* Professional ---------------------------------------------------------- */
.doc-professional { padding: 0 48px 36px; }
.doc-professional .band { display: flex; justify-content: space-between; gap: 20px; margin: 0 -48px; padding: 30px 48px 20px; background: #f4f4f5; border-bottom: 1px solid var(--doc-line); }
.doc-professional .band-issuer { display: flex; gap: 14px; }
.doc-professional .logo { width: 38px; height: 38px; border-radius: 6px; background: var(--doc-accent); font-size: 16px; }
.doc-professional .issuer-name { font-size: 14px; font-weight: 600; }
.doc-professional .band p { font-size: 11px; color: var(--doc-muted); }
.doc-professional .title { font-size: 14px; font-weight: 600; letter-spacing: .2em; text-align: right; }
.doc-professional .facts { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 26px; border: 1px solid var(--doc-line); }
.doc-professional .facts > div { padding: 12px; font-size: 11.5px; }
.doc-professional .facts .nowrap { white-space: nowrap; }
.doc-professional .facts > div + div { border-left: 1px solid var(--doc-line); }
.doc-professional .facts-amount { font-size: 18px; font-weight: 700; line-height: 1.3; }
.doc-professional .sheet { margin-top: 22px; border: 1px solid var(--doc-line); }
.doc-professional .lines th { padding: 9px 14px; background: var(--doc-ink); color: #fff; font-size: 9.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
.doc-professional .lines td { padding: 9px 14px; border-bottom: 1px solid var(--doc-line); vertical-align: top; }
.doc-professional .lines tbody tr:nth-child(even) td { background: #fafafa; }
.doc-professional .lines .index { width: 44px; padding-right: 0; white-space: nowrap; color: var(--doc-muted); }
.doc-professional .totals { width: 55%; padding: 10px 14px 0; }
.doc-professional .grand { margin: 8px -14px 0; padding: 12px 14px; background: var(--doc-ink); color: #fff; align-items: baseline; }
.doc-professional .grand > :first-child { color: #fff; font-size: 13px; font-weight: 600; }
.doc-professional .grand > :last-child { font-size: 18px; font-weight: 700; }
.doc-professional .boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 22px; }
.doc-professional .boxes > div { padding: 14px; border: 1px solid var(--doc-line); }
.doc-professional .registration { text-align: center; font-size: 10.5px; color: var(--doc-muted); }

/* Bold ------------------------------------------------------------------ */
.doc-bold { --doc-lime: #d6ff3f; padding: 0 46px 46px; font-family: var(--doc-grotesk); }
.doc-bold .label { font-weight: 700; letter-spacing: .12em; }
.doc-bold .masthead { margin: 0 -46px; padding: 34px 46px 36px; background: var(--doc-ink); color: #fff; }
.doc-bold .masthead .label { color: #a1a1aa; }
.doc-bold .masthead-top { display: flex; justify-content: space-between; align-items: center; }
.doc-bold .brand { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 700; }
.doc-bold .logo { width: 34px; height: 34px; border-radius: 8px; background: var(--doc-lime); color: var(--doc-ink); font-size: 15px; }
.doc-bold .title { font-size: 28px; font-weight: 700; line-height: 1; }
.doc-bold .masthead-facts { display: flex; align-items: flex-end; gap: 30px; margin-top: 26px; }
.doc-bold .due-amount { font-size: 34px; font-weight: 700; line-height: 1.05; color: var(--doc-lime); }
.doc-bold .masthead-facts strong { font-size: 14px; font-weight: 700; }
.doc-bold .masthead-facts .right { margin-left: auto; text-align: right; }
.doc-bold .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 30px; }
.doc-bold .party-name { font-size: 14px; font-weight: 700; }
.doc-bold .lines { margin-top: 28px; }
.doc-bold .lines th { padding-bottom: 8px; border-bottom: 3px solid var(--doc-ink); font-size: 9.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.doc-bold .lines td { padding: 11px 0; border-bottom: 1px solid var(--doc-line); vertical-align: top; }
.doc-bold .lines td + td, .doc-bold .lines th + th { padding-left: 12px; }
.doc-bold .totals { margin-top: 16px; }
.doc-bold .grand { margin-top: 10px; padding: 15px 16px; border-radius: 8px; background: var(--doc-ink); align-items: baseline; }
.doc-bold .grand > :first-child { color: #fff; font-size: 12px; font-weight: 700; text-transform: uppercase; }
.doc-bold .grand > :last-child { color: var(--doc-lime); font-size: 20px; font-weight: 700; }
.doc-bold .foot { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
`;

import "server-only";
import { chromium, type Browser } from "playwright-core";

/** Design canvas width (px) → A4 width at 96 dpi (794px). */
export const DOCUMENT_WIDTH = 620;
const A4_WIDTH = 794;
const MAX_CONCURRENT = 2;

let browserPromise: Promise<Browser> | undefined;

async function getBrowser(): Promise<Browser> {
  browserPromise ??= chromium.launch({ args: ["--disable-dev-shm-usage"] }).then((browser) => {
    browser.on("disconnected", () => {
      browserPromise = undefined;
    });
    return browser;
  });
  try {
    return await browserPromise;
  } catch (error) {
    browserPromise = undefined;
    throw error;
  }
}

// A tiny semaphore: Chromium is memory-hungry, so renders queue instead of piling up.
let active = 0;
const waiting: (() => void)[] = [];

async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
}

function release() {
  active--;
  waiting.shift()?.();
}

/** Prints a self-contained HTML document to an A4 PDF with a single shared Chromium. */
export async function renderPdf(html: string): Promise<Buffer> {
  await acquire();
  const browser = await getBrowser().catch((error) => {
    release();
    throw error;
  });
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.setViewportSize({ width: DOCUMENT_WIDTH, height: 877 });
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      scale: A4_WIDTH / DOCUMENT_WIDTH,
      preferCSSPageSize: true,
    });
  } finally {
    await context.close();
    release();
  }
}

export async function closePdfRenderer() {
  const browser = await browserPromise?.catch(() => undefined);
  browserPromise = undefined;
  await browser?.close();
}

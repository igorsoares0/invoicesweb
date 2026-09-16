import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Unicode ranges from Fontsource, so Chromium only uses latin-ext for the glyphs it needs. */
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const FACES: { family: string; pkg: string; slug: string; weights: number[]; italic?: number[] }[] = [
  { family: "Public Sans", pkg: "public-sans", slug: "public-sans", weights: [300, 400, 500, 600, 700] },
  { family: "Newsreader", pkg: "newsreader", slug: "newsreader", weights: [400, 500, 600], italic: [400] },
  { family: "Archivo", pkg: "archivo", slug: "archivo", weights: [400, 500, 600, 700] },
];

let cached: Promise<string> | undefined;

/**
 * @font-face rules with the font files inlined as base64. The PDF renderer never touches the
 * network, and documents look the same on every server.
 */
export function embeddedFontCss(): Promise<string> {
  cached ??= build().catch((error) => {
    cached = undefined;
    throw error;
  });
  return cached;
}

async function build(): Promise<string> {
  const rules: Promise<string>[] = [];
  for (const face of FACES) {
    const styles = [
      ...face.weights.map((weight) => ({ weight, style: "normal" })),
      ...(face.italic ?? []).map((weight) => ({ weight, style: "italic" })),
    ];
    for (const { weight, style } of styles) {
      for (const [subset, range] of [
        ["latin", LATIN],
        ["latin-ext", LATIN_EXT],
      ] as const) {
        const file = path.join(
          process.cwd(),
          "node_modules/@fontsource",
          face.pkg,
          "files",
          `${face.slug}-${subset}-${weight}-${style}.woff2`,
        );
        rules.push(
          readFile(file).then(
            (data) =>
              `@font-face{font-family:"${face.family}";font-style:${style};font-weight:${weight};font-display:block;` +
              `src:url(data:font/woff2;base64,${data.toString("base64")}) format("woff2");unicode-range:${range};}`,
          ),
        );
      }
    }
  }
  return (await Promise.all(rules)).join("\n");
}

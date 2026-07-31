/**
 * Regenerates every favicon, PWA icon and the Open Graph card from the brand
 * mark's own recipe. Run it when the mark or the two gradient tokens change:
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * 📖 Docs: obsidian/frontend/seo-metadata.md
 *
 * ## Why a recipe and not a resize
 *
 * `public/assets/hero/logo-mark.png` was the template's 56×56 mark. Upscaling
 * that to a 512px maskable icon is a blur. It does not need to be upscaled: it
 * is a conic gradient clipped to a circle, and gradients are a formula. Sampled
 * off that PNG, the formula is exactly
 * `conic-gradient(from 180deg, #00ff99, #48c7c9)` — the same sweep, from the
 * same two tokens `--mark-sweep-from` / `--mark-sweep-to` name (see
 * design-system.md):
 *
 *   |  direction        | expected | in the PNG |
 *   |  9 o'clock (25%)  | #12f1a5  | #12f1a5    |
 *   | 12 o'clock (50%)  | #24e3b2  | #24e3b2    |
 *   |  3 o'clock (75%)  | #36d5be  | #36d5be    |
 *   |  6 o'clock (100%) | #48c7c9  | #48c7c9    |
 *
 * So this redraws the mark at whatever size is asked for rather than stretching
 * a thumbnail — and if the tokens are ever retuned, the icons follow.
 *
 * ## Why pixels and not SVG
 *
 * SVG has no conic gradient, and neither sharp nor satori will fake one. The
 * sweep is a couple of lines of arithmetic, so it is drawn straight into an RGBA
 * buffer, supersampled and let sharp downsample for the antialiasing.
 */

import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `next/og.js`, not `next/og`: the bare specifier resolves through Next's
// bundler, and this runs in plain Node.
import { ImageResponse } from "next/og.js";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const FONTS = path.join(ROOT, "src", "app", "fonts");
const LOCALES = path.join(ROOT, "src", "locales");

/**
 * Which locale's copy the card is rendered from.
 *
 * The card is a build artefact of the words, so it reads the same
 * `src/locales/*.json` the page does rather than keeping its own copy — those
 * two drifting apart is how a share card ends up advertising last year's
 * headline. To add a locale, write its JSON and render a card per locale into
 * `open-graph.<locale>.png`, then point `siteConfig.ogImage` at the right one.
 */
const LOCALE = process.env.BRAND_LOCALE ?? "en";

/**
 * How far the accent bar overhangs the word it sits under, px each side, and
 * how thick it is. The bar itself is sized by the word rather than by a number:
 * see `renderOpenGraph`.
 */
const ACCENT_BAR_OVERHANG = 10;
const ACCENT_BAR_HEIGHT = 36;
/** Bar's gap from the bottom of the 80px accent line — tuned to the render. */
const ACCENT_BAR_BOTTOM = 8;

/** Spaces that survive flex layout, for text split across flex items. */
const hardenSpaces = (text) => text.replaceAll(" ", "\u00A0");

/**
 * The bundled General Sans covers Latin only — no kana, no kanji (verified
 * against the fonts' `cmap`). satori does not fall back to a system font: it
 * draws what the fonts it was handed can draw and silently skips the rest, so
 * Japanese copy would produce a card with an empty headline that still exits 0.
 * Fail loudly instead.
 */
const assertRenderable = (strings) => {
  const unsupported = [
    ...new Set(strings.join("").match(/[^\u0000-\u024F\u2000-\u206F]/gu) ?? []),
  ];
  if (unsupported.length > 0) {
    throw new Error(
      `Cannot render ${unsupported.join(" ")} — the bundled General Sans is ` +
        `Latin-only and satori has no system-font fallback. Add a font that ` +
        `covers these glyphs (a subset of the characters used here is enough) ` +
        `to src/app/fonts/ and register it in renderOpenGraph's \`fonts\`.`,
    );
  }
};

/** Keep in sync with `--mark-sweep-from` / `--mark-sweep-to` in globals.css. */
const SWEEP_FROM = [0x00, 0xff, 0x99];
const SWEEP_TO = [0x48, 0xc7, 0xc9];
/** `--halftone-bg` — what a visitor actually reads as the page's ground. */
const GROUND = "#f0f3f4";
const INK = "#000000";
const ACCENT = "#00ff99";

/** Drawn this many times over, then downsampled — that is the antialiasing. */
const SUPERSAMPLE = 4;

/**
 * The mark, drawn at `size` px: a conic sweep starting at 6 o'clock and running
 * clockwise, clipped to a circle. Returns a PNG buffer.
 */
const renderMark = async (size) => {
  const s = size * SUPERSAMPLE;
  const centre = s / 2;
  const radius = s / 2;
  const buffer = Buffer.alloc(s * s * 4);

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x + 0.5 - centre;
      const dy = y + 0.5 - centre;
      const i = (y * s + x) * 4;

      if (Math.hypot(dx, dy) > radius) continue; // stays transparent

      // 0° points up and angles run clockwise, matching CSS conic-gradient.
      const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      // `from 180deg`: the sweep opens at 6 o'clock and closes there too, which
      // is where the seam lands.
      const t = (((deg - 180) % 360) + 360) / 360 % 1;

      buffer[i] = Math.round(SWEEP_FROM[0] + (SWEEP_TO[0] - SWEEP_FROM[0]) * t);
      buffer[i + 1] = Math.round(SWEEP_FROM[1] + (SWEEP_TO[1] - SWEEP_FROM[1]) * t);
      buffer[i + 2] = Math.round(SWEEP_FROM[2] + (SWEEP_TO[2] - SWEEP_FROM[2]) * t);
      buffer[i + 3] = 255;
    }
  }

  return sharp(buffer, { raw: { width: s, height: s, channels: 4 } })
    .resize(size, size, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
};

/**
 * The mark on the page's own ground rather than on transparency.
 *
 * Android and iOS both put the icon on a surface of their choosing — a
 * transparent PNG lands the green sweep on whatever that is, including black.
 * `padding` is a fraction of the tile, leaving the safe area a maskable icon
 * needs.
 */
const renderTile = async (size, padding = 0.18) => {
  const inner = Math.round(size * (1 - padding * 2));
  const mark = await renderMark(inner);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: GROUND,
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

/**
 * Pack PNGs into an .ico. The format takes embedded PNGs directly (every
 * browser in service supports it), so this is a header plus a directory.
 */
const buildIco = (pngs) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = [];
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
};

/** The share card — the hero's own composition, cropped to 1200×630. */
const renderOpenGraph = async (markPng, copy) => {
  const { brand, hero } = copy;
  assertRenderable([
    brand.name,
    brand.nameAccent,
    hero.headline,
    hero.headlineAccent,
    hero.lead,
  ]);

  const [light, italic, regular] = await Promise.all([
    readFile(path.join(FONTS, "GeneralSans-Light.otf")),
    readFile(path.join(FONTS, "GeneralSans-LightItalic.otf")),
    readFile(path.join(FONTS, "GeneralSans-Regular.otf")),
  ]);

  const markUri = `data:image/png;base64,${markPng.toString("base64")}`;

  const image = new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: GROUND,
          color: INK,
          padding: "56px 64px",
          fontFamily: "General Sans",
        },
        children: [
          // Brand lockup — the header's, at the card's scale.
          {
            type: "div",
            props: {
              style: { display: "flex", alignItems: "center", gap: 14 },
              children: [
                {
                  type: "img",
                  props: { src: markUri, width: 52, height: 52 },
                },
                {
                  type: "div",
                  props: {
                    style: { display: "flex", fontSize: 30, fontWeight: 400 },
                    children: [
                      // Non-breaking: these are two flex items, and a flex item
                      // trims its own trailing whitespace, so "FarEdge " + "Labs"
                      // would collapse into "FarEdgeLabs". The browser header
                      // keeps the gap because there it is inline text, not flex.
                      {
                        type: "span",
                        props: { children: hardenSpaces(brand.name) },
                      },
                      {
                        type: "span",
                        props: {
                          style: { fontStyle: "italic" },
                          children: brand.nameAccent,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },

          // The headline, with the bar the design hangs under the accent word.
          {
            type: "div",
            props: {
              style: { display: "flex", flexDirection: "column" },
              children: [
                {
                  type: "div",
                  props: {
                    style: { fontSize: 80, fontWeight: 300, lineHeight: 1 },
                    children: hero.headline,
                  },
                },
                // The accent word and its bar. This wrapper shrink-wraps the
                // word — `alignSelf: flex-start` stops it stretching to the
                // column's width — and the bar is pinned to *its* edges rather
                // than given a width. So the bar measures the word for us, which
                // is the only way to get it right without knowing the font's
                // metrics: the design's fixed 322px was tuned to "foresight",
                // and any other headline would over- or undershoot it.
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      position: "relative",
                      alignSelf: "flex-start",
                    },
                    children: [
                      // Declared before the word so the word paints over it —
                      // satori has no z-index, it paints in order.
                      {
                        type: "div",
                        props: {
                          style: {
                            position: "absolute",
                            left: -ACCENT_BAR_OVERHANG,
                            right: -ACCENT_BAR_OVERHANG,
                            bottom: ACCENT_BAR_BOTTOM,
                            height: ACCENT_BAR_HEIGHT,
                            borderRadius: ACCENT_BAR_HEIGHT / 2,
                            background: ACCENT,
                          },
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: 80,
                            fontWeight: 300,
                            fontStyle: "italic",
                            lineHeight: 1,
                          },
                          children: hero.headlineAccent,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },

          {
            type: "div",
            props: {
              style: { fontSize: 26, fontWeight: 400 },
              children: hero.lead,
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "General Sans", data: light, weight: 300, style: "normal" },
        { name: "General Sans", data: italic, weight: 300, style: "italic" },
        { name: "General Sans", data: regular, weight: 400, style: "normal" },
        { name: "General Sans", data: italic, weight: 400, style: "italic" },
      ],
    },
  );

  return Buffer.from(await image.arrayBuffer());
};

const main = async () => {
  const copy = JSON.parse(
    await readFile(path.join(LOCALES, `${LOCALE}.json`), "utf8"),
  );

  await mkdir(PUBLIC, { recursive: true });
  const written = [];
  const write = async (name, data) => {
    await writeFile(path.join(PUBLIC, name), data);
    written.push(`${name} (${(data.length / 1024).toFixed(1)} kB)`);
  };

  // Favicons stay transparent — browsers draw them on tab chrome of every
  // shade, and a light square would box the mark in on a dark theme.
  for (const size of [16, 32]) {
    await write(`favicon-${size}x${size}.png`, await renderMark(size));
  }
  await write(
    "favicon.ico",
    buildIco(
      await Promise.all(
        [16, 32, 48].map(async (size) => ({
          size,
          data: await renderMark(size),
        })),
      ),
    ),
  );

  // Home-screen icons get the ground: the OS decides what is behind them.
  await write("apple-icon-180x180.png", await renderTile(180));
  for (const size of [36, 48, 72, 96, 144, 192]) {
    await write(`android-icon-${size}x${size}.png`, await renderTile(size));
  }
  await write("android-icon-512x512.png", await renderTile(512));
  for (const size of [70, 150, 310]) {
    await write(`ms-icon-${size}x${size}.png`, await renderTile(size));
  }

  await write(
    "open-graph.png",
    await renderOpenGraph(await renderMark(256), copy),
  );

  console.log(`Locale: ${LOCALE}`);
  console.log("Wrote:\n  " + written.join("\n  "));
};

await main();

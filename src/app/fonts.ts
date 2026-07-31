/**
 * The site's two faces, loaded once.
 *
 * Split out of the layout because there are now two root layouts (one per
 * locale, see `layout-shell.tsx`). `next/font` deduplicates by call site, so
 * declaring these in each layout would emit two copies of the same
 * `@font-face` set and two preload links.
 */

import { Mulish } from "next/font/google";
import localFont from "next/font/local";

/**
 * The design's primary face. Self-hosted from `./fonts` — General Sans is not
 * on Google Fonts, and only the four cuts the design actually uses are loaded.
 *
 * Latin only. Japanese copy falls back to the OS face, which is why the accent
 * word drops its italics in `ja` (see `<Hero italicAccent>`) and why the Open
 * Graph card cannot be rendered in Japanese from these files alone.
 */
export const generalSans = localFont({
  src: [
    { path: "./fonts/GeneralSans-Light.otf", weight: "300", style: "normal" },
    {
      path: "./fonts/GeneralSans-LightItalic.otf",
      weight: "300",
      style: "italic",
    },
    { path: "./fonts/GeneralSans-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-Italic.otf", weight: "400", style: "italic" },
  ],
  variable: "--font-general-sans",
  display: "swap",
});

/** Used by the design for stat labels only — see obsidian/frontend/design-system.md. */
export const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  display: "swap",
});

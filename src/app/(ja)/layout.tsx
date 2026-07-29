import type { Metadata, Viewport } from "next";

import { LayoutShell } from "@/app/layout-shell";
import {
  generateMetadata,
  generateViewport,
} from "@/utils/seo/generate-page-metadata";

/**
 * Root layout for Japanese, served from `/`.
 *
 * One of two root layouts — see `(en)/layout.tsx` and `layout-shell.tsx`. The
 * group exists because `<html lang>` is only settable here, so a locale needs
 * its own root or it has to misdeclare its language.
 *
 * The default locale sits at the root rather than under `/ja/`: a static export
 * on GitHub Pages cannot redirect, so the entry URL has to be a real page.
 *
 * The brand alone is a weak `<title>` — it says who, not what. The headline is
 * the page's own promise, so the tab and the search result carry it (see
 * `meta.title` in `src/locales/ja.json`). `siteName` stays the bare brand.
 */
export const metadata: Metadata = generateMetadata({ locale: "ja" });
export const viewport: Viewport = generateViewport();

export default function JaRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <LayoutShell locale="ja">{children}</LayoutShell>;
}

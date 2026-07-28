import type { Metadata, Viewport } from "next";
import { Mulish } from "next/font/google";
import localFont from "next/font/local";

import {
  generateMetadata,
  generateViewport,
} from "@/utils/seo/generate-page-metadata";
import { getSiteStructuredData } from "@/utils/seo/structured-data";

import { LazyCookie } from "@/components/common/Cookie";
import { Preloader } from "@/components/common/preloader";
import { ReducedMotion } from "@/components/common/reduced-motion";
import { ScrollLayout } from "@/layouts/scroll-layout";

import "@/app/globals.css";

/**
 * The design's primary face. Self-hosted from `./fonts` — General Sans is not
 * on Google Fonts, and only the four cuts the design actually uses are loaded.
 */
const generalSans = localFont({
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
const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The brand alone is a weak `<title>` — it says who, not what. The headline is
 * the page's own promise, so the tab and the search result carry it. `siteName`
 * stays the bare brand (see `siteConfig`).
 */
export const metadata: Metadata = generateMetadata({
  title: "Stack.Side — Turn money into foresight",
});
export const viewport: Viewport = generateViewport();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${generalSans.variable} ${mulish.variable} font-sans antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getSiteStructuredData()),
          }}
        />
        {/* No <AdaptiveGrid />: it exists to take over *above* the largest
            breakpoint, and the single unbounded `vw` rule in globals.css never
            hands over — it scales the same way at every width. Mounting it
            would only damp the scale-up away from the design's proportions.
            See obsidian/meta/decisions-log.md ADR-0015. */}
        <ScrollLayout>
          <ReducedMotion />
          <Preloader />
          <LazyCookie />
          {children}
        </ScrollLayout>
      </body>
    </html>
  );
}

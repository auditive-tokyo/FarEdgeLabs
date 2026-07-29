/**
 * @fileoverview Standardised metadata + viewport generators for pages.
 *
 * `generateMetadata` builds a Next.js `Metadata` object — basic meta tags,
 * OpenGraph, Twitter cards, canonical URL, icons, robots. `metadataBase` is
 * always set (from `siteConfig`) so relative URLs (OG image, canonical)
 * resolve to absolute — required by social scrapers.
 *
 * `generateViewport` builds the `Viewport` export. `themeColor` lives here, not
 * in `Metadata` — Next deprecated it on the metadata object.
 */

import { Metadata, Viewport } from "next";

import { getSiteMeta, siteConfig } from "@/lib/site";
import {
  DEFAULT_LOCALE,
  localeHref,
  locales,
  ogLocale,
  type Locale,
} from "@/locales";

interface MetadataProps {
  /** Decides the language of every string below, plus `og:locale` and hreflang. */
  locale: Locale;
  title?: string;
  description?: string;
  /** Canonical path (e.g. `/about`) or absolute URL for this page. */
  url?: string;
  /** Open Graph / Twitter image — path under `public/` or absolute URL. */
  ogImage?: string;
  twitterHandle?: string;
  author?: string;
  siteName?: string;
}

/**
 * Every locale's version of the current page, for `hreflang`.
 *
 * Only correct while each locale has exactly one page. Once there are real
 * routes, this has to map the current path into each locale rather than always
 * pointing at their home pages — otherwise every `/en/about` claims `/` is its
 * Japanese equivalent.
 *
 * `x-default` names the page a crawler should serve when it cannot match any
 * language, which is the same page the root serves.
 */
const languageAlternates = () => ({
  ...Object.fromEntries(
    locales.map((locale) => [locale, localeHref(locale)]),
  ),
  "x-default": localeHref(DEFAULT_LOCALE),
});

export function generateMetadata({
  locale,
  title,
  description,
  url,
  ogImage,
  twitterHandle = siteConfig.twitterHandle,
  author = siteConfig.author,
  siteName = siteConfig.name,
}: MetadataProps): Metadata {
  const meta = getSiteMeta(locale);
  const resolved = {
    title: title ?? meta.title,
    description: description ?? meta.description,
    url: url ?? meta.path,
    ogImage: ogImage ?? meta.ogImage,
  };

  return {
    // Resolves every relative URL below to an absolute one.
    metadataBase: new URL(siteConfig.url),
    title: resolved.title,
    description: resolved.description,
    authors: [{ name: author }],
    creator: author,
    publisher: author,
    alternates: {
      canonical: resolved.url,
      languages: languageAlternates(),
    },
    openGraph: {
      title: resolved.title,
      description: resolved.description,
      url: resolved.url,
      siteName,
      // Must match the real asset — a scraper that finds a different size than
      // it was promised falls back to cropping. Regenerate both together with
      // `node scripts/generate-brand-assets.mjs`.
      images: [
        {
          url: resolved.ogImage,
          width: 1200,
          height: 630,
          alt: resolved.title,
        },
      ],
      // Paired with `<html lang>` through `src/locales/index.ts`, so the two
      // cannot drift.
      locale: ogLocale(locale),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: resolved.title,
      description: resolved.description,
      // Only when there is a real handle: `site`/`creator` assert who owns this
      // site, so a guessed one credits a stranger. The card renders fine
      // without them.
      ...(twitterHandle ? { site: twitterHandle, creator: twitterHandle } : {}),
      images: [resolved.ogImage],
    },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [
        { url: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
      ],
    },
    manifest: "/manifest.json",
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function generateViewport(): Viewport {
  return {
    themeColor: siteConfig.themeColor,
    width: "device-width",
    initialScale: 1,
  };
}

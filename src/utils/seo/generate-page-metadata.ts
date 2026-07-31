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
  /**
   * This page's own segment, the part that does not change with the language:
   * `"services"`, or `""` for home. Drives the canonical URL and every hreflang.
   */
  path?: string;
  title?: string;
  description?: string;
  /** Open Graph / Twitter image — path under `public/` or absolute URL. */
  ogImage?: string;
  twitterHandle?: string;
  author?: string;
  siteName?: string;
  /**
   * Keep the page out of the index. For pages that exist but have nothing to say
   * yet — a placeholder that ranks is worse than one that does not exist, because
   * it is the answer a searcher gets instead of the real page later.
   */
  noindex?: boolean;
}

/**
 * Every locale's version of *this* page, for `hreflang`.
 *
 * Keyed off the page's own segment rather than the locale's home, so
 * `/en/services/` points at `/services/` and not at `/`. Getting this wrong is
 * quiet: a crawler simply believes the wrong pages are translations of each other.
 *
 * `x-default` names the page a crawler should serve when it cannot match any
 * language, which is the default locale's version of the same page.
 */
const languageAlternates = (path: string) => ({
  ...Object.fromEntries(
    locales.map((locale) => [locale, localeHref(locale, path)]),
  ),
  "x-default": localeHref(DEFAULT_LOCALE, path),
});

export function generateMetadata({
  locale,
  path = "",
  title,
  description,
  ogImage,
  twitterHandle = siteConfig.twitterHandle,
  author = siteConfig.author,
  siteName = siteConfig.name,
  noindex = false,
}: MetadataProps): Metadata {
  const meta = getSiteMeta(locale);
  const resolved = {
    title: title ?? meta.title,
    description: description ?? meta.description,
    url: localeHref(locale, path),
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
      languages: languageAlternates(path),
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
      // One set, not one per colour scheme. `media` does pass through here — Next
      // renders it on the `<link>` — but the generated icons are all baked from
      // one palette by `scripts/generate-brand-assets.mjs`, so there is no second
      // set to point at yet. Worth doing when the mark stops being a placeholder.
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
      index: !noindex,
      // Followed either way: the placeholder pages link back to a real one, and
      // there is no reason to strand that link.
      follow: true,
    },
  };
}

export function generateViewport(): Viewport {
  return {
    // Two `<meta name="theme-color">` tags, each with its own media query. The
    // browser picks; nothing here has to know which scheme is active.
    themeColor: [
      {
        media: "(prefers-color-scheme: light)",
        color: siteConfig.themeColor.light,
      },
      {
        media: "(prefers-color-scheme: dark)",
        color: siteConfig.themeColor.dark,
      },
    ],
    width: "device-width",
    initialScale: 1,
  };
}

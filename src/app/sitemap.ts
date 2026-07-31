import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";
import { localeHref, locales } from "@/locales";

/**
 * Generates `/sitemap.xml` — one entry per locale's home page.
 *
 * Both locales are listed as equals rather than one being a variant of the
 * other: they are separate URLs serving separate content, and the `hreflang`
 * tags in the pages themselves are what relate them.
 *
 * The `/services`, `/works` and `/about` placeholders are **deliberately absent**.
 * A sitemap is a request to index, and those pages have nothing to index yet —
 * they also carry `noindex`, so listing them would be asking for something and
 * refusing it in the same breath. Add each one here when it becomes a real page.
 */

// Required by `output: "export"` — metadata routes have no server to run on,
// so they must be rendered to a file at build time. `lastModified` is therefore
// the build time, not the request time.
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.map((locale) => ({
    url: `${siteConfig.url}${localeHref(locale)}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 1,
  }));
}

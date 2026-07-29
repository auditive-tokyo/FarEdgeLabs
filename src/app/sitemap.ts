import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";
import { localeHref, locales } from "@/locales";

/**
 * Generates `/sitemap.xml` — one entry per locale's home page.
 *
 * Both locales are listed as equals rather than one being a variant of the
 * other: they are separate URLs serving separate content, and the `hreflang`
 * tags in the pages themselves are what relate them. Add an entry per public
 * route as the site grows (ideally derived from a routes manifest).
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

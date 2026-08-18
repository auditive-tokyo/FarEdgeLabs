import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";
import { getCopy, localeHref, locales } from "@/locales";

/**
 * Generates `/sitemap.xml` — every real page, in every locale.
 *
 * Both locales are listed as equals rather than one being a variant of the
 * other: they are separate URLs serving separate content, and the `hreflang`
 * tags in the pages themselves are what relate them.
 *
 * The `/services`, `/works` and `/about` placeholders are **deliberately absent**.
 * A sitemap is a request to index, and those pages have nothing to index yet —
 * they also carry `noindex`, so listing them would be asking for something and
 * refusing it in the same breath. Add each one here when it becomes a real page.
 *
 * `/contact` **is** here, and carries no `noindex`, because it is a real page.
 * Lower priority than home: it is where someone goes after being convinced, not
 * the page that does the convincing.
 */

// Required by `output: "export"` — metadata routes have no server to run on,
// so they must be rendered to a file at build time. `lastModified` is therefore
// the build time, not the request time.
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.flatMap((locale) => [
    {
      url: `${siteConfig.url}${localeHref(locale)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 1,
    },
    {
      // The segment comes from the locale file rather than a literal here, so the
      // sitemap cannot claim a URL the router does not serve — the page, the
      // header's CTA and this entry all read the same `contact.path`.
      url: `${siteConfig.url}${localeHref(locale, getCopy(locale).contact.path)}`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.8,
    },
  ]);
}

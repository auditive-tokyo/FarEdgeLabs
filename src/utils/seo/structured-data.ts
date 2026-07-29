/**
 * @fileoverview JSON-LD structured data helpers.
 *
 * Structured data lets search engines understand the site as entities
 * (Organization, WebSite) rather than just text — improving rich results.
 * Render the output inside a `<script type="application/ld+json">` tag.
 */

import { getSiteMeta, siteConfig } from "@/lib/site";
import { localeHref, type Locale } from "@/locales";

/**
 * Organization + WebSite schema for a locale's home page. Emit once, in that
 * locale's root layout. The two nodes are linked by `@id` so crawlers treat them
 * as related.
 *
 * The Organization is one entity across the whole site, so its `@id` stays
 * origin-scoped and unversioned by locale. The WebSite node is per locale: it
 * carries the translated description and declares `inLanguage`, which is what
 * tells a crawler these are two renderings of one site rather than two sites.
 */
export function getSiteStructuredData(locale: Locale) {
  const { description } = getSiteMeta(locale);
  const url = `${siteConfig.url}${localeHref(locale)}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        url: siteConfig.url,
        logo: `${siteConfig.url}/android-icon-192x192.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: siteConfig.name,
        description,
        url,
        inLanguage: locale,
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
    ],
  };
}

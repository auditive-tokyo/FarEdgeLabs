import { htmlLang, type Locale } from "@/locales";
import { getSiteStructuredData } from "@/utils/seo/structured-data";

import { Preloader } from "@/components/common/preloader";
import { ReducedMotion } from "@/components/common/reduced-motion";
import { ScrollLayout } from "@/layouts/scroll-layout";

import { generalSans, mulish } from "./fonts";

import "@/app/globals.css";

/**
 * The document every locale's root layout renders.
 *
 * There is one root layout per locale, in a route group — `src/app/(ja)/` and
 * `src/app/(en)/` — because `<html lang>` can only be set by a root layout, and
 * a single shared one would have to lie about one of the two languages. Route
 * groups are the only way to have more than one, so the parts that do *not*
 * differ live here instead of being written twice.
 *
 * Note this is not itself a layout: it is a component the layouts call. Next
 * treats any `layout.tsx` as a segment boundary, so making this one would add a
 * level to the tree rather than share code across it.
 */
export const LayoutShell = ({
  locale,
  children,
}: Readonly<{ locale: Locale; children: React.ReactNode }>) => {
  return (
    <html lang={htmlLang(locale)}>
      <body
        className={`${generalSans.variable} ${mulish.variable} font-sans antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getSiteStructuredData(locale)),
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
          {/* No consent banner: the site stores nothing on the visitor's device
              beyond what it needs to render. Analytics is Cloudflare Web
              Analytics, which is cookieless, so there is no non-essential
              storage to ask about. Reinstate one before adding GA4 or any other
              tag that writes a cookie — see decisions-log ADR-0018. */}
          {children}
        </ScrollLayout>
      </body>
    </html>
  );
};

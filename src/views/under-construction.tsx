/**
 * Placeholder for a route that exists but has nothing in it yet — a Server
 * Component.
 *
 * The nav offers Services, Works and About, and a link that 404s is worse than a
 * link that explains itself: on a phone especially, a browser error page looks
 * like the site is broken rather than unfinished. These pages exist so the whole
 * navigation can be walked on a real device.
 *
 * It keeps the header — and therefore the nav, the language switch and the
 * halftone field — so it reads as the same site rather than a stub. What it does
 * not do is repeat the hero: there is nothing to say here yet, and saying it
 * loudly would be worse.
 *
 * Every one of these is `noindex` (see the page files). A placeholder that ranks
 * is the answer a searcher gets *instead of* the real page, months later.
 */

import { getHomeContent } from "@/data/mocks/home";
import { localeHref, otherLocale, type Locale } from "@/locales";

import { HeroField } from "./home/hero-field";
import { SiteHeader } from "./home/site-header";
import { UnderConstructionBody } from "./under-construction/body";

export interface UnderConstructionViewProps {
  locale: Locale;
  /** This page's own segment, e.g. `"services"` — the language switch needs it. */
  path: string;
  /** The nav label for this page, used as its heading. */
  title: string;
}

export const UnderConstructionView = ({
  locale,
  path,
  title,
}: UnderConstructionViewProps) => {
  const content = getHomeContent(locale);

  return (
    <>
      <HeroField src={content.hero.backgroundVideoSrc} />
      <SiteHeader
        brand={content.brand}
        nav={content.nav}
        languageSwitch={content.languageSwitch}
        // The same page in the other language, not that language's home — this is
        // the whole reason `path` is threaded through.
        languageHref={localeHref(otherLocale(locale), path)}
      />
      <main>
        <UnderConstructionBody
          title={title}
          copy={content.underConstruction}
          homeHref={localeHref(locale)}
        />
      </main>
    </>
  );
};

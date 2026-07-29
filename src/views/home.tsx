/**
 * Home view — a Server Component.
 *
 * Sections are built as client leaves so this view stays a Server Component
 * (hard rule #6). See obsidian/workflows/new-page.md.
 *
 * Takes the locale rather than reading it: there is no middleware and no request
 * context in a static export, so the route decides the language and hands it
 * down. `src/app/(ja)/page.tsx` and `src/app/(en)/en/page.tsx` are the two
 * callers.
 */

import { getHomeContent } from "@/data/mocks/home";
import { localeHref, otherLocale, type Locale } from "@/locales";

import { Hero } from "./home/hero";
import { HeroField } from "./home/hero-field";
import { SiteHeader } from "./home/site-header";

export interface HomeViewProps {
  locale: Locale;
}

export const HomeView = ({ locale }: HomeViewProps) => {
  const content = getHomeContent(locale);
  // Every locale has exactly one page, so the counterpart is that locale's home.
  // Revisit when real routes exist — see `languageAlternates` in the metadata
  // generator, which has the same limitation.
  const languageHref = localeHref(otherLocale(locale));

  return (
    <>
      <HeroField src={content.hero.backgroundVideoSrc} />
      <SiteHeader
        brand={content.brand}
        nav={content.nav}
        languageSwitch={content.languageSwitch}
        languageHref={languageHref}
      />
      <main>
        <Hero
          hero={content.hero}
          cta={content.cta}
          // Japanese has no italic cut to switch to — see `<Hero italicAccent>`.
          italicAccent={locale !== "ja"}
        />
      </main>
    </>
  );
};

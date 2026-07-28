/**
 * Home view — a Server Component.
 *
 * Sections are built as client leaves so this view stays a Server Component
 * (hard rule #6). See obsidian/workflows/new-page.md.
 */

import { homeContent } from "@/data/mocks/home";

import { Hero } from "./home/hero";
import { HeroField } from "./home/hero-field";
import { SiteHeader } from "./home/site-header";

export const HomeView = () => {
  return (
    <>
      <HeroField src={homeContent.hero.backgroundVideoSrc} />
      <SiteHeader
        brand={homeContent.brand}
        nav={homeContent.nav}
        cta={homeContent.cta}
      />
      <main>
        <Hero hero={homeContent.hero} cta={homeContent.cta} />
      </main>
    </>
  );
};

/**
 * Home page content — assets and layout here, words in `src/locales/`.
 *
 * Components take content through props; the view imports this and passes it
 * down. See obsidian/frontend/component-conventions.md.
 *
 * The split is deliberate. Every string lives in `src/locales/<locale>.json`,
 * which `scripts/generate-brand-assets.mjs` also reads — the script runs in plain
 * Node and cannot import TypeScript, and it renders the Open Graph card from the
 * same headline the page shows. One file means the card and the page cannot say
 * different things. What stays here is what is not language: file paths for the
 * mark and the clip.
 *
 * > [!note] Placeholder figures
 * > `hero.stats` is still the template's slots with their numbers removed. Fill
 * > them with real figures or drop the section before this goes to production —
 * > inventing metrics is worse than having none. The social-proof pill that sat
 * > beside it is gone for the same reason: it claimed trust the site cannot
 * > evidence, and its three faces were stock decoration.
 */

import { getCopy, type Locale } from "@/locales";

export const getHomeContent = (locale: Locale) => {
  const copy = getCopy(locale);

  return {
    brand: {
      ...copy.brand,
      /** The mark is a rendered gradient, so it ships as an asset rather than CSS. */
      markSrc: "/assets/hero/logo-mark.png",
    },
    nav: copy.nav,
    cta: copy.cta,
    languageSwitch: copy.languageSwitch,
    hero: {
      ...copy.hero,
      /**
       * Background clip, rendered as a halftone field by `<HalftoneVideo>`.
       * A single head-turn sweep — the hero scrubs it with the pointer, so the
       * clip's timeline *is* the head's rotation.
       */
      backgroundVideoSrc: "/assets/hero/man.mp4",
    },
  };
};

/**
 * The shape every home-page component types its props against. Derived from the
 * default locale, which is why the JSON files have to stay key-for-key
 * identical — see `src/locales/index.ts`.
 */
export type HomeContent = ReturnType<typeof getHomeContent>;

/**
 * Home page content — assets and layout here, words in `src/locales/`.
 *
 * Components take content through props; the view imports this and passes it
 * down. See obsidian/frontend/component-conventions.md.
 *
 * The split is deliberate. Every string lives in `src/locales/en.json`, which
 * `scripts/generate-brand-assets.mjs` also reads — the script runs in plain Node
 * and cannot import TypeScript, and it renders the Open Graph card from the same
 * headline the page shows. One file means the card and the page cannot say
 * different things. What stays here is what is not language: file paths for the
 * mark, the clip and the avatars.
 *
 * > [!note] Placeholder figures
 * > `hero.stats` and `hero.trust` are still the template's slots with their
 * > numbers removed. Fill them with real figures or drop the sections before
 * > this goes to production — inventing metrics is worse than having none.
 */

import copy from "@/locales/en.json";

export const homeContent = {
  brand: {
    ...copy.brand,
    /** The mark is a rendered gradient, so it ships as an asset rather than CSS. */
    markSrc: "/assets/hero/logo-mark.png",
  },
  nav: copy.nav,
  cta: copy.cta,
  hero: {
    ...copy.hero,
    /**
     * Background clip, rendered as a halftone field by `<HalftoneVideo>`.
     * A single head-turn sweep — the hero scrubs it with the pointer, so the
     * clip's timeline *is* the head's rotation.
     */
    backgroundVideoSrc: "/assets/hero/man.mp4",
    trust: {
      ...copy.hero.trust,
      avatars: [
        { src: "/assets/hero/avatar-1.png", alt: "" },
        { src: "/assets/hero/avatar-2.png", alt: "" },
        { src: "/assets/hero/avatar-3.png", alt: "" },
      ],
    },
  },
};

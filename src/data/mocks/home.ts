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

import { getCopy, localeHref, type Locale } from "@/locales";

export const getHomeContent = (locale: Locale) => {
  const copy = getCopy(locale);

  return {
    brand: copy.brand,
    // The locale files carry a `path` per item, not an `href`: the prefix is the
    // locale's business, so the URL is assembled here rather than written out
    // four times per language.
    nav: copy.nav.map((item) => ({
      label: item.label,
      href: localeHref(locale, item.path),
    })),
    languageSwitch: copy.languageSwitch,
    underConstruction: copy.underConstruction,
    /**
     * The contact page's copy, with its URL assembled here for the same reason
     * `nav` is — the locale prefix is `localeHref`'s business, and the JSON
     * carries a `path`.
     *
     * It is **not** in `nav`, and that is a layout constraint rather than a
     * judgement about its importance: a fifth item widens the header's centre
     * pill past what fits beside the logo at 1024px. It gets the CTA slot
     * instead, which is what Figma put there. See `<SiteHeader>`.
     */
    contact: {
      ...copy.contact,
      href: localeHref(locale, copy.contact.path),
    },
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

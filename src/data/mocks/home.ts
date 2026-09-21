/**
 * Home page content — assets and layout here, words in `src/locales/`.
 *
 * Components take content through props; the view imports this and passes it
 * down.
 *
 * The split is deliberate. Every string lives in `src/locales/<locale>.json`,
 * which `scripts/generate-brand-assets.mjs` also reads — the script runs in plain
 * Node and cannot import TypeScript, and it renders the Open Graph card from the
 * same headline the page shows. One file means the card and the page cannot say
 * different things. What stays here is what is not language: file paths for the
 * mark and the clip.
 *
 * > [!note] 作った数字を置かない
 * > テンプレートの `hero.stats`（Projects / Clients / Uptime / Rating）は、数字を
 * > 抜いた枠だけが残っていた。**枠を埋めずに捨てた。** いまその場所にあるのは
 * > `hero.projects` —— いま動いている案件を文で書いたもので、数えた値ではない。
 * > 横にあった social-proof のピルも同じ理由で消えている（証拠の無い信頼を主張し、
 * > 3つの顔はストック素材だった）。
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
     * The contact page's copy.
     *
     * `href` is **not** here: the header links to this page through `nav` like any
     * other destination, and a second way to build the same URL is a second thing
     * to keep in step. `path` stays because the page, the sitemap and the language
     * switch need the segment itself.
     */
    contact: copy.contact,
    /** 実績ページのコピー。`contact` と同じで、ページ単位の塊をそのまま渡す。 */
    works: copy.works,
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

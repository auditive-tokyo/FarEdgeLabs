/**
 * The locale registry — which languages exist, and where each one is served.
 *
 * There is no middleware and no runtime: the site is a static export on GitHub
 * Pages, so every locale is a directory decided at build time. That is why the
 * default locale lives at the root rather than being redirected to — Pages has
 * no way to redirect, and a `meta refresh` on the entry page would cost the site
 * its canonical URL.
 *
 * Adding a locale: write `<code>.json` with the same keys, add the code to
 * `locales`, and add a route group under `src/app/` with its own root layout
 * (only a root layout can set `<html lang>`).
 */

import en from "./en.json";
import ja from "./ja.json";

export const locales = ["ja", "en"] as const;

export type Locale = (typeof locales)[number];

/** Served from `/`, not `/ja/`. */
export const DEFAULT_LOCALE: Locale = "ja";

const dictionaries = { ja, en };

/** BCP 47 tags for `<html lang>`; the OG equivalents are underscored. */
const HTML_LANG: Record<Locale, string> = { ja: "ja", en: "en" };
const OG_LOCALE: Record<Locale, string> = { ja: "ja_JP", en: "en_US" };

/**
 * `ja` and `en` are separate JSON modules, so TypeScript infers a union of two
 * object types rather than one. They are kept key-for-key identical, which is
 * what makes reading through this indexer safe — a missing key in either file
 * is a type error at every call site.
 */
export const getCopy = (locale: Locale) => dictionaries[locale];

/** Root-relative path for a locale's home page, with the trailing slash `next.config.ts` enforces. */
export const localeHref = (locale: Locale): string =>
  locale === DEFAULT_LOCALE ? "/" : `/${locale}/`;

export const htmlLang = (locale: Locale): string => HTML_LANG[locale];

export const ogLocale = (locale: Locale): string => OG_LOCALE[locale];

/** The locale a switcher should offer, given the one being displayed. */
export const otherLocale = (locale: Locale): Locale =>
  locale === "ja" ? "en" : "ja";

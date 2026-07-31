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

/**
 * Root-relative path for a page in a locale, with the trailing slash
 * `next.config.ts` enforces.
 *
 * `path` is the page's own segment, the part that is the same in every language —
 * `"services"`, or `""` for home. The locale prefix is this function's business,
 * and the default locale has none because it is served from the root.
 *
 * Everything that has to name a URL goes through here: canonical tags, hreflang,
 * the sitemap, the language switcher. One definition, so a page cannot end up
 * claiming a URL that does not exist.
 */
export const localeHref = (locale: Locale, path = ""): string => {
  const segment = path.replace(/^\/+|\/+$/g, "");
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  return segment ? `${prefix}/${segment}/` : `${prefix}/`;
};

export const htmlLang = (locale: Locale): string => HTML_LANG[locale];

export const ogLocale = (locale: Locale): string => OG_LOCALE[locale];

/** The locale a switcher should offer, given the one being displayed. */
export const otherLocale = (locale: Locale): Locale =>
  locale === "ja" ? "en" : "ja";

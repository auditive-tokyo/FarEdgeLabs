/**
 * The routes that exist but are not built yet, in one place.
 *
 * Six page files (three segments × two locales) all read from here, so a
 * placeholder cannot drift from the nav that links to it: `nav` in the locale
 * files and `PLACEHOLDER_SEGMENTS` below have to hold the same segments, and this
 * is the shorter list to check.
 *
 * Deleting one is the whole migration: write the real `page.tsx` for that segment
 * and drop its entry, in both locales.
 */

import { getCopy, type Locale } from "@/locales";

export const PLACEHOLDER_SEGMENTS = ["services", "works", "about"] as const;

export type PlaceholderSegment = (typeof PLACEHOLDER_SEGMENTS)[number];

/**
 * The nav's own label for a segment, reused as the page's `<h1>` and `<title>`.
 *
 * Taken from the nav rather than stored twice: a visitor who taps "サービス"
 * should land on a page headed "サービス", and two copies of that word is how they
 * end up disagreeing.
 */
export const placeholderTitle = (
  locale: Locale,
  segment: PlaceholderSegment,
): string => {
  const item = getCopy(locale).nav.find((entry) => entry.path === segment);

  if (!item) {
    throw new Error(
      `No nav entry for "${segment}" in ${locale}.json — the placeholder pages ` +
        `take their titles from the nav, so the segment has to exist there.`,
    );
  }

  return item.label;
};

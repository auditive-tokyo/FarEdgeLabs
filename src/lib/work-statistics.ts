/**
 * The figures in the hero panel, fetched from Cloud Storage at runtime.
 *
 * `gc_run_functions/work_statics/main.py` writes this object once a day, and
 * `terraform/main.tf` makes it publicly readable with a CORS rule for this origin.
 * There is no API in front of it — Cloud Storage serves the object and answers the
 * preflight itself.
 *
 * **Runtime, not build time.** The site is a static export, so baking the numbers in
 * would freeze them until the next deploy and couple a daily refresh to a release.
 * The cost is that first paint has no figures; see `<HeroStats>` for what shows
 * instead.
 */

import { siteConfig } from "@/lib/site";

/** Mirrors the payload `main.py` writes. Keep the two in step. */
export interface WorkStatistics {
  window: { from: string; to: string; days: number; timezone: string };
  generatedAt: string;
  clients: number;
  projects: number;
  activities: number;
  /** Excludes break time — see the note in `main.py`'s `summarise_grouping`. */
  hours: number;
  daysWorked: number;
  excludedHours: number;
}

/**
 * The fields the panel may display, as a runtime list as well as a type.
 *
 * Which figure goes on which row is decided in the locale files, and TypeScript types
 * a JSON string as `string` — so this has to be checked rather than asserted. A `field`
 * that does not match anything here shows the placeholder, which is how a typo in a
 * locale file surfaces as a visible gap instead of `undefined` on the page.
 */
const DISPLAYABLE = [
  "clients",
  "projects",
  "activities",
  "hours",
  "daysWorked",
] as const;

export type WorkStatisticsField = (typeof DISPLAYABLE)[number];

const isDisplayable = (field: string): field is WorkStatisticsField =>
  (DISPLAYABLE as readonly string[]).includes(field);

/**
 * Fetch the object, or `null`.
 *
 * Every failure resolves to `null` rather than throwing, because there is exactly one
 * thing to do about any of them: leave the placeholder in place. A panel of dashes is
 * the designed state, so an offline visitor, a bad deploy of the function and a
 * mistyped bucket name all land in the same place — and none of them puts an error in
 * front of someone reading the front page.
 *
 * Not validated with `zod`, though it is a dependency here. The consumer reads five
 * numbers and checks each is a number; a schema would add bundle weight to the hero to
 * restate that.
 */
export const fetchWorkStatistics = async (
  signal?: AbortSignal,
): Promise<WorkStatistics | null> => {
  try {
    const response = await fetch(siteConfig.statsUrl, { signal });
    if (!response.ok) return null;
    return (await response.json()) as WorkStatistics;
  } catch {
    return null;
  }
};

/**
 * A figure formatted for display, or `null` when it is missing or not a number.
 *
 * Rounded to whole units. `main.py` rounds hours to one decimal, which is the right
 * precision to *store* — but "168.8" on a page reads as a measurement when it is a
 * month's aggregate, and the tenth of an hour is noise either way.
 */
export const formatFigure = (
  stats: WorkStatistics | null,
  field: string,
): string | null => {
  if (!stats || !isDisplayable(field)) return null;
  const value = stats[field];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value).toLocaleString();
};

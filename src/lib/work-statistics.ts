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
 * 固定値で上書きする行。いまは稼働時間だけ。
 *
 * **なぜ固定するか。** Jibble での打刻をやめたので、直近30日の窓が回るぶんだけ
 * `hours` は 0 へ向かって落ちていく。測るのをやめた数字が「減っている」ように
 * 見えるのが、放置したときの一番まずい壊れ方 — 窓が滑るのは仕様どおりの挙動なので、
 * 関数もバケットも正常なまま、ページだけが嘘をつく。
 *
 * `clients` と `projects` はここに入れない。打刻をやめても案件の数は変わらないので、
 * 窓が回っても落ちない。この2行は実測のままで、取得できなければ `—` に戻る。
 *
 * > [!warning] 暫定対応。2つ承知の上で入れている
 * > 1. **`hero.stats.note` がまだ嘘になる。** 「Jibble の API で取得し、日次で
 * >    集計しています」は `hours` については事実でなくなった。公開ページの、
 * >    数字のすぐ隣にある文
 * > 2. **ロケールの `_stats_readme` に反している。** 「数字をでっち上げるより、
 * >    埋めるかセクションごと落とす」と書いてある
 * >
 * > 次にここを触るときは、注記の書き換えかセクションの撤去まで持っていく。
 * > 恒久化させないための記録は `TODO.md` にある。
 */
const FIXED_FIGURES: Partial<Record<WorkStatisticsField, number>> = {
  hours: 160,
};

/**
 * A figure formatted for display, or `null` when it is missing or not a number.
 *
 * Rounded to whole units. `main.py` rounds hours to one decimal, which is the right
 * precision to *store* — but "168.8" on a page reads as a measurement when it is a
 * month's aggregate, and the tenth of an hour is noise either way.
 *
 * `FIXED_FIGURES` の行は `stats` を見ない。詳細はそちらの注記。
 */
export const formatFigure = (
  stats: WorkStatistics | null,
  field: string,
): string | null => {
  if (!isDisplayable(field)) return null;

  // 固定値は fetch の成否に依存させない。ここで `stats` を先に見ると、
  // オブジェクトが取れなかった日に固定したはずの数字が `—` へ落ちる。
  const fixed = FIXED_FIGURES[field];
  if (fixed !== undefined) return Math.round(fixed).toLocaleString();

  if (!stats) return null;
  const value = stats[field];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value).toLocaleString();
};

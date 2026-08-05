"use client";

import { useEffect, useState } from "react";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/intro";
import type { HomeContent } from "@/data/mocks/home";
import {
  fetchWorkStatistics,
  formatFigure,
  type WorkStatistics,
} from "@/lib/work-statistics";

import { LIFT_IN, LIFT_OUT, REVEAL_DELAY, REVEAL_SPRING } from "./reveal";

export interface HeroStatsProps {
  stats: HomeContent["hero"]["stats"];
}

/** Ties the panel's caption to the group of figures it scopes. */
const SCOPE_ID = "hero-stats-scope";

/**
 * One panel of figures, in the footprint the template's 2×2 grid used to fill.
 *
 * It was four separate cards — Figma 681:369. Four cards force a decision about
 * how many there are: three leaves a hole, five needs a third row, and the count
 * has to be settled before anything can be written into them. One panel takes a
 * line at a time, so the figures can arrive (and leave) without a layout change.
 * `lg:w-[24.25rem]` is the old grid's exact width — two 11.875rem cards plus the
 * 0.5rem gap — so the frame's composition is untouched.
 *
 * The height is left to the content on purpose. The panel is pinned by its top
 * edge, so a line more or less grows it downward into space that is already
 * empty.
 *
 * `bg-surface/75` is the same ground as `<HeroCopy>`'s card — one value across
 * both, so the two panels sit in the halftone field at the same depth instead of
 * one of them reading as a hole in it. The reasoning for the number, and the
 * `/70` floor below which `text-body` starts losing the darkest part of the
 * subject, is on that card. Unlike it, this ground is kept at every width: the
 * copy moves into the field's quiet left third at `lg` and drops its card, while
 * this panel stays over the busy right side.
 *
 * No `backdrop-blur` here either. The field is a WebGL canvas redrawing every
 * frame and a backdrop filter would re-blur it just as often.
 *
 * ## The window is a caption, not three repetitions
 *
 * All three figures cover the same trailing 30 days, so the window is said once
 * above them (`stats.scope`) rather than prefixed onto every label. The panel
 * therefore carries `role="group"` named by that caption: a screen reader
 * reaching the list would otherwise hear "Clients — 3" with nothing saying over
 * what period, because the scope would be a loose paragraph beside it rather
 * than attached to it.
 *
 * It stays a `<p>` rather than becoming an `<h2>`. "In the last 30 days" is a
 * fragment, and the outline is a promise about the document's structure (hard
 * rule #10) — `aria-labelledby` gives the group its name without putting a
 * dangling phrase in that outline.
 *
 * ## Three tiers, not four things at one size
 *
 * Everything here was `--text-body`: the scope, the labels, the disclosure's
 * question and its answer. Four separate jobs at one size read as a single flat
 * block, whatever the wording. So there is now a step below body —
 * `--text-caption`, added to the scale in `globals.css` — and the panel divides
 * into:
 *
 * | tier | what | how |
 * |------|------|-----|
 * | loud | the figures | `text-stat`, italic, `tabular-nums` |
 * | plain | the labels | `font-mulish text-body`, the design's label face |
 * | quiet | the disclosure | `text-caption` |
 * | apart | the scope | an accent pill, `--on-accent` ink |
 *
 * `tabular-nums` matters once real values land: proportional digits shift the
 * right edge as the numbers change, and these are right-aligned.
 *
 * ### Why the scope is a pill and not just smaller type
 *
 * It names the window every figure below it is measured over, so it must not
 * read as one of the parameters. Two point sizes apart is not enough to say
 * that — and two of the usual levers are unavailable here:
 *
 * - **The typeface is not one.** General Sans and Mulish are both Latin-only, so
 *   Japanese falls back to the OS's CJK face in either. `font-sans` and
 *   `font-mulish` render 過去30日の identically; only the digits would differ.
 * - **Accent-coloured text is not one.** The green passes easily on the dark
 *   surface and the pink lands near 3:1 on the light one, which fails at caption
 *   size. That is the trap the colour-token table in `AGENTS.md` is about.
 *
 * A pill sidesteps both: `--on-accent` exists precisely for ink on an accent
 * ground and is dark in *both* schemes, so contrast is settled by the token
 * rather than by luck. `rounded-card` resolves to a full round at this height,
 * which is what every other pill in the design does.
 *
 * The accent appearing twice — this pill and the panel's border — is deliberate;
 * they read as one object with a labelled edge. If it ever looks like too much,
 * the border is the one to drop, not the pill.
 *
 * **The rules carry weight too.** `--hairline-strong` bounds the data block top
 * and bottom, plain `--hairline` divides the rows inside it. Every rule at one
 * alpha was the other half of the flatness — four identical stripes in a panel
 * this small. Two weights make the outer two read as structure and the inner
 * ones as separation.
 *
 * The note gets a rule down its left edge, the shape of a pulled quote, because
 * it qualifies the figures rather than continuing them. It is `--hairline-strong`
 * and not the accent: the panel's own border is already accent, and a second
 * accent line inside it competes with the first for no gain.
 *
 * `note.body` is an **array of paragraphs**, not one string. The three sentences
 * do three different jobs — how the figures are produced, that they are not to be
 * read into, and what they are nonetheless useful for — and at caption size a
 * single run of three sentences is a wall. The rule spans all of them, so they
 * still read as one aside.
 *
 * A `<dl>` inside, where the grid was a `<ul>`: the label now leads and the
 * figure answers it, which is a description list. The old cards put the figure
 * *above* its label, and a `<dl>` would have forced the reading order the other
 * way.
 *
 * The accent lives on the panel's border. The per-item `accented` flag the grid
 * used is gone from the locale files with it — it decided which of the four
 * cards were outlined, and there is one card now. So is `REVEAL_DELAY.statStep`:
 * the panel enters as a single object rather than four on a stagger.
 *
 * ## The figures
 *
 * Clients, projects and hours, each over the trailing 30 days, fetched at runtime from
 * the object a Cloud Run function writes daily — see `@/lib/work-statistics`. Which
 * figure lands on which row is decided in the locale files by a `field` name, so the
 * order and the wording are copy decisions rather than code ones.
 *
 * No client is named. The aggregate is the point, and naming engagements on a marketing
 * page is a separate decision with its own consent question.
 *
 * A trailing window **falls** when a week is taken off. That is accepted: the
 * alternative was cumulative totals, which only ever rise but say nothing about now. Do
 * not quietly switch to cumulative to make a number look better.
 *
 * ## Why the fetch happens here and not at build time
 *
 * Baking the numbers into the export would freeze them until the next deploy, and tie a
 * daily refresh to a release. So the panel renders `stats.placeholder` on the server,
 * and swaps in real figures once the object arrives.
 *
 * **The placeholder is a designed state, not a loading spinner.** It is what the panel
 * looks like before the fetch lands, on a browser that blocks the request, and on any
 * day the function or the bucket fails. All three want the same thing — a panel that
 * reads as complete with dashes in it — so none of them gets an error message, and there
 * is no retry. Rendering the same placeholder on both sides of hydration is also what
 * keeps the server and client markup identical.
 *
 * ## Why a `<details>` and not a tooltip or a state toggle
 *
 * "What are these figures?" is a question a visitor genuinely has, and a
 * disclosure is the platform's answer to it: keyboard reachable, announced as
 * expandable, and it needs no state of its own on a page that is a static
 * export. A hover tooltip would be unreachable on the phone, which is where the
 * panel is most cramped and the question hardest to answer.
 *
 * The default marker is dropped rather than restyled — the hero has no icon
 * vocabulary, and a bare "?" glyph would be the only one in it. That is also why
 * this is a question in words: the arrow-in-a-circle that used to sit in the
 * header was removed for meaning nothing, and a "?" disc would put the same kind
 * of ornament back.
 */
export const HeroStats = ({ stats }: HeroStatsProps) => {
  const isRevealed = useIntroRevealed();
  const [figures, setFigures] = useState<WorkStatistics | null>(null);

  useEffect(() => {
    // Aborted on unmount so a navigation away does not resolve into a dead
    // component. `fetchWorkStatistics` swallows the abort with every other failure,
    // which is correct here: an aborted fetch and a missing object both mean "leave
    // the placeholder alone".
    const controller = new AbortController();
    void fetchWorkStatistics(controller.signal).then(setFigures);
    return () => controller.abort();
  }, []);

  return (
    /* `mt-auto` puts the panel on the bottom of the phone's column — see the
       comment on `<Hero>`'s section. It is the last flex item, so it takes all
       the slack rather than sharing it, which keeps the headline and copy tight
       together at the top. Dropped at `lg`, where it is positioned against the
       frame instead. */
    <Inview
      tag="div"
      role="group"
      aria-labelledby={SCOPE_ID}
      className="mt-auto rounded-card border border-accent bg-surface/75 p-4 lg:absolute lg:right-7.5 lg:top-[24.3125rem] lg:mt-0 lg:w-[24.25rem] lg:p-6"
      from={LIFT_OUT}
      to={LIFT_IN}
      config={REVEAL_SPRING}
      delayIn={REVEAL_DELAY.stats}
      mode="once"
      enabled={isRevealed}
    >
      <div className="border-b border-hairline-strong pb-3">
        <p
          id={SCOPE_ID}
          className="inline-block rounded-card bg-accent px-3 py-1 font-mulish text-caption leading-[1.2] tracking-wider text-on-accent"
        >
          {stats.scope}
        </p>
      </div>

      <dl className="divide-y divide-hairline">
        {stats.items.map((stat) => {
          const figure = formatFigure(figures, stat.field);

          return (
            /* A `div` between `dl` and its `dt`/`dd` is what the HTML spec
               provides for grouping a pair — it is what lets each row be a flex
               line and carry the divider. */
            <div
              key={stat.field}
              className="flex items-baseline justify-between gap-4 py-3"
            >
              <dt className="font-mulish text-body leading-[1.2]">
                {stat.label}
              </dt>
              <dd className="text-stat italic leading-none tabular-nums">
                {/* The suffix rides with the figure, so it is absent from the
                    placeholder — "—時間" reads as a broken value rather than a
                    missing one. It is per locale and per row: hours take `時間`
                    and `h`, the counts take nothing. */}
                {figure === null ? stats.placeholder : figure}
                {/* Its own span, a step down, and **not italic**. A unit set as
                    large as its figure competes with it, and italic on `時間`
                    shears a CJK glyph — the same fault the headline and the Open
                    Graph card already avoid. `font-mulish` puts it on the label's
                    face, which is what it belongs to. */}
                {figure !== null && stat.suffix ? (
                  <span className="ml-1 font-mulish text-body not-italic">
                    {stat.suffix}
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* The panel is pinned by its top edge, so opening this grows it downward
          into the frame's empty lower band rather than pushing the figures
          around. */}
      <details className="border-t border-hairline-strong pt-3">
        <summary className="cursor-pointer list-none font-mulish text-caption leading-[1.2] underline decoration-hairline-strong underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          {stats.note.summary}
        </summary>
        <div className="mt-3 space-y-2 border-l-2 border-hairline-strong pl-3">
          {stats.note.body.map((paragraph) => (
            <p
              key={paragraph}
              className="font-mulish text-caption leading-[1.5]"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </details>
    </Inview>
  );
};

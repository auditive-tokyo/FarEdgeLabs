"use client";

import TextEngine from "spring-text-engine";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/intro";

import {
  LETTER_IN,
  LETTER_OUT,
  LETTER_STAGGER,
  REVEAL_DELAY,
  REVEAL_SPRING,
} from "./reveal";

export interface HeroHeadlineProps {
  headline: string;
  headlineAccent: string;
  /** See `<Hero italicAccent>` — off for languages with no italic cut. */
  italicAccent?: boolean;
}

/**
 * The headline and the bar behind it — Figma 681:256 / 681:355.
 *
 * Letters arrive one after another from the left, unblurring as they land.
 * `<TextEngine>` gives each its own spring and holds them all at `LETTER_OUT`
 * until the intro signal fires (hard rule #1 — no CSS keyframes anywhere).
 *
 * > [!note] No `<br>` between the lines
 * > `<TextEngine>` lays its words out in a wrapping flex row, where a `<br>` is
 * > just another flex item and breaks nothing. The line break is the box: at
 * > the design's 49.8125rem the accent word cannot fit beside the rest and wraps
 * > on its own. That width is fixed against the 1440 frame and scaled whole by
 * > the grid, so the wrap point is the same at every desktop window size — and
 * > on a phone it simply wraps wherever the screen runs out, which is why the
 * > bar is anchored to the last line rather than to a line number.
 *
 * The `seo` prop (on by default) leaves a visually-hidden plain-text copy of the
 * heading in the markup, so the `<h1>` still has an accessible name while its
 * letters sit at `opacity: 0`.
 */
export const HeroHeadline = ({
  headline,
  headlineAccent,
  italicAccent = true,
}: HeroHeadlineProps) => {
  const isRevealed = useIntroRevealed();

  return (
    /* `text-display` sits here, not only on the `<h1>`: the bar below is
       measured in `em`, so it needs the headline's own size to resolve
       against. The `<h1>` inherits it. */
    <div className="relative w-full text-display leading-none lg:absolute lg:left-7.5 lg:top-29 lg:w-[49.8125rem]">
      {/* An independent bar, not an underline on the word: it overhangs the
          text on both sides and sits low, so it is placed against the frame
          rather than sized to the glyphs. Declared before the heading so the
          heading paints over it without needing a z-index — `<TextEngine>`
          makes its own root `position: relative`.

          Anchored to the **bottom** and sized in `em`, which is what lets one
          set of values serve both layouts: it lands on the last line whether the
          headline wraps into two lines or three, and it scales with the type
          instead of needing a second, hand-tuned mobile position. At the frame's
          80px this resolves to exactly the design's -10 / 140 / 322×36. */}
      <Inview
        tag="span"
        aria-hidden="true"
        className="absolute -bottom-[0.2em] -left-[0.125em] h-[0.45em] w-[4.025em] origin-left rounded-full bg-accent"
        from={{ scaleX: 0, opacity: 0 }}
        to={{ scaleX: 1, opacity: 1 }}
        config={REVEAL_SPRING}
        delayIn={REVEAL_DELAY.headlineBar}
        mode="once"
        enabled={isRevealed}
      />
      <TextEngine
        tag="h1"
        id="hero-title"
        className="font-light"
        mode="once"
        enabled={isRevealed}
        delayIn={REVEAL_DELAY.headline}
        letterOut={LETTER_OUT}
        letterIn={LETTER_IN}
        letterStagger={LETTER_STAGGER}
        letterConfig={REVEAL_SPRING}
      >
        {headline}{" "}
        {italicAccent ? <i>{headlineAccent}</i> : <span>{headlineAccent}</span>}
      </TextEngine>
    </div>
  );
};

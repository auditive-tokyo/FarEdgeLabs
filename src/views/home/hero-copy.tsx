"use client";

import TextEngine from "spring-text-engine";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/intro";

import {
  REVEAL_DELAY,
  REVEAL_SPRING,
  WORD_IN,
  WORD_OUT,
  WORD_STAGGER,
} from "./reveal";

export interface HeroCopyProps {
  lead: string;
  body: string;
}

/**
 * The rule and the two paragraphs hanging off it — Figma 681:370.
 *
 * The copy rises a word at a time, unblurring as it settles — the same move as
 * the headline turned through ninety degrees, which is what keeps the two
 * reading as one entrance rather than two effects.
 *
 * > [!note] Each `<TextEngine>` sits inside its own positioned box
 * > The engine writes `position: relative` into its root's inline style to
 * > anchor the layers it measures, and inline style beats a class — so an
 * > `absolute` utility on the engine itself is silently dropped. The wrapper
 * > carries the position; the engine only carries type.
 *
 * > [!note] `lg:contents` is what lets one DOM serve both layouts
 * > On a phone the rule is a real flex item that stretches beside the copy, so
 * > it needs a row to live in and the paragraphs need a column. The frame has no
 * > such nesting — each piece is placed against the section. Dropping the two
 * > wrappers to `display: contents` at `lg` removes their boxes, so the
 * > paragraphs position against the section exactly as before rather than
 * > against a wrapper that only mobile needed.
 */
export const HeroCopy = ({ lead, body }: HeroCopyProps) => {
  const isRevealed = useIntroRevealed();

  return (
    /* The card is mobile's alone. On the frame this copy sits in the field's
       quiet left third, but a phone stacks it straight over the subject's face,
       where body text at `text-body` competes with the halftone's densest dots.
       A ground of its own is the cheapest fix that keeps the art intact, and it
       is deliberately short of opaque — the dots still read through it, so the
       card sits *in* the field rather than punching a hole in it. Below about
       `/70` the body copy starts losing contrast against the darkest part of the
       subject, which is the floor to tune against.
       `lg:contents` removes this box entirely, and an element that generates no
       box paints no background — so the card disappears at `lg` without a single
       override.
       No `backdrop-blur`: the field behind it is a WebGL canvas redrawing every
       frame, and a backdrop filter would have to re-blur it just as often. A
       near-opaque ground costs nothing per frame and reads the same. */
    <div className="flex gap-4 rounded-card bg-surface/75 p-5 lg:contents">
      {/* Drawn downward from the top, so it reads as the copy's spine arriving
          rather than a line fading up. On mobile it stretches to the column it
          sits beside; the frame gives it a fixed length. */}
      <Inview
        tag="span"
        aria-hidden="true"
        className="w-px shrink-0 origin-top bg-foreground lg:absolute lg:left-7.5 lg:top-[24.3125rem] lg:h-60"
        from={{ scaleY: 0 }}
        to={{ scaleY: 1 }}
        config={REVEAL_SPRING}
        delayIn={REVEAL_DELAY.rule}
        mode="once"
        enabled={isRevealed}
      />

      <div className="flex flex-col gap-6 lg:contents">
        <div className="lg:absolute lg:left-[3.875rem] lg:top-[24.3125rem] lg:w-[25.6875rem]">
          <TextEngine
            tag="p"
            className="text-lead leading-[1.2]"
            mode="once"
            enabled={isRevealed}
            delayIn={REVEAL_DELAY.lead}
            wordOut={WORD_OUT}
            wordIn={WORD_IN}
            wordStagger={WORD_STAGGER}
            wordConfig={REVEAL_SPRING}
          >
            {lead}
          </TextEngine>
        </div>

        <div className="lg:absolute lg:left-[3.875rem] lg:top-[34.5625rem] lg:w-[25.6875rem]">
          <TextEngine
            tag="p"
            className="text-body leading-[1.2]"
            mode="once"
            enabled={isRevealed}
            delayIn={REVEAL_DELAY.body}
            wordOut={WORD_OUT}
            wordIn={WORD_IN}
            wordStagger={WORD_STAGGER}
            wordConfig={REVEAL_SPRING}
          >
            {body}
          </TextEngine>
        </div>
      </div>
    </div>
  );
};

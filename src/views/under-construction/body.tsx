"use client";

import Link from "next/link";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/intro";
import type { HomeContent } from "@/data/mocks/home";

import { LIFT_IN, LIFT_OUT, REVEAL_DELAY, REVEAL_SPRING } from "../home/reveal";

export interface UnderConstructionBodyProps {
  title: string;
  copy: HomeContent["underConstruction"];
  homeHref: string;
}

/**
 * The message itself — the client leaf, so the view above stays a Server
 * Component (hard rule #6).
 *
 * One card on the page's own ground rather than bare text over the halftone: the
 * field is at its densest through the middle of the viewport, which is exactly
 * where this sits. Same treatment as the hero's copy, and the same reason.
 *
 * Enters on the headline's timing. There is only one thing here, so there is
 * nothing to stagger it against.
 */
export const UnderConstructionBody = ({
  title,
  copy,
  homeHref,
}: UnderConstructionBodyProps) => {
  const isRevealed = useIntroRevealed();

  return (
    <section
      aria-labelledby="page-title"
      className="flex min-h-lvh items-center px-5 py-24"
    >
      <Inview
        tag="div"
        className="flex w-full max-w-[32rem] flex-col gap-5 rounded-card bg-surface/75 p-8 lg:mx-auto"
        from={LIFT_OUT}
        to={LIFT_IN}
        config={REVEAL_SPRING}
        delayIn={REVEAL_DELAY.headline}
        mode="once"
        enabled={isRevealed}
      >
        <h1 id="page-title" className="text-display font-light leading-none">
          {title}
        </h1>
        <p className="text-lead leading-[1.2]">{copy.heading}</p>
        <p className="text-body leading-[1.4]">{copy.body}</p>
        <Link
          href={homeHref}
          className="text-body leading-[1.2] underline underline-offset-4"
        >
          {copy.backLabel}
        </Link>
      </Inview>
    </section>
  );
};

"use client";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/intro";
import type { HomeContent } from "@/data/mocks/home";

import { LIFT_IN, LIFT_OUT, REVEAL_DELAY, REVEAL_SPRING } from "./reveal";

export interface HeroStatsProps {
  stats: HomeContent["hero"]["stats"];
}

/**
 * The 2×2 stat grid — Figma 681:369.
 *
 * A list, not a `<dl>`: the design puts the figure above its label, and a
 * description list would force the label first. Source order follows the
 * design, so it reads the same aloud as on screen.
 *
 * The cards lift in on a short stagger and take no blur — blur is the text's
 * move here, and a blurred border reads as a rendering fault, not as depth.
 *
 * The 2×2 stays 2×2 on a phone — four figures in one column would read as a
 * list rather than a panel. Only the card's fixed width goes: it is the frame's
 * measurement, and two of them do not fit across 375px, so below `lg` the grid
 * divides whatever it is given.
 */
export const HeroStats = ({ stats }: HeroStatsProps) => {
  const isRevealed = useIntroRevealed();

  return (
    <ul className="grid grid-cols-2 gap-2 lg:absolute lg:right-7.5 lg:top-[24.3125rem]">
      {stats.map((stat, index) => (
        <Inview
          key={stat.label}
          tag="li"
          className={`flex flex-col justify-center gap-3 rounded-card border bg-surface p-4 lg:w-[11.875rem] lg:p-6 ${
            stat.accented ? "border-accent" : "border-hairline"
          }`}
          from={LIFT_OUT}
          to={LIFT_IN}
          config={REVEAL_SPRING}
          delayIn={REVEAL_DELAY.stats + index * REVEAL_DELAY.statStep}
          mode="once"
          enabled={isRevealed}
        >
          <p className="text-stat italic leading-none">{stat.value}</p>
          <p className="font-mulish text-body leading-[1.2]">{stat.label}</p>
        </Inview>
      ))}
    </ul>
  );
};

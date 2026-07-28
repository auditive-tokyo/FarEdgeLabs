"use client";

import Image from "next/image";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/preloader";
import { homeContent } from "@/data/mocks/home";

import { LIFT_IN, LIFT_OUT, REVEAL_DELAY, REVEAL_SPRING } from "./reveal";

export interface HeroTrustProps {
  trust: typeof homeContent.hero.trust;
}

/**
 * The bottom-right social-proof pill — Figma 681:268.
 *
 * The avatars are decorative — the pill's own label carries the meaning — so
 * they take an empty `alt` rather than inventing descriptions of strangers.
 *
 * The pill keeps its shape on a phone and just gives up the frame's fixed
 * width — it is already a single row, and a short label beside three faces is
 * as legible at 375 as at 1440.
 */
export const HeroTrust = ({ trust }: HeroTrustProps) => {
  const isRevealed = useIntroRevealed();

  return (
    <Inview
      tag="div"
      className="flex h-[3.1875rem] items-center justify-between rounded-full border border-hairline bg-surface py-0.5 pl-6 pr-0.5 lg:absolute lg:bottom-7.5 lg:right-7.5 lg:w-[24.25rem]"
      from={LIFT_OUT}
      to={LIFT_IN}
      config={REVEAL_SPRING}
      delayIn={REVEAL_DELAY.trust}
      mode="once"
      enabled={isRevealed}
    >
      <p className="text-body leading-[1.2] lg:w-[13.8125rem]">{trust.label}</p>
      <ul className="flex items-center">
        {trust.avatars.map((avatar, index) => (
          <li
            key={avatar.src}
            className={index < trust.avatars.length - 1 ? "-mr-3" : undefined}
          >
            <Image
              src={avatar.src}
              alt={avatar.alt}
              width={47}
              height={47}
              className="size-[2.9375rem] rounded-full"
            />
          </li>
        ))}
      </ul>
    </Inview>
  );
};

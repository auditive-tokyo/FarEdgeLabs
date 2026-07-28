"use client";

import { Hover } from "@/components/animation/springs/hover";
import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/preloader";

import {
  HOVER_SPRING,
  LIFT_IN,
  LIFT_OUT,
  REVEAL_DELAY,
  REVEAL_SPRING,
} from "./reveal";

export interface HeroRequestProps {
  cta: string;
}

/**
 * The bottom-left request form — Figma 681:364.
 *
 * The design draws "Name" and "Email" as static text; they are real labelled
 * inputs here, since that is what the mockup depicts. Placeholders alone are
 * not labels, so each carries a visually-hidden one.
 *
 * > [!note] Submission is not wired — see obsidian/meta/changelog.md.
 *
 * On a phone the pill unrolls into a card: three full-width rows are reachable
 * with a thumb, where the frame's single row would put two ~40px-wide fields and
 * a button across 375px. The radius steps from `full` to the stat cards' corner
 * — a tall stack with fully round ends reads as a lozenge, not a form.
 */
export const HeroRequest = ({ cta }: HeroRequestProps) => {
  const isRevealed = useIntroRevealed();

  return (
    <Inview
      tag="form"
      id="request"
      className="flex flex-col gap-3 rounded-card bg-foreground p-4 lg:absolute lg:bottom-7.5 lg:left-7.5 lg:flex-row lg:items-center lg:gap-[0.6875rem] lg:rounded-full lg:py-0.5 lg:pl-8 lg:pr-0.5"
      from={LIFT_OUT}
      to={LIFT_IN}
      config={REVEAL_SPRING}
      delayIn={REVEAL_DELAY.request}
      mode="once"
      enabled={isRevealed}
    >
      <label htmlFor="request-name" className="sr-only">
        Name
      </label>
      <input
        id="request-name"
        name="name"
        type="text"
        autoComplete="name"
        placeholder="Name"
        className="w-full bg-transparent text-body leading-[1.2] text-surface placeholder:text-surface focus-visible:outline-none lg:w-[9.375rem]"
      />

      <label htmlFor="request-email" className="sr-only">
        Email
      </label>
      <input
        id="request-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Email"
        className="w-full bg-transparent text-body leading-[1.2] text-surface placeholder:text-surface focus-visible:outline-none lg:w-[9.375rem]"
      />

      {/* `<Hover>` wraps the button rather than being it: its props are typed as
          generic HTML attributes, so `type="submit"` would not pass through,
          and a submit button that only submits by default is a trap. The span
          is the button's exact box, so the hover target is unchanged. */}
      <Hover
        tag="span"
        className="flex w-full lg:w-auto"
        from={{ scale: 1 }}
        to={{ scale: 1.02 }}
        config={HOVER_SPRING}
      >
        <button
          type="submit"
          className="flex h-[2.9375rem] w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-body leading-[1.2]"
        >
          {cta}
          {/* One box, not a dot inside a disc. The ring is thinner than a device
              pixel at most scales, and two nested boxes snap their painted edges
              to the pixel grid independently — so the ring came out lopsided
              (0.67px one side, 1.33px the other) at most window widths. A border
              is painted as one box and cannot de-centre. */}
          <span
            aria-hidden="true"
            className="size-[0.5625rem] rounded-full border-[0.0625rem] border-foreground bg-surface"
          />
        </button>
      </Hover>
    </Inview>
  );
};

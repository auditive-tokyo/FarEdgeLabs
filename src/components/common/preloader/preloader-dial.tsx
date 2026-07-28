"use client";

// 📖 Docs: obsidian/frontend/components/common.md

import { animated, type SpringValue } from "@react-spring/web";

/**
 * Ring geometry, in its own SVG units — Figma 682:846. The design's arc is a
 * 591px circle, and `pathLength` normalises it to 1 so the dash maths is just
 * the progress value.
 */
const RING = { size: 591, centre: 295.5, radius: 295 } as const;

/**
 * Turns the disc makes over one count.
 *
 * Driven off `progress` rather than a looping spring of its own: a loop would
 * spin on after the count has landed, and — because `<ReducedMotion>` flips
 * react-spring's global `skipAnimation` — each iteration would finish the
 * instant it started and restart, with nothing to pace it.
 */
const SPIN_TURNS = 2;

export interface PreloaderDialProps {
  /** 0 → 1. Fills the ring, counts the label, and turns the disc. */
  progress: SpringValue<number>;
}

/**
 * The preloader's dial — a spinning gradient disc inside a filling ring, with
 * the percentage beneath. Figma 682:837.
 *
 * Sizes are the frame's, in `rem`, so the grid scales the dial with everything
 * else.
 */
export const PreloaderDial = ({ progress }: PreloaderDialProps) => {
  return (
    <div className="relative grid size-full place-items-center">
      {/* 591px */}
      <svg
        viewBox={`0 0 ${RING.size} ${RING.size}`}
        className="absolute size-[36.9375rem] text-white"
        aria-hidden="true"
      >
        <animated.circle
          cx={RING.centre}
          cy={RING.centre}
          r={RING.radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          /* An SVG circle starts at 3 o'clock; the design starts the sweep at 6,
             where the disc's own seam sits. */
          transform={`rotate(90 ${RING.centre} ${RING.centre})`}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={progress.to((value) => 1 - value)}
        />
      </svg>

      {/* 299px. The seam of a conic gradient is its hard wrap — the design puts
          it at 6 o'clock, hence `from 180deg`. */}
      <animated.span
        aria-hidden="true"
        className="size-[18.6875rem] rounded-full bg-[conic-gradient(from_180deg,var(--preloader-dial-from),var(--preloader-dial-to))]"
        style={{
          rotate: progress.to((value) => `${value * 360 * SPIN_TURNS}deg`),
        }}
      />

      {/* 603px down a 800px frame = 203px below its centre. */}
      <animated.p className="absolute top-[calc(50%+12.6875rem)] text-stat italic leading-none text-white">
        {progress.to((value) => `${Math.round(value * 100)}%`)}
      </animated.p>
    </div>
  );
};

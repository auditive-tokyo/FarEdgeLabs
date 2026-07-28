"use client";

// 📖 Docs: obsidian/frontend/components/common.md

import { animated, useSpring } from "@react-spring/web";
import { useEffect, useState } from "react";

import { markIntroRevealed } from "./intro-state";
import { PreloaderDial } from "./preloader-dial";

/** How long the count takes, ms. */
const COUNT_MS = 2200;

/**
 * `clamp` matters: a curtain that overshoots -100% would swing back down and
 * flash its bottom edge across the page it just uncovered.
 */
const LIFT_SPRING = { tension: 110, friction: 24, clamp: true } as const;

/**
 * How far the veil trails the ground, ms. The design catches the pair
 * mid-lift with 115px of green showing under an 800px frame — about a seventh
 * of the travel.
 */
const VEIL_DELAY = 150;

export interface PreloaderProps {
  className?: string;
}

/**
 * Full-screen intro — Figma 682:837 (counting) → 682:886 (lifting).
 *
 * Two curtains: a black one carrying the dial, and the brand-green one behind
 * it. The count fills the ring; when it lands, the black lifts away and the
 * green follows a beat later, so the page is uncovered in two passes rather
 * than one.
 *
 * Unmounts once the green is clear — it covers the viewport and would swallow
 * every pointer event if it lingered.
 *
 * The lift is announced through [[intro-state]] the moment it *begins*, and the
 * hero animates itself in from there (`src/views/home/reveal.ts`).
 *
 * > [!important] Announce the lift, not the landing
 * > Waiting for the curtains to be gone leaves the page sitting blank while they
 * > clear: the black lifts to show the green, the green lifts to show the page,
 * > and that whole ~650ms the page is visible and doing nothing — then the wave
 * > still has to accelerate from rest. It reads as a white screen, and it was
 * > reported as one.
 * >
 * > This was briefly moved to the landing to chase a "blur during the loader",
 * > which turned out to be the halftone's crest, not the timing (see
 * > [[components/common]] → `<HalftoneVideo>` `reveal`). Fixing the wrong thing
 * > cost the page a second of blank; the artefact is gone and the signal is back
 * > where it belongs.
 *
 * Reduced motion needs no special case: `<ReducedMotion>` flips react-spring's
 * global `skipAnimation`, so the count lands immediately, the curtains leave,
 * and the intro is simply skipped.
 */
export const Preloader = ({ className = "fixed inset-0 z-100" }: PreloaderProps) => {
  const [isLifting, setIsLifting] = useState(false);
  const [isGone, setIsGone] = useState(false);

  const [{ progress }] = useSpring(() => ({
    from: { progress: 0 },
    to: { progress: 1 },
    // Linear: a counter that eases looks like it is lying about the wait.
    config: { duration: COUNT_MS },
    onRest: () => setIsLifting(true),
  }));

  const ground = useSpring({
    y: isLifting ? "-100%" : "0%",
    config: LIFT_SPRING,
  });

  const veil = useSpring({
    y: isLifting ? "-100%" : "0%",
    delay: isLifting ? VEIL_DELAY : 0,
    config: LIFT_SPRING,
    onRest: () => {
      if (isLifting) setIsGone(true);
    },
  });

  useEffect(() => {
    if (isLifting) markIntroRevealed();
  }, [isLifting]);

  if (isGone) return null;

  return (
    <div aria-hidden="true" className={`${className} overflow-hidden`}>
      <animated.div
        className="absolute inset-0 bg-preloader-veil"
        style={{ y: veil.y }}
      />
      <animated.div
        className="absolute inset-0 bg-preloader-ground"
        style={{ y: ground.y }}
      >
        <PreloaderDial progress={progress} />
      </animated.div>
    </div>
  );
};

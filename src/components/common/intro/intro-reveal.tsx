"use client";

// 📖 Docs: obsidian/frontend/components/common.md

import { useEffect } from "react";

import { markIntroRevealed } from "./intro-state";

/**
 * Starts the page's entrance. Renders nothing.
 *
 * Mount it once, in the root layout. In an effect rather than at module scope so
 * it runs after hydration: the sections read the signal through
 * `useSyncExternalStore`, whose server snapshot is `false`, and flipping it
 * during render would make the first client render disagree with the HTML.
 *
 * This replaced a full-screen loader that held the page for a fixed 2200ms while
 * measuring nothing. What it was actually providing was a starting gun, so that
 * is all that is left — the entrance choreography is unchanged, it simply begins
 * as soon as the page is interactive.
 */
export const IntroReveal = () => {
  useEffect(() => {
    markIntroRevealed();
  }, []);

  return null;
};

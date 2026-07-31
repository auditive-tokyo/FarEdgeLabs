"use client";

// 📖 Docs: obsidian/frontend/components/common.md

/**
 * When the page starts revealing itself.
 *
 * Every section holds its animation at rest until this flips, then plays on the
 * stagger in `src/views/home/reveal.ts`. Nothing in the DOM says when to start,
 * so one publisher announces it and the sections subscribe.
 *
 * This used to be the moment a full-screen loader's curtains began to lift.
 * There is no loader any more — it counted a fixed 2200ms and measured nothing —
 * so `<IntroReveal>` announces on mount instead. The signal is kept rather than
 * deleted because it is what sequences the entrance: without it every section
 * would have to decide for itself when "now" is, and they would drift apart.
 *
 * A module-level store rather than context: the publisher is mounted in the root
 * layout and the subscribers are page sections, so a provider would have to wrap
 * the whole tree to join two ends that never render together.
 */

import { useSyncExternalStore } from "react";

let isRevealed = false;
const listeners = new Set<() => void>();

/**
 * Announce that the page is revealing. Called by `<IntroReveal>` only.
 * Idempotent — the intro plays once per page load, and never rewinds.
 */
export const markIntroRevealed = (): void => {
  if (isRevealed) return;
  isRevealed = true;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): boolean => isRevealed;

/**
 * The server has no intro to run, so SSR paints the resting state — which is
 * also what a visitor with JavaScript disabled is left looking at. Worth
 * remembering before adding a section whose resting state is invisible.
 */
const getServerSnapshot = (): boolean => false;

/**
 * Whether the page has started revealing yet.
 *
 * Reduced motion needs no special case: `<ReducedMotion>` flips react-spring's
 * global `skipAnimation`, so every spring lands on its first frame and skips its
 * `delay` — the staggered choreography collapses to "everything is simply
 * already there".
 */
export const useIntroRevealed = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

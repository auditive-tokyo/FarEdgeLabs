"use client";

// 📖 Docs: obsidian/frontend/components/common.md

/**
 * When the intro stops covering the page.
 *
 * The hero animates *behind* the preloader's curtains, so it needs to know when
 * to start — but nothing in the DOM tells it. `<Preloader>` publishes the moment
 * its count lands and the curtains begin to lift; every section subscribes and
 * passes the flag to its animation's `enabled` prop, which holds each spring at
 * its resting state until then.
 *
 * A module-level store rather than context: the publisher is mounted in the root
 * layout and the subscribers are page sections, so a provider would have to wrap
 * the whole tree to join two ends that never render together.
 */

import { useSyncExternalStore } from "react";

let isRevealed = false;
const listeners = new Set<() => void>();

/**
 * Announce that the page is being uncovered. Called by `<Preloader>` only.
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

/** The server never runs the intro, so SSR always paints the covered state. */
const getServerSnapshot = (): boolean => false;

/**
 * Whether the intro has uncovered the page yet.
 *
 * Reduced motion needs no special case: `<ReducedMotion>` makes the count land
 * on its first frame, so this flips true immediately — and react-spring skips
 * `delay` entirely while `skipAnimation` is set, so the staggered choreography
 * downstream collapses to "everything is simply already there".
 */
export const useIntroRevealed = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

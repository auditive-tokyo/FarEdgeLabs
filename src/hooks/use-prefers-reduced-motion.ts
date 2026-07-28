/**
 * Tracks the OS "reduce motion" accessibility setting.
 *
 * `<ReducedMotion>` covers react-spring's own animations globally, but motion
 * driven outside react-spring — a playing video, a time-driven shader — has to
 * honour the preference itself. Delivered through `useSyncExternalStore`, so it
 * is SSR-safe and tear-free.
 */

"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribe = (listener: () => void): (() => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};

export const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );

/**
 * Whether the primary pointer is coarse — a finger rather than a mouse.
 *
 * Not a viewport question, so a width breakpoint cannot answer it: a narrow
 * desktop window still has a mouse, and a large tablet still does not. Used to
 * pick *how* a feature works on touch, not whether it is offered.
 *
 * Delivered through `useSyncExternalStore`, so it is SSR-safe and tear-free.
 * The server snapshot is `false`: it only selects behaviour inside effects and
 * the render loop, never markup, so it cannot cause a hydration mismatch.
 */

"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

const subscribe = (listener: () => void): (() => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};

export const useCoarsePointer = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );

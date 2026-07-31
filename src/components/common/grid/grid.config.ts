// 📖 Docs: obsidian/frontend/components/common.md

/**
 * Adaptive scaling grid configuration.
 *
 * The grid keeps a rem-based design proportional across viewports by scaling
 * the root (`<html>`) font-size. Each breakpoint maps a viewport `maxWidth` to
 * the design `baseWidth` it was laid out at — at `baseWidth` the root
 * font-size equals `FONT_BASE` and rem values match the design 1:1.
 *
 * - Scaling DOWN (viewport at or below `GRID_BASE_WIDTH`) is driven by the
 *   `vw` media queries in `src/app/globals.css`.
 * - Scaling UP (viewport above `GRID_BASE_WIDTH`) is driven at runtime by the
 *   `AdaptiveGrid` component / `useAdaptiveGrid` hook.
 *
 * Changing these values means updating the `html` media queries in
 * `globals.css` to match — the formula is:
 *   font-size: FONT_BASE * 100 / baseWidth  (vw)
 */

/** Root font-size (px) the design is measured against. */
export const FONT_BASE = 16;

/**
 * Viewport width (px) at which the grid range starts.
 *
 * Below it the layout **reflows** rather than scaling, and the root font-size is
 * left to the browser (and so to the user's own preference). Scaling has a floor
 * in practice: shrinking a 1440-wide frame onto a 375px phone is a miniature of
 * the design, not an adaptation of it — it resolved to a 4.17px root and 4px
 * body copy.
 *
 * This is **not** a `GRID_BREAKPOINTS` entry, and must not become one: a
 * breakpoint claims a frame exists at its base width and rescales the artwork to
 * it. Nothing is drawn for mobile, so nothing is scaled — the sections lay
 * themselves out with `lg:` prefixes instead. Keep in sync with the `html` media
 * query in `globals.css`.
 */
export const GRID_MIN_WIDTH = 1024;

/**
 * Design base height (px) — the frame's own height.
 *
 * The scale is capped against this as well as `baseWidth`, because scaling on
 * width alone makes the composition `width / aspect` tall: the 1440×800 frame
 * is 1.8:1, and a typical window is wider than that, so a width-only scale
 * renders it taller than the viewport and the page scrolls. Capping by height
 * keeps it whole on screen; the spare width goes between the edge-anchored
 * pieces, which is what keeps them on the edges.
 */
export const GRID_BASE_HEIGHT = 800;

export interface GridBreakpoint {
  /** Media-query `max-width` threshold (px). */
  maxWidth: number;
  /** Design base width (px) the range was laid out at. */
  baseWidth: number;
}

/**
 * Breakpoints, largest first.
 *
 * One entry, because there is one design: the Figma frame is 1440 wide and
 * nothing has been drawn for the other widths. Every breakpoint listed here
 * claims "a design exists at this base width", and a range whose base doesn't
 * match the artwork rescales it by the ratio between the two — a 1440 layout
 * under a 1920 base renders at 75%, and crossing the boundary makes it jump.
 * Add a breakpoint back when — and only when — its frame exists.
 */
export const GRID_BREAKPOINTS: readonly GridBreakpoint[] = [
  { maxWidth: 1440, baseWidth: 1440 },
];

/** Largest breakpoint width — above it the root font-size scales up. */
export const GRID_BASE_WIDTH = Math.max(
  ...GRID_BREAKPOINTS.map((bp) => bp.maxWidth),
);

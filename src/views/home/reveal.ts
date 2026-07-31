/**
 * The hero's entrance — one place for the whole choreography.
 *
 * Every section holds at its resting state until `useIntroRevealed()` flips
 * (see `src/components/common/intro/intro-state.ts`), then leans on the delays
 * below to space itself out.
 *
 * `0` is now the first visible frame. It used to be roughly 650ms before it: the
 * signal fired when a full-screen loader's curtains *began* to lift, so the
 * early delays were spent behind them. That loader is gone (decisions-log
 * ADR-0019) and the signal fires on mount, which means every millisecond here is
 * a millisecond the visitor spends watching. The whole sequence now runs about
 * 1.1s — long for a page someone came to read. Treat these as a budget to spend
 * down rather than one to fill.
 *
 * The order is the reading order: the headline first, then the frame around it,
 * then the copy, then the panels along the bottom.
 *
 * Reduced motion needs no branch here: react-spring drops `delay` entirely
 * while `skipAnimation` is set, so every number below collapses to zero.
 */

/**
 * ms after the curtains begin to lift.
 *
 * The halftone field is absent on purpose: it starts developing the instant the
 * signal fires and its wave takes some 2.5s to climb, so it underruns everything
 * here rather than taking a slot of its own. The curtains uncover the page from
 * the bottom, which is where the wave starts — so the field is already
 * developing exactly where it first shows. See `<HalftoneVideo>`'s `reveal` prop.
 */
export const REVEAL_DELAY = {
  /** The star, and first — the eye is already on it. */
  headline: 200,
  brand: 320,
  nav: 400,
  rule: 420,
  cta: 480,
  lead: 500,
  stats: 560,
  /** Per stat card, on top of `stats`. */
  statStep: 80,
  body: 620,
  /** Late on purpose: the bar arrives under a word that has already landed. */
  headlineBar: 1100,
} as const;

/**
 * The house spring — overdamped (ζ ≈ 1.45), so it glides the whole way and
 * settles without a bounce. Everything that enters uses it; "soft and smooth"
 * is this curve, and one curve across the page is what makes the entrance read
 * as a single move rather than a pile of separate ones.
 */
export const REVEAL_SPRING = { tension: 80, friction: 26 } as const;

/**
 * Hovers answer a pointer, so they are quicker than the entrance — but still
 * critically damped (ζ ≈ 0.97), never springy.
 */
export const HOVER_SPRING = { tension: 240, friction: 30 } as const;

/**
 * How far a letter starts to the left of home, and how far a word starts below
 * it. Both in `rem`, so the adaptive grid scales the travel with the type.
 *
 * > [!warning] Unit strings on both ends
 * > A spring key must keep one type across its In and Out states — `x: 0` with
 * > `x: '-1.25rem'` throws *"Cannot animate between _AnimatedString and
 * > _AnimatedValue"*. Hence `'0rem'` rather than `0` in the In states below.
 */
export const LETTER_OUT = {
  opacity: 0,
  x: "-1.25rem",
  filter: "blur(0.625rem)",
} as const;

export const LETTER_IN = {
  opacity: 1,
  x: "0rem",
  filter: "blur(0rem)",
} as const;

export const WORD_OUT = {
  opacity: 0,
  y: "0.875rem",
  filter: "blur(0.5rem)",
} as const;

export const WORD_IN = {
  opacity: 1,
  y: "0rem",
  filter: "blur(0rem)",
} as const;

/** ms between neighbouring letters / words. */
export const LETTER_STAGGER = 26;
export const WORD_STAGGER = 45;

/** The lift every pill and card enters on — no blur, only the text is blurred. */
export const LIFT_OUT = { opacity: 0, y: "1rem" } as const;
export const LIFT_IN = { opacity: 1, y: "0rem" } as const;

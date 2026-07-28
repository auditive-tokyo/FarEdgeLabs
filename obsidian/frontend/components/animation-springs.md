---
tags: [frontend, animation, stable, do-not-modify]
updated: 2026-07-15
---

# Catalog — Spring Components

Files in `src/components/animation/springs/`. The animation engine — `#do-not-modify`.
Conceptual overview: [[animation-system]].

All components accept `tag` (semantic HTML element), `className`, and react-spring
`config`. Each is `"use client"`.

## `<Inview>` — `in-view.tsx`

Springs `from` → `to` when the element enters the viewport (IntersectionObserver).

- `mode`: `"once"` (play once, stay) · `"always"` (reverse on leave) · `"forward"`
  (only on downward scroll).
- `delayIn` / `delayOut`, `immediateOut`, `disableOnMobile`.
- `trigger` — optional external element to observe. Omit it and the component
  observes its own rendered element (the common case).
- `innerTag` / `innerClassName` — the inner animated wrapper.
- `enabled` — a second gate on top of the viewport: `false` pins it to `from`,
  and it plays once the flag *and* `inView` are both true. This is how the hero
  waits for the preloader — see [[decisions-log]] ADR-0016.

> [!warning] Springs write `transform` — so does Tailwind
> The spring's `style` lands on the rendered tag, so `x` / `y` / `scale` **erase
> a `-translate-x-1/2`** (or any transform utility) on the same element. Keep
> them apart: a bare positioning shell holds the centring transform, and the
> spring drives a child. The site header's nav pill does exactly this — the
> `<nav>` centres, the `<ul>` animates.

## `<Spring>` — `spring.tsx`

Unconditional spring driven by mount / the `enabled` flag. Same `mode` set as
`<Inview>`. Use when motion shouldn't depend on the viewport.

## `<SpringTrigger>` — `spring-trigger.tsx`

Scroll-progress animation between two trigger points.

- `mode`: `"scrub"` (continuously interpolate with scroll — parallax, progress bars)
  · `"toggle"` (snap between `from`/`to` at the trigger point).
- `start` / `end` — `TriggerPos` strings (see [[text-engine]]).
- `trigger` — optional external scroll-reference element.
- `onChange({ progress, interpolatedProgress })` callback.
- `frameInterval` — throttle for the scroll handler.

## `<ProgressTrigger>` — `progress-trigger.tsx`

Tracks scroll position and emits a normalised **0–1 progress** value via
`onChange` — no animation of its own. Use to drive custom logic.

## `<Hover>` — `hover.tsx`

Spring on mouse enter/leave. `from` is the **resting** state and `to` the hovered
one. Disabled on mobile by default (`disableOnMobile.hover` is always `true`).
`trigger` lets a different element fire the hover.

> [!note] It wraps a button — it does not become one
> Its props are typed as generic `HTMLAttributes`, so `type="submit"` will not
> pass through `tag="button"`, and a submit button that only submits by *default*
> is a trap. Wrap the real `<button>` in `<Hover tag="span" className="flex">`:
> the span is the button's exact box, so the hover target is unchanged.

## `<Handle>` — `handle.tsx`

Smooth enter/exit when `children` change — caches previous content during the
transition. Configurable `from`/`to`, `delayIn`/`delayOut`, `enabled`.

## `<AnimatedVarTextTag>` — `animated-var-text-tag.tsx`

Low-level primitive: renders `animated[tag]` with a forwarded ref. Building block
for the other components — rarely used directly.

## Related

[[animation-system]] · [[hooks]] · [[components/common]]

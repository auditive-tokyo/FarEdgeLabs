---
tags: [frontend, animation, stable]
updated: 2026-07-15
---

# Text Engine — `spring-text-engine`

All **text animation** is handled by the `spring-text-engine` package (`^0.1.5`).
**Do not build custom text-animation components.** For non-text motion see
[[animation-system]].

- Package: `spring-text-engine` · peer dep `@react-spring/web`
- Playground & docs: [textengine.textura.agency](https://textengine.textura.agency)
- Full API reference: [[text-engine-reference]]

## Import

```tsx
import TextEngine from 'spring-text-engine';
import { tengine } from 'spring-text-engine';            // factory pattern
import type { TextEngineInstance } from 'spring-text-engine';
```

## How it works

`TextEngine` splits `children` into **letter / word / line** slots and drives each
with an independent spring. Mixed children work — plain strings animate alongside
`<span>`, `<strong>`, icons, SVGs.

Nested layers (only rendered when their `*In` prop is set):

```
wrapLine → line → wrapWord → word → wrapLetter → letter
```

Each layer has an `In` (enter) and `Out` (resting/exit) target. Set `Out` to the
hidden resting state, `In` to the visible destination.

## Modes

| Mode | Behaviour |
|------|-----------|
| `"always"` *(default)* | Plays in on enter, out on leave. Repeats. |
| `"once"` | Plays in once, never replays. |
| `"forward"` | Plays in on downward scroll only. |
| `"manual"` | Imperative — `instance.playIn()` etc. **Avoid in this project.** |
| `"progress"` | Driven by scroll between `start`/`end`. Sub-modes `toggle` / `interpolate`. |

> [!important] Project rule
> **NEVER use `mode="manual"`.** Always use `"always"`, `"once"`, `"forward"`, or
> `"progress"` — project hard rule, see [[ai-agent-guide]].

## Common patterns

**Line-by-line heading reveal**
```tsx
<TextEngine
  tag="h1"
  lineIn={{ y: '0%', opacity: 1 }}
  lineOut={{ y: '100%', opacity: 0 }}
  lineStagger={100}
  lineConfig={{ duration: 900, easing: easings.easeOutCubic }}
  overflow
>
  Your heading text
</TextEngine>
```

> [!warning] Match value types across `In` / `Out`
> A spring key must use the **same type** in its `In` and `Out` states — all
> numbers, or all unit strings. Mixing them (e.g. `y: 0` with `y: '100%'`) throws
> *"Cannot animate between _AnimatedString and _AnimatedValue"* at runtime. For a
> clipped line reveal use `y: '0%'` / `y: '100%'`; for a pixel slide use `y: 0` /
> `y: 60`.

**Word-by-word fade-up (body copy)**
```tsx
<TextEngine
  tag="p"
  wordIn={{ y: 0, opacity: 1 }}
  wordOut={{ y: 40, opacity: 0 }}
  wordStagger={60}
  wordConfig={{ duration: 700, easing: easings.easeOutQuart }}
>
  Animate every word independently
</TextEngine>
```

**Scroll-driven progress** — `mode="progress"` with `type="interpolate"` (smooth)
or `type="toggle"` (snap), plus `start`/`end` trigger positions. Not currently
used — the home page has no scroll.

**Play after something that isn't scroll** — pass a flag to `enabled`. The engine
holds every spring at its `*Out` state while it is false and plays on the edge to
true, so it needs no viewport event. The hero uses this to wait for the preloader
([[components/common]] → `useIntroRevealed`, [[decisions-log]] ADR-0016):
```tsx
<TextEngine
  tag="h1"
  mode="once"                    // never "manual" — hard rule
  enabled={isRevealed}
  delayIn={480}
  letterOut={{ opacity: 0, x: '-1.25rem', filter: 'blur(0.625rem)' }}
  letterIn={{ opacity: 1, x: '0rem', filter: 'blur(0rem)' }}
  letterStagger={26}
  letterConfig={{ tension: 80, friction: 26 }}
>
  {headline} <i>{accent}</i>
</TextEngine>
```
`filter: blur(…)` animates: react-spring interpolates the number inside any
string, so long as **both ends carry the unit** (see the type warning above —
`blur(0rem)`, never `blur(0)`). `rem` on `x`/`y`/`blur` keeps the travel scaling
with the type under the adaptive grid.

## What the engine does to your layout

Three facts that are easy to lose an hour to:

> [!warning] The root is a wrapping **flex** container
> `TextEngine` writes `display: flex; flex-wrap: wrap; column-gap: 0.3em`
> (`columnGap`) into its root's inline style. So:
> - **`<br>` does nothing.** It has no children, so it parses as a *node token*
>   and becomes just another flex item. Force the break with the **box** — size
>   the container so the line wraps naturally — or use two engines.
> - Word spacing comes from `column-gap`, not from your spaces.
> - Line spacing is the items' own `line-height`, so `leading-*` still works.

> [!warning] The root is forced `position: relative`
> It is inline style, which beats a class — an `absolute` utility **on the engine
> itself is silently dropped**. Put the positioning on a wrapper and leave the
> engine carrying only type.

**Nested elements keep animating.** `<i>foo</i>` inside the children is a
*wrapper token*: it renders with `display: contents` and its words/letters join
the parent's stagger, one continuous index across the whole string. A childless
element (an SVG, an `<img>`) is a *node token* and animates as a single word.

**Factory shorthand** — `tengine.h2` returns a pre-tagged `TextEngine`:
```tsx
const H2 = tengine.h2;
<H2 mode="once" lineIn={{ y: 0, opacity: 1 }} lineOut={{ y: 60, opacity: 0 }}>…</H2>
```

## Key prop groups

- **Animation values:** `lineIn/Out`, `wordIn/Out`, `letterIn/Out` (+ `wrap*` variants).
- **Configs:** `lineConfig`, `wordConfig`, `letterConfig` (+ directional `*In`/`*Out`).
- **Timing:** `delayIn/Out`, per-layer `*DelayIn/Out`, `*Stagger` (+ directional).
- **Behaviour:** `enabled` (master gate — holds at `*Out` until true), `overflow`
  (clip for slide-ins), `immediateOut`, `seo` (hidden plain-text copy for
  crawlers — default `true`; it is what gives an `<h1>` an accessible name while
  its letters sit at `opacity: 0`, and it puts `aria-hidden` on the animated
  copy — so **never turn it off on a heading**).
- **Progress:** `type`, `start`, `end`, `trigger`, `interpolationStaggerCoefficient`.

Full prop tables: [[text-engine-reference]].

## Trigger position format

Shared with scroll components: `"<element-edge> <viewport-edge>[±=px]"`.

| Example | Meaning |
|---------|---------|
| `"top bottom"` | progress 0 when element top hits viewport bottom |
| `"bottom top"` | progress 1 when element bottom hits viewport top |
| `"top bottom+=200"` | start 200 px later |
| `"center center"` | element centre meets viewport centre |

## Imperative API

Via `ref` / `onTextEngine`: `playIn()`, `playOut()`, `togglePause()`,
`progress.current` (0–1), plus read-only `lines` / `words` / `letters`.
(Not used in normal scroll-driven flows.)

## Related

[[animation-system]] · [[text-engine-reference]]

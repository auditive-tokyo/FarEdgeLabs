---
tags: [frontend, design-system, stable]
updated: 2026-07-15
---

# Design System — Tailwind v4

Styling uses **Tailwind CSS v4**, configured entirely in CSS. There is **no
`tailwind.config.js`**. ADR: [[decisions-log]] ADR-0004.

## Where config lives

`src/app/globals.css` is the single config file:

```css
@import "tailwindcss";

:root {
  --background: #f0f3f4;
  --foreground: #000000;
  --size-display: 2.5rem;
}

@media (min-width: 1024px) {
  :root { --size-display: 5rem; }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-general-sans);
  --text-display: var(--size-display);
}
```

`:root` holds the raw values and `@theme inline` binds them. Bind through a
`var()`, never a literal — a literal is inlined into the utility and nothing can
override it afterwards (see *Type scale* below).

Extra CSS layers can be split into `src/style/index.css` and imported.

## Design tokens

All colours, spacing, font sizes, radii, and shadows are **tokens** declared under
`:root` (raw values) and `@theme inline` (Tailwind bindings).

Once a token is in `@theme`, it becomes a utility automatically:

| Token | Generated utilities |
|-------|--------------------|
| `--color-brand` | `bg-brand`, `text-brand`, `border-brand` |
| `--radius-card` | `rounded-card` |
| `--spacing-section` | `pt-section`, `mt-section`, … |

> [!important] The token rule
> **Never** hardcode hex values, pixel spacing, or named colours in `className` or
> inline styles. If a value doesn't exist as a token, **add it to `globals.css`
> first** — with a comment noting where it came from (e.g. a Figma frame).

## CSS layers

Every custom style goes inside a layer — never outside one:

```css
@layer base {        /* element resets & defaults: h1, p, a … */ }
@layer components {  /* pseudo-elements & 3rd-party overrides only — see below */ }
@layer utilities {   /* single-purpose helpers: .scrollbar-none … */ }
```

## Where a style goes (ADR-0012)

`globals.css` is **not** a place to park component styles — it holds tokens and
base resets and stays a few hundred lines forever. Follow this order; the first
match wins:

| Situation | Goes where |
|-----------|-----------|
| One-off styling | Tailwind utilities in `className` — nothing in CSS |
| Repeated pattern with markup / structure / props | a **React component** in `components/ui/` |
| Repeated *pure-utility* combo, no structure | a Tailwind v4 `@utility` |
| Pseudo-elements, 3rd-party DOM overrides, complex selectors | `@layer components` — the genuine exceptions |
| A new colour / spacing / radius value | a **token** in `:root` + `@theme` |

> [!important] The default answer to "this looks repeated" is a **React
> component**, not a CSS class. An eyebrow label with a `::before` dot is an
> `<Eyebrow>` component — not a `.label-eyebrow` global class. `@layer
> components` is for what utilities and components genuinely *cannot* express.

There are **no CSS Modules** in this project — utilities + components cover
every case (motion is spring-based, so there are no keyframes to co-locate).

## Current theme state

Tokens come from the Figma frame *Get Layers* `681:256` (1440×800). The
`@layer base/components/utilities` blocks are empty — fill them per project.

| Token | Role |
|-------|------|
| `--background` / `--foreground` | Page ground and ink (`#f0f3f4` / black) |
| `--accent` | Brand green `#00ff99` — pills, the headline highlight, the ring on accented stat cards. One value throughout |
| `--surface` | Card / pill fill `#fdffff`. Deliberately *not* `--background`: cards must separate from the field behind them |
| `--hairline` / `--hairline-strong` | The design's only borders — black at 10% / 20% |

**Type scale** — named by role, not size, so the design can retune a step
without renaming every usage — **and so one name can carry a different size per
range**:

| Token | Mobile | From `lg` | Used by |
|-------|--------|-----------|---------|
| `--text-display` | 2.5rem / 40px | 5rem / 80px | the headline |
| `--text-stat` | 1.5rem / 24px | 2rem / 32px | stat values |
| `--text-lead` | 1.25rem / 20px | 1.5rem / 24px | the section lead |
| `--text-body` | 1rem / 16px | 1rem / 16px | body, nav, labels, buttons |
| `--text-menu` | 2rem / 32px | — | the mobile menu's links only |

> [!important] The roles are the API; `--size-*` are the values
> `:root` declares `--size-display` etc. at their **mobile** values, a
> `min-width: 1024px` block re-points them at the frame's, and `@theme inline`
> binds `--text-display: var(--size-display)`. So `text-display` resolves to the
> right size on its own — **there is no `lg:text-*` to remember, and no
> `text-display-mobile` twin to keep in sync**. Retuning a step is still one
> line; retuning it *for one range* is one line in the media query.
>
> This works only because the binding is a `var()`. Writing a literal into
> `@theme inline` (as `--text-display: 5rem` once did) inlines it into the
> utility, and no media query can reach it afterwards.

Below `lg` the root font-size is the browser's, so these are real pixels; from
`lg` the grid scales them with the frame. See [[decisions-log]] ADR-0017.

**Radii** — every pill in the design has a radius larger than half its height,
so it resolves to `rounded-full`; only the stat cards have a real corner
(`--radius-card`, 1rem).

**Preloader** — [[components/common|`<Preloader>`]]'s own four:

| Token | Role |
|-------|------|
| `--preloader-ground` | The black curtain |
| `--preloader-veil` | The green curtain — `var(--accent)`, not a colour of its own |
| `--preloader-dial-from` / `--preloader-dial-to` | The dial's conic sweep: the accent round to a teal |

The dial's seam lands on the accent because `--preloader-dial-from` *is* the
accent — the intro and the page share one green.

## Fonts

**General Sans** is the primary face, self-hosted via `next/font/local` from
`src/app/fonts/` — it is not on Google Fonts. Only the four cuts the design uses
are loaded: Light (300) and Regular (400), each with an italic. Bound to
`--font-general-sans` → `--font-sans`.

**Mulish** (`next/font/google`) is loaded for **stat labels only** — that is
what the Figma frame specifies there, while every other label is General Sans.
Exposed as `--font-mulish` → the `font-mulish` utility.

> [!warning] Apply the family with the `font-sans` utility, not CSS
> `@theme inline` resolves `--font-sans` *into utilities* rather than emitting
> it as a custom property, and `next/font` defines `--font-general-sans` on
> `<body>` — not on `:root`. So `body { font-family: var(--font-sans) }` in
> `globals.css` silently resolves to nothing and the page falls back to
> `ui-sans-serif`. `<body>` carries `font-sans` instead.

> [!important] The site is light-only — on purpose
> There is **no `prefers-color-scheme: dark` override**. The halftone field is
> built to read as ink on white paper; inverting the page under it would strand
> the ink on a dark ground. Reintroducing dark mode means restyling that field,
> not just flipping two tokens.

Plus the halftone field tokens used by [[components/common|`<HalftoneVideo>`]]:

| Token | Role |
|-------|------|
| `--halftone-bg` | The unlit cell — an off-white of its own, **not** `var(--background)` |
| `--halftone-ink-light` | Ink ramp start |
| `--halftone-ink-mid` | Ink ramp middle |
| `--halftone-ink-deep` | Ink ramp end |

> [!important] The three inks are a ramp, not a palette
> They are interpolated in order across the frame, so **light → mid → deep must
> climb** or the field stops reading as one surface. The hue travels across them
> (currently lime → green → deep green) — that is what keeps the field from
> reading as a single colour getting darker. Pick replacements as a gradient,
> not as three independent choices.

> [!note] `--halftone-bg` is the page's real backdrop
> The field covers the viewport, so what a visitor reads as "the background" is
> this token, not `--background`. `--background` only surfaces if WebGL2 is
> missing and the raw video takes over. They are free to differ — but if the
> hero ever stops being full-bleed, they need to agree.

They reach the shader through `readCssColor` ([[utils]]) rather than being
hardcoded in GLSL — the token rule holds across the JS/GLSL boundary too. Which
stop a dot lands on is a matter of *where it sits*, not how bright it is; see
[[components/common|`<HalftoneVideo>`]] for why.

> [!tip] Retuning the field is an edit here
> These four are the field's only palette and it reads them once, on mount. A
> dev-only colour panel used to edit them live; it is gone now that they are
> settled, so changing the field means changing these values.

## Typography

See *Fonts* above — **General Sans** (self-hosted) with **Mulish** for stat
labels, both loaded in `src/app/layout.tsx`. Sizes are the `--text-*` role
tokens, not raw values.

## Styling rules

- Use utilities in JSX `className`; keep class strings short and readable.
- Extract a repeated pattern to a **React component** — not a `@layer
  components` class. See *Where a style goes* above (ADR-0012).
- **Mobile-first responsive**, and in this project that has a specific meaning:
  the unprefixed classes are the **phone** layout (flow, scrolls, browser root
  font-size) and `lg:` is the **Figma frame** (absolute coordinates, grid-scaled).
  One DOM serves both — see [[decisions-log]] ADR-0017. Geometry needed by both
  is written in `em` so it scales with the type instead of being duplicated.
- Dark mode: not used — the site is light-only on purpose (see above).
- No inline `style` except for dynamic values (e.g. spring-animated values).

## Related

[[component-conventions]] · [[animation-system]] · [[new-page]]

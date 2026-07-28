---
tags: [frontend, stable]
updated: 2026-07-15
---

# Catalog — Utilities

Pure helper functions in `src/utils/` (no side effects, unless noted).

## `is-bot.ts`

`isBot(): Promise<boolean>` — **server-only**. Reads the `user-agent` header,
returns `true` for crawlers/audit tools. Used to skip heavy animation for bots.
See [[seo-metadata]].

## `scroll-to.ts`

`scrollTo(id?, immediate?)` — programmatic scroll to an element id (string) or a
numeric position. Integrates with the Lenis [[smooth-scroll|scroll store]];
temporarily disables scroll state during the animation. Has `//if lenis` guards so
the Lenis dependency can be stripped if smooth scroll is removed.

## `math.ts`

| Function | Purpose |
|----------|---------|
| `transformRange(value, min, max, newMin, newMax)` | remap a value between ranges (clamped) |
| `lerp(start, end, t)` | linear interpolation |
| `debounce(...)` | debounce helper (used by `useWindowSize`) |

## `lvh.ts`

CSS-string builders for viewport-height units with fallbacks
(`vh` → `lvh` → `calc(var(--vh) …)`): `heightLvh`, `minHeightLvh`, `marginTopLvh`,
`marginBottomLvh`. Solves mobile-browser viewport-height inconsistencies.

## `color.ts`

Bridges CSS colour tokens to WebGL uniforms, so a shader can read a token
instead of hardcoding a value ([[design-system]]).

| Function | Purpose |
|----------|---------|
| `parseCssColor(value)` | parse `#rgb` / `#rrggbb` / `rgb()` / `rgba()` → normalised `Rgb` (0–1), or `null` |
| `readCssColor(element, property, fallback)` | resolve a custom property off an element and parse it, falling back if unset/unparseable |

`Rgb` is a `[number, number, number]` triplet — the form a `vec3` colour uniform
expects. [[components/common|`<HalftoneVideo>`]] reads tokens in; nothing writes
them back out. A `rgbToHex` counterpart lived here to feed `<input type="color">`
in the halftone colour panel — both went when the palette settled.

## `animation/coords.ts`

Element-coordinate helpers — `getElementCoords`, `getScrollCoordsFromElement` —
used internally by the scroll/animation system. Marked `@ts-nocheck`. `#do-not-modify`

## `seo/generate-page-metadata.ts`

`generateMetadata(props?)` — shared page-`Metadata` builder. `generateViewport()`
— the `Viewport` export (carries `themeColor`). See [[seo-metadata]].

## `seo/structured-data.ts`

`getSiteStructuredData()` — builds the `Organization` + `WebSite` JSON-LD graph
rendered by the root layout. See [[seo-metadata]].

## Adding a util

Keep utilities **pure** and side-effect-free (server-only ones like `isBot` are the
exception — note it clearly). Group by domain under `utils/<domain>/`.

## Related

[[hooks]] · [[seo-metadata]] · [[smooth-scroll]]

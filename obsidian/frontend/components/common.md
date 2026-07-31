---
tags: [frontend, stable]
updated: 2026-07-15
---

# Catalog — Common Components

Files in `src/components/common/` — shared infrastructure that may depend on
providers. Conventions: [[component-conventions]].

## Cookie consent — removed

There is no consent banner. The template shipped a self-contained one (banner,
category preferences modal, Zustand store persisting to `localStorage`), and it
was deleted along with `src/components/common/Cookie/`.

The reason is that it had nothing to consent to. It set no cookies -- the store
wrote to `localStorage`, nothing read the result, and no analytics or third-party
tag existed to gate. Asking a visitor to approve storage that never happens is
noise, and the banner also shipped a bug: `acceptAll` saved `analytics: false`,
so "Accept all" and "Reject all" persisted the same thing.

Analytics is **Cloudflare Web Analytics**, which is cookieless and uses no
client-side state, so no consent is required for it.

> [!warning] Reinstate this before adding GA4
> GA4 writes `_ga` / `_ga_<id>` cookies, which are not strictly necessary, and
> Google requires consent signals for EEA visitors (Consent Mode v2). Adding it
> means bringing back a banner *and* wiring the consent state into the tag --
> the old component only ever did the first half. See [[decisions-log]] ADR-0018.

## Grid — adaptive scaling (`grid/`)

The **adaptive scaling grid** keeps a rem-based layout proportional across every
viewport by scaling the root (`<html>`) font-size. Design in `rem` once, and the
whole UI scales as one unit. Lives in `src/components/common/grid/`.

| File | Role |
|------|------|
| `grid.config.ts` | Breakpoints + `FONT_BASE` + `GRID_MIN_WIDTH` — the single source of truth for the grid |
| `adaptive-grid.tsx` | `<AdaptiveGrid>` client component — drives the scale-up, renders `null` |
| `index.ts` | Barrel exports — `AdaptiveGrid`, `GRID_BREAKPOINTS`, … |

**How it works today** — one rule on `html` in `globals.css`, from
`GRID_MIN_WIDTH` (1024) up:

```css
@media (min-width: 1024px) {
  html { font-size: min(1.111111vw, 2vh); } /* 16*100/1440, 16*100/800 */
}
```

Continuous across the whole range above it, so the 1440×800 frame keeps its
proportions and nothing has to hand over at an upper boundary. `grid.config.ts`
holds the matching single breakpoint, `GRID_BASE_HEIGHT` and `GRID_MIN_WIDTH` —
**keep them in sync** (formula:
`min(16 * 100 / baseWidth vw, 16 * 100 / baseHeight vh)`).

> [!important] Scaling has a floor — below it the layout reflows
> Shrinking a 1440-wide frame onto a phone is a miniature, not an adaptation: it
> resolved to a **4.17px root and 4px body copy** at 390px. Below
> `GRID_MIN_WIDTH` there is deliberately **no `font-size` rule at all**, so the
> browser's default applies — which is also the one number on the page the *user*
> is allowed to set. The sections reflow with `lg:` prefixes instead, and the
> type scale carries a second value per role ([[design-system]]).
>
> `GRID_MIN_WIDTH` is **not** a breakpoint and must not become one: a breakpoint
> claims a frame exists at its base width. Nothing is drawn for mobile, so
> nothing is scaled. See [[decisions-log]] ADR-0017.

> [!important] The `vh` half is what stops the page scrolling
> Scaled on width alone, the composition is `width / 1.8` tall — the frame's own
> ratio. Most windows are wider than that (1920×900 is 2.13:1), so it would
> render **taller than the viewport** and scroll. Whichever axis is tighter
> wins, so the frame fits whole; the slack on the looser axis opens up *between*
> the edge-anchored pieces, which is what keeps them on the edges.
>
> This is a property of the *frame*, not of the site: below `GRID_MIN_WIDTH` the
> phone layout scrolls, because that much copy will not fit on a phone screen and
> scrolling is what a phone does.
>
> The trade-off: past 1.8:1 the design stops filling the width, and widening the
> window no longer grows the type. Filling both axes at once means distorting or
> cropping the frame.

> [!important] A breakpoint is a claim that a frame exists
> Each range divides `FONT_BASE` by the width its artwork was drawn at, so a
> range whose base doesn't match the design **rescales it by the ratio between
> the two** — 1440 artwork under a 1920 base renders at 75%, and crossing the
> boundary makes the layout visibly jump. There is one frame (Figma `681:256`,
> 1440), so there is one breakpoint. Add another back when its design exists,
> and re-mount `<AdaptiveGrid>` at the same time.

> [!warning] `<AdaptiveGrid>` is currently **not mounted**
> It exists to scale *up* above the largest breakpoint — and the rule above is
> unbounded *upwards*, so it never hands over and there is nothing to do; its
> `coef` damping would only pull the design away from the frame's proportions.
> (The rule is bounded at the *bottom* by `GRID_MIN_WIDTH`, which is a different
> question — see below.) Kept in the tree for when a second frame arrives. See
> [[decisions-log]] ADR-0015.

**Mounting it again** — root layout, inside `ScrollLayout`, once:
```tsx
import { AdaptiveGrid } from "@/components/common/grid";
```
Props: `baseWidth` (defaults to the largest breakpoint) and `coef` (0–1
scale-up damping, default `0.6666`; `1` is fully proportional).

> [!note]
> This replaced a `styled-components`-based scaling system that was dropped into
> `common/` — see [[decisions-log]] ADR-0008, amended by ADR-0015.
> `styled-components` is **not** a project dependency; the scale CSS lives in
> `globals.css` per [[design-system]].

## HalftoneVideo — `halftone-video/`

`<HalftoneVideo>` — a full-bleed video background rendered as a **soft halftone
dot field** by a WebGL2 shader. The video never paints directly: each frame is
sampled once per cell, that cell's brightness sets the **size** of its dot, and
where the cell **sits** picks its shade off a three-stop ink ramp. Lives in
`src/components/common/halftone-video/`.

| File | Role |
|------|------|
| `halftone-video.tsx` | `<HalftoneVideo>` client leaf — DOM, props, render loop |
| `halftone-renderer.ts` | WebGL2 renderer — draws any `TexImageSource`; `resize` / `render` / `dispose` |
| `shaders.ts` | Vertex + fragment GLSL sources |
| `capture-frames.ts` | Decodes a clip into stills for `pointerScrub` |
| `index.ts` | Barrel export — `HalftoneVideo`, `HalftoneVideoProps` |

The renderer knows nothing about video: it draws whatever image it is handed and
re-uploads only when `sourceKey` changes. The component decides whether that is
a playing `<video>` or a decoded still.

**Mounting** — the home page wraps it in the `HeroField` leaf
(`src/views/home/hero-field.tsx`), which is what knows about the intro:
```tsx
import { HalftoneVideo } from "@/components/common/halftone-video";

<HalftoneVideo src={src} pointerScrub mirror tilt={0.24} reveal={isRevealed} />
```
It sizes itself from the **window** (via `useWindowSize`), so keep it as a fixed
background — its default `className` is `fixed inset-0 -z-10` — rather than
placing it inside a scrolling container.

**Props** — `src` is the only required one. Tuning: `cellSize`, `dotScale`,
`softness`, `gain`, `gamma`, `mirror`, `inkSpread`, `className`. Interaction:
`pointerScrub`, `scrubFrames`, `tilt`. Entrance: `reveal`, `revealBand`.

**`reveal`** — `false` holds the canvas as a blank sheet of `--halftone-bg`;
`true` sends a soft front up the screen over ~2.5s and each cell grows into its
own brightness as it passes, so the subject develops out of the paper bottom
first. This is the field's entrance: a subject made of dots has no fade or slide
of its own, and fading the whole canvas would just dim the page.

The wave is the shader's job, not the component's — *which dots are up yet* is a
question about **where they sit**, so it is answered per cell. `revealBand` sets
the front's thickness in screen heights: small reads as a hard scan line, past
~`0.5` it is taller than the screen and the field just fades up together.

Defaults to `true`, and the component stays unaware of *what* it waits for. The
spring drives the front's **position** (not dot size) and is read with `.get()`
inside the existing loop, so it costs **no re-renders**. Joining it to the
preloader is the view's job (`HeroField` → `useIntroRevealed()`).

> [!warning] Nothing may appear where the picture is empty
> A `revealCrest` once swelled dots *past* their settled size as the front
> passed, so a ridge of ink rode up and the image relaxed in behind it. On paper
> it is the better effect. On screen it puts a band of dots across the **full
> width, background included** — and a soft bar sweeping up the page reads as a
> blur artefact, not as a subject arriving. It was removed, twice reported as
> "a blur that goes up". The front only ever *gates* each cell's own brightness:
> `lum *= local`.

> [!important] The front starts **at** the bottom edge, not below it
> `front = u_reveal * (1.0 + u_revealBand)`. Starting it at `-band` (so cells at
> `y = 0` also get a full ramp) spends the first fifth of the travel crossing a
> gap nobody can see — the page appears to hang, then the picture arrives
> already moving. Reported as "a white screen for two seconds".

> [!note] Verified by driving the uniform directly
> The direction is easy to invert (`v_uv.y` is **1 at the top**). Upload a 1×1
> white texture, set the uniforms by hand on the live context, then step
> `u_reveal` and read rows back with `readPixels`: a white source makes every
> cell fully lit, so the ink profile *is* the wave's shape. At `0.2` the ink
> reached ~10% up, at `0.6` ~60%, at `1` the full height, with a soft gradient at
> the front and nothing above it. Worth repeating if the wave maths is touched.

**`mirror`** — flips the sampled image horizontally, which reverses the
direction the subject faces and, for a moving subject, the apparent direction of
the move. The dot grid itself doesn't move; only where each cell reads from.

**`tilt`** — leans the picture away from the pointer as a perspective plane (a
projective divide, so the far side compresses and the near side spreads —
depth, not skew). Only the *sample* position leans; the dot grid stays
screen-aligned, so the field keeps its even texture rather than foreshortening
into uneven dots. Past ~`0.4` it stops reading as depth and starts to smear.

> [!important] The ink ramp is keyed to position, not brightness
> Brightness already sets a dot's **size**, so keying the colour ramp to it too
> hands the light stop to exactly the cells too small to show it: every dot you
> can actually see lands on the dark end and the field reads as one flat
> colour. The ramp therefore runs on a **diagonal across the frame**, so a
> visible dot's shade depends on where it sits.
>
> `inkSpread` packs that ramp around the middle of the frame. At `1` it spans
> the whole viewport, which leaves a centred subject covering only the ramp's
> middle — the outer stops never appear. Raise it until the subject spans the
> range; the default `2.5` is tuned for a centred bust.

**`pointerScrub`** — maps the pointer's horizontal position onto the clip's
timeline instead of playing it: left edge of the window = first frame, right edge
= last. Playback stays parked and a spring-smoothed pointer picks the frame.

> [!important] The footage *is* the interaction
> Scrubbing only reads as "the subject follows my cursor" if the clip is **one
> continuous sweep** of a single move. A clip that loops, cuts, or reverses will
> jump around under the pointer. The pose at each edge is whatever the clip's
> first and last frames are — the mapping cannot invent poses the footage
> doesn't contain. To land a specific pose at the *centre* of the screen, it has
> to be the frame at the centre of the clip.

> [!warning] Never scrub by seeking a `<video>`
> The obvious build — drive `currentTime` from the render loop — judders badly.
> A seek costs ~25–65 ms while the loop asks for one every ~16 ms, so the
> decoder never settles and the picture lands late and unevenly. `pointerScrub`
> therefore decodes the clip into stills up front (`capture-frames.ts`) and
> scrubbing becomes an array lookup, which tracks at the full frame rate.
>
> The cost is a one-off decode — ~2.5 s and ~35 MB for a 4.4 s clip at the
> default `scrubFrames`. Stills publish as they land, so the head of the clip is
> scrubbable while the tail decodes; the field visibly settles during that first
> pass. Re-encoding the clip with dense keyframes would make seeking viable
> instead, if a build step ever grows one.

Stills are captured at a fraction of the source resolution (the halftone samples
one pixel per cell — a 1920px canvas is only ~107 cells across at the default
`cellSize`). That also **pre-averages** the source, so the field reads smoother
and more even than sampling the full-resolution video did; the extra grit there
was point-sampling alias, not detail.

**Why the dot is analytic** — it is a feathered distance field computed in the
fragment shader, not a lookup into pre-rendered marks. That makes the radius a
*continuous* function of brightness, so a dot grows and shrinks smoothly as the
clip plays. A stepped ramp is what makes this kind of effect read as harsh: each
cell visibly pops between fixed sizes. See [[decisions-log]] ADR-0014.

**`softness`** is **extra blur on top of antialiasing**, not the antialiasing
itself. The shader always feathers by half a device pixel — derived from
`cellSize`, so it holds at any DPR — which is what keeps the dot's edge from
stair-stepping. At the default `0` the dots are as crisp as the pixel grid
allows.

> [!warning] `softness` and `dotScale` are coupled
> A dot's radius is capped so its **feather still lands inside the cell** — past
> that the cell bounds clip the dot and it renders as a *square*, which is the
> one thing a round dot field must not do. `dotScale` is therefore clamped to
> 0–1 of that safe maximum, and raising `softness` *lowers* the cap: a blurrier
> field is a lighter one. After changing either, recheck `gain`.
>
> This is why `dotScale` defaults to `0.72` rather than `1`: with blur off the
> cap jumps to nearly half a cell, and `1` would land a much denser field than
> the tuning was set for.

> [!tip] Retune exposure per clip
> `gain` (exposure) and `gamma` (< 1 lifts midtones) set how much of the frame
> grows real dots. The defaults (`1.9` / `0.62`) are tuned for the dark
> `metal-human.mp4`, not universal.

**Polarity** — brightness grows dots, so a **bright subject on a dark ground**
reads as ink on paper. Footage with the opposite polarity would ink the
background and leave the subject blank; invert it upstream, not here.

**Motion & tokens** — the render loop is the shared ticker (`useLoop`), so the
shader costs no extra rAF ([[animation-system]]). The pointer feeds one
`useSpring` (clip position + both tilt axes) read imperatively inside that loop,
so motion stays spring-based per [[animation-system]] even though the values end
up in uniforms. Colours are the `--halftone-bg` / `--halftone-ink-light` /
`--halftone-ink-mid` / `--halftone-ink-deep` tokens, read via `readCssColor`
([[utils]]) — nothing is hardcoded in GLSL. See [[decisions-log]] ADR-0014 for
why this is raw WebGL2 and not `three.js`.

**Degradation** — without WebGL2 the canvas is dropped and the plain
`object-cover` `<video>` shows through. `usePrefersReducedMotion` ([[hooks]])
pauses the clip, freezing the field on one frame. The whole block is
`aria-hidden` — it is decorative.

> [!warning] Don't build a hairline ring from two nested circles
> A disc inside a slightly larger disc looks like a ring, but each box snaps its
> painted edges to the device-pixel grid **independently**. When the gap is
> thinner than a device pixel the rounding disagrees between sides and the ring
> comes out lopsided — the hero's 9px/7px request-button dot read as
> off-centre at most window widths, and only looked right where the rounding
> happened to agree. Draw a hairline ring as a **border on one box** instead.
> Nested circles are fine when the gap is comfortably more than a pixel — the
> logo (50/28) and the header arrow (50/30) are.

> [!note] The colours are read **once**, not per frame
> A `getComputedStyle` on every draw would force a style flush 60 times a second
> to catch four values that never move. Nothing rewrites the `--halftone-*`
> tokens at runtime, so there is nothing to watch for — retuning the field is an
> edit to `globals.css`.
>
> A dev-only `<HalftoneControls>` panel used to edit them live, with an
> `ink-tokens.ts` revision counter so the field knew to re-read. Both are gone:
> the palette is settled. If live tuning is ever wanted again, it needs that
> signal back — and the bundling shape in [[component-conventions]], or it ships
> to visitors.

## Preloader — `preloader/`

`<Preloader>` — the full-screen intro. Figma `682:837` (counting) → `682:886`
(lifting). Lives in `src/components/common/preloader/`.

| File | Role |
|------|------|
| `preloader.tsx` | The two curtains and the sequence |
| `preloader-dial.tsx` | The spinning disc, the filling ring, the percentage |
| `intro-state.ts` | Publishes *when the page is uncovered* — see below |
| `index.ts` | Barrel export — `Preloader`, `PreloaderProps`, `useIntroRevealed` |

**Two curtains.** A black one carrying the dial, and the brand-green one behind
it. The count fills the ring; when it lands the black lifts, and the green
follows `VEIL_DELAY` later — so the page is uncovered in two passes, not one.
DOM order is the stack: veil first, ground second, so the black paints over the
green until it leaves.

**Mounting** — the root layout, inside `ScrollLayout`:
```tsx
import { Preloader } from "@/components/common/preloader";
```
It **unmounts itself** once the green is clear. It covers the viewport, so
lingering would swallow every pointer event on the page it just revealed.

**The dial** is the frame's geometry in `rem` — a 299px disc inside a 591px
ring — so the grid scales it with everything else. The ring is one `<circle>`
with `pathLength={1}`, which normalises the dash maths to the progress value
itself; an SVG circle starts at 3 o'clock, so it is rotated 90° to start the
sweep at 6, where the disc's own gradient seam sits. Both run clockwise.

> [!note] The disc's spin is derived from `progress`, not looped
> A `loop: true` spring would keep turning after the count has landed — and
> because `<ReducedMotion>` flips react-spring's **global** `skipAnimation`,
> each iteration would finish the instant it began and restart, with nothing
> pacing it. Deriving the angle from `progress` means one spring drives the
> count, the ring and the spin together, and reduced motion simply skips the
> whole intro.

> [!warning] The lift springs must `clamp`
> A curtain that overshoots `-100%` swings back down and flashes its bottom
> edge across the page it just uncovered.

### `useIntroRevealed()` — starting the page behind the curtain

The hero has to know when it may start. `<Preloader>` announces the moment its
curtains **begin to lift** through `intro-state.ts` — a module-level
`useSyncExternalStore` — and any section subscribes:

```tsx
import { useIntroRevealed } from "@/components/common/preloader";

const isRevealed = useIntroRevealed();
// …then hand it to the animation, never to a conditional mount:
<TextEngine tag="h1" mode="once" enabled={isRevealed} …>
<Inview tag="li" mode="once" enabled={isRevealed} delayIn={…} …>
```

**`enabled` is the gate, not mounting.** Both `<TextEngine>` and `<Inview>` hold
every spring at its resting state while `enabled` is false, and play on the edge
to true. Unmounting instead would strip the `<h1>` out of the SSR markup for the
length of the intro. Why a store rather than a delay, context, or a viewport
trigger: [[decisions-log]] ADR-0016.

> [!note] Reduced motion is already handled — do not add a branch
> The count lands on frame one under `<ReducedMotion>`, so the flag flips
> immediately; and react-spring **drops `delay` entirely** while `skipAnimation`
> is set (`if (delay > 0 && !skipAnimation)`), so every staggered delay
> downstream collapses to zero on its own. Special-casing it would only be a way
> to get it wrong.

> [!important] Fire on the **lift**, not on the landing — and it has been tried
> both ways
> Waiting for the curtains to be gone leaves the page blank while they clear.
> The black lifts to reveal the green, the green lifts to reveal the page, and
> for that whole ~650ms the page is visible and doing nothing — then the halftone
> wave still has to accelerate from rest. Reported, accurately, as "a white
> screen for two seconds".
>
> It was moved to the landing to chase a reported "blur during the loader". That
> blur was the halftone's **crest**, not the timing — see `<HalftoneVideo>`'s
> `reveal` above. Moving the clock fixed nothing and cost a second of blank page.
> The lesson is not about curtains: **when a complaint names an artefact, remove
> the artefact.** Re-timing around it only moves it.
>
> So `0` in `views/home/reveal.ts` is ~650ms *before* the first visible frame, by
> design. The budget after it should stay small enough that these animations
> still *end* on a page someone is looking at.

The flag never resets — an intro plays once per load. Anything that must replay
needs its own signal.

## ReducedMotion — `reduced-motion.tsx`

`<ReducedMotion>` — a client leaf that calls react-spring's `useReducedMotion()`.
It watches the `prefers-reduced-motion` media query and toggles react-spring's
global `skipAnimation`, so every spring — and `spring-text-engine` — jumps to its
end state instead of animating. Renders `null`; mounted once in the root layout.
See [[animation-system]] and [[seo-metadata]].

## Skeleton loaders

Three skeleton components for `loading` states of async-data components — every
async component must mirror its final layout with one of these
(see [[component-conventions]]).

| Component | File | For |
|-----------|------|-----|
| `<SkeletonImage>` | `skeleton-image.tsx` | image placeholders |
| `<SkeletonLoader>` | `skeleton-loader.tsx` | generic block placeholders |
| `<SkeletonVideo>` | `skeleton-video.tsx` | video placeholders |

> [!note]
> `components/ui/` (design-system primitives) does not exist yet — create it when
> the first primitive is added. See [[folder-structure]].

## Related

[[component-conventions]] · [[components/animation-springs]]

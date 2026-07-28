---
tags: [meta, decision]
updated: 2026-07-15
---

# Decisions Log (ADRs)

Architecture Decision Records. Each entry captures a choice, its context, and its
consequences. Use [[templates/adr-note]] for new entries. Newest first.

---

## ADR-0017 — Below the frame, reflow — do not scale

- **Status:** Accepted — extends [[decisions-log|ADR-0015]]
- **Date:** 2026-07-15

**Context.** The grid scaled the 1440×800 frame at *every* width, unbounded. On a
390px phone that resolved to a **4.17px root font-size and 4px body copy** — the
desktop design rendered as a perfect, illegible miniature. Checked the Figma
file first: across 7,183 nodes there is no artboard of phone width, so there is
nothing to port. Mobile has to be designed, not transcribed.

Adding a mobile `GRID_BREAKPOINTS` entry was the tempting move and is wrong for
exactly ADR-0015's reason: a breakpoint claims *a frame exists at this base
width* and rescales the artwork to it. Inventing `baseWidth: 375` would assert a
frame nobody drew.

**Decision.** Scaling has a floor. `GRID_MIN_WIDTH` (1024) is where the grid
range starts; the `html` font-size rule is scoped to it.

- **Below it the layout reflows** — sections stack in source order and the page
  scrolls, via `lg:` prefixes on the same DOM. No second component tree.
- **Below it the root font-size is left alone**, so the browser's default (and
  therefore the *user's* setting) applies. The frame's `rem` values are then real
  pixels, which is why the type scale needs a mobile end.
- **The type scale carries two values per role**, not a `-mobile` twin:
  `:root` holds `--size-*`, the 1024 media query re-points them at the frame's
  values, and `@theme inline` binds `--text-display: var(--size-display)`. Every
  `text-display` in the app then resolves correctly with no `lg:` to forget.
- Geometry that must serve both layouts is expressed in **`em`** rather than
  duplicated — the headline's accent bar is `-bottom-[0.2em] h-[0.45em]`, which
  reproduces the frame's 140/36px exactly at 80px type *and* lands on the last
  line at 40px.

**Consequences.** The phone gets a real layout and a user-controlled font size.
The 1024 cut-off means tablets get the reflow, and the frame is at its smallest
(≈11.4px root) right at the boundary — the price of having one desktop frame.
`GRID_BREAKPOINTS` still has exactly one entry, and `GRID_MIN_WIDTH` is
deliberately not one of them.

This is **new design, not a port** — the burger panel, the stacked form, and
every mobile size are invented and want a designer's eye. See [[changelog]].

---

## ADR-0016 — The intro is announced through a store, not a timer

- **Status:** Accepted
- **Date:** 2026-07-15

**Context.** The hero has to start animating when the preloader lifts. The two
never meet in the tree — `<Preloader>` is mounted in the root layout,
the sections are pages deep — and the obvious fixes each fail:

- **A matching delay** (`delayIn={2200 + lift}`) duplicates the preloader's
  timing in a second file, where it silently rots the first time the count
  changes.
- **Conditional mounting** removes the `<h1>` from the SSR markup, so crawlers
  and screen readers get a page with no heading for as long as the intro runs.
- **`<TextEngine mode="once">` on its own** triggers on the viewport, and the
  hero is in view at load — it would play behind the curtain and be finished
  before anyone sees it.
- **Context** would mean a provider wrapping the whole tree to join two ends
  that never render together.

**Decision.** `<Preloader>` publishes one boolean through a module-level store
(`preloader/intro-state.ts`, `useSyncExternalStore`); sections read it with
`useIntroRevealed()` and pass it to their animation's **`enabled`** prop. Both
`<TextEngine>` and `<Inview>` hold every spring at its resting state while
`enabled` is false and play on the edge to true — `enabled` is the engine
author's own hook for this ("*Animation plays only if true (useful to play
animation after page loaded state change)*"). The elements stay mounted
throughout, so the SSR markup is complete. Spacing between them lives in one
place: `src/views/home/reveal.ts`.

**Consequences.** The preloader owns its timing and nothing else needs to know
it. Reduced motion needs no branch anywhere: `<ReducedMotion>` makes the count
land on frame one, so the flag flips immediately, and react-spring drops `delay`
entirely while `skipAnimation` is set — the whole choreography collapses to
"already there" on its own. The cost is a module-global that never resets, which
is correct here (an intro plays once per load) and wrong for anything that
should replay.

---

## ADR-0015 — One design, one continuous grid scale

- **Status:** Accepted — amends [[decisions-log|ADR-0008]]; the "unbounded"
  half is since **bounded below** by [[decisions-log|ADR-0017]] (the rule is
  unbounded *above* only — below 1024 the layout reflows instead of scaling)
- **Date:** 2026-07-15

**Context.** The adaptive grid shipped with four breakpoints (1920 / 1440 / 1024
/ 360) and an `<AdaptiveGrid>` component to scale *up* past the largest one.
That shape assumes **a design exists at every base width** — each range divides
`FONT_BASE` by the width its artwork was drawn at.

Only one frame exists: Figma *Get Layers* `681:256`, at 1440. Under the old
config that layout was correct at exactly 1440 and wrong everywhere else. A
range based at 1920 renders 1440 artwork at 75%, so widening the window past
1440 made the design **jump smaller** (root font-size fell 16px → 12px at
1441px); narrowing past 1024 rebased it at 1024 and the layout overflowed the
viewport. `<AdaptiveGrid>` then damped the scale-up by `coef` (0.6666), so above
the largest breakpoint the design deliberately stopped tracking the design's
proportions.

A width-only scale then has a second problem: it makes the composition
`width / 1.8` tall (the frame's own ratio). Most windows are wider than 1.8:1 —
1920×900 is 2.13 — so the frame renders *taller than the viewport* and the page
scrolls, which a full-bleed hero must not do.

**Decision.** Configure the grid for the artwork that exists, and cap the scale
on **both** axes.
- `GRID_BREAKPOINTS` holds **one** entry — `{ maxWidth: 1440, baseWidth: 1440 }`.
  A breakpoint is a claim that a frame exists at that base; add one back when it
  does.
- `globals.css` scales the root font-size with a **single unbounded rule**:
  `html { font-size: min(1.111111vw, 2vh) }` — `FONT_BASE * 100 / baseWidth` and
  `/ GRID_BASE_HEIGHT`. Continuous at every size: no media-query boundary to
  jump across, and correct before JS runs.
- **Whichever axis is tighter wins**, so the frame always fits whole and the
  page never scrolls. Slack on the looser axis opens up *between* the
  edge-anchored pieces instead of pushing anything off screen — which is what
  keeps them on the edges.
- `<AdaptiveGrid>` is **unmounted** from the root layout. It exists to take over
  above the largest breakpoint, and an unbounded rule never hands over —
  mounting it would only damp the scale away from the design's proportions.
  The component and hook stay in the tree for when a second frame arrives.
- The hero section is `h-lvh` — exactly the viewport. The bottom row pins to its
  bottom edge, which is therefore the screen's. No height floor is needed: the
  `vh` cap guarantees 50rem never exceeds the viewport, so the pieces cannot
  fold into each other.

**Consequences.** The frame keeps its proportions and always fits — verified
in-browser at 1440×800, 1440×1000, 1920×900, 1600×600: no scroll, no overlap,
bottom row on the bottom edge in every case.

The trade-off is deliberate: on a window **wider** than 1.8:1 the height cap
wins, so the design stops filling the width and widening the window no longer
grows the type. The headline is 55.35% of the viewport while width-capped and
less than that once height-capped. Elements keep their own proportions
throughout; the spare width becomes gap between them. Filling both axes at once
is only possible by distorting the frame or cropping it.

The design grows without limit on displays large in *both* axes, which is what
"proportional" means; if a cap is ever wanted, that is a new decision and
`coef` is where it lives. **This amends ADR-0008**, which assumed multiple
frames and a damped scale-up.

---

## ADR-0014 — Shader effects run on raw WebGL2, not a 3D library

- **Status:** Accepted
- **Date:** 2026-07-15

**Context.** The home page needed a full-bleed background video rendered as a
halftone field of geometric shapes ([[components/common|`<HalftoneVideo>`]]).
Effects like this are usually reached for with `three.js` (or
`@react-three/fiber`), which would be the project's first 3D dependency —
~600 kB before the React bindings, on a starter whose whole premise is
fast-loading marketing pages.

**Decision.** Implement shader effects directly against **WebGL2**, with no new
dependency.
- The workload is a **single fullscreen quad**. A scene graph, camera, material
  system, and loaders are all cost and no benefit when there is no scene.
- Per-frame work subscribes to the shared ticker (`subscribeToTicker`) — the
  documented extension point from ADR-0009 — so the shader shares the app's one
  rAF loop rather than starting a second one.
- The dot is drawn analytically in the fragment shader (a feathered distance
  field), not sampled from an atlas of pre-rendered marks. Its radius is then a
  continuous function of cell brightness rather than a lookup into fixed steps,
  which is what keeps the field from visibly popping between sizes as the clip
  plays — and it ships no atlas asset.
- Every colour is read from a CSS token via `readCssColor` (`utils/color.ts`)
  rather than hardcoded in GLSL, keeping ADR-0004's token rule intact across
  the JS/GLSL boundary.

**Consequences.** Zero new dependencies; [[tech-stack]] is unchanged. The cost is
that GL resource management is hand-rolled — see `halftone-renderer.ts`, which owns
its program/textures and must not call `WEBGL_lose_context` on dispose (a canvas
returns the *same* context object from every `getContext`, so losing it would
break the next renderer on that element — including React StrictMode's second
mount). If a future feature needs an actual 3D scene, revisit with a new ADR;
this decision covers fullscreen post-effects only.

---

## ADR-0013 — `<Inview>` self-observe fix; spring components honour resize

- **Status:** Accepted
- **Date:** 2026-06-07

**Context.** `<Inview>` only animated when an external `trigger` ref was passed.
Without one it never revealed. Root cause: `useDynamicInView` returns its target
attachment as a **callback ref** (`setNode`) in the first tuple slot, but
`in-view.tsx` destructured it as `inViewRef` and wrote `inViewRef.current = node`
in the JSX `ref` callback — assigning `.current` to a function instead of calling
it. `setNode` never ran, the observed `node` stayed `null`, and with no `trigger`
the observer had nothing to watch (`trigger?.current ?? node` → `null`). With a
`trigger` it worked only because `trigger.current` bypassed the dead `node` path.
TypeScript flagged this at build time (`Property 'current' does not exist on type
'TargetRefCallback'`), so the build was already failing.

Separately, `<Inview>`, `<Spring>`, and `<Hover>` tracked `width`
(`useWindowWidth()`) as a `useMemo`/`useEffect` dependency to re-evaluate mobile
gating on resize, but never passed it to `isMobileDisabled()` — so the value was
genuinely unused (ESLint `react-hooks/exhaustive-deps` warning) **and** resize
re-evaluation silently did nothing; the check always read `window.innerWidth` at
call time.

**Decision.** This is the second authorized edit to the `#do-not-modify` engine
(after ADR-0009). Two corrections:
1. In `in-view.tsx`, call the callback ref — `setInViewNode(node)` — instead of
   assigning `.current`, so the component observes itself when no `trigger` is
   given.
2. Pass the React-tracked `width` into every `isMobileDisabled(value, width)`
   call across `in-view.tsx`, `spring.tsx`, and `hover.tsx`. This is the
   documented second parameter of `isMobileDisabled` and makes the `width`
   dependency meaningful, fixing resize re-evaluation and clearing the lint
   warnings.

**Consequences.** `<Inview>` now works standalone (the common case). `yarn build`
and `yarn lint` are both clean (0 errors, 0 warnings). The springs folder remains
`#do-not-modify` by default — these were explicitly signed-off bug fixes.

---

## ADR-0012 — Styling lives in utilities and components, not `globals.css`

- **Status:** Accepted
- **Date:** 2026-05-22

**Context.** ADR-0004 made design tokens the styling currency and ruled that
"new values must be added to `globals.css` first." Combined with the
design-system guidance to *"extract repeated multi-class patterns to
`@layer components`"*, the path of least resistance for any repeated visual
pattern became a named class in `globals.css`. On an animation-heavy,
multi-section marketing site that grows the file without bound — a single
global stylesheet accumulating hundreds of component-specific classes that are
never deleted when their component is. The fix is a placement rule, not a
file-splitting trick: splitting `globals.css` into many files only spreads the
same bloat.

**Decision.** Styling follows a strict placement order; `globals.css` stays
bounded by design.

- One-off styling → **Tailwind utilities** in `className`. Nothing enters CSS.
- A repeated pattern with markup/structure/props → a **React component**
  (`components/ui/`), *not* a CSS class. This is the default answer to "this
  looks repeated" — e.g. an eyebrow label with a `::before` dot is an
  `<Eyebrow>` component, not a `.label-eyebrow` class.
- A repeated pure-utility combo with no structure → a Tailwind v4 `@utility`.
- `@layer components` is reserved **strictly** for what utilities and
  components genuinely cannot express: pseudo-elements (`::before`/`::after`),
  third-party DOM overrides (`!important` on library markup), complex
  descendant/state selectors.
- `globals.css` only ever holds: `@import`, tokens (`:root` + `@theme`), base
  element resets (`@layer base`), and the narrow `@layer components`
  exceptions above. If it grows past that, something was misplaced.
- CSS Modules were considered and **rejected** — a second styling mechanism
  for the rare bespoke-CSS case is not worth the extra mental model when
  motion is spring-based (no keyframes — ADR-0002) and utilities + components
  cover everything else.

**Consequences.** `globals.css` stays a few-hundred-line file indefinitely.
"Repeated thing" pressure now pushes toward React components — which the
project wants anyway. This **amends ADR-0004**: design *tokens* still go in
`globals.css` first, but component-specific *classes* no longer do.
[[design-system]] and [[component-conventions]] updated to match.

---

## ADR-0011 — API layer: `app/api` route handlers, secrets server-side

- **Status:** Accepted
- **Date:** 2026-05-22

**Context.** The starter had no API layer. It needs a convention for reaching
external services that keeps secret keys off the client and gives endpoints a
consistent shape.

**Decision.** External calls go through Next.js Route Handlers —
`src/app/api/<resource>/route.ts`:
- **The handler owns the work** — business logic, multiple upstream calls,
  filtering, and reading secret env vars all live in `route.ts`. No mandatory
  passthrough service layer; extract shared code only when genuinely reused.
- Secrets are safe in handlers because `route.ts` is never bundled to the
  browser. Secret env vars are **unprefixed**; `NEXT_PUBLIC_` only for
  browser-safe values.
- Every endpoint: validates input with `zod`, returns the `{ data }` /
  `{ error }` envelope via the shared `handle()` wrapper (`src/lib/api/`), runs
  on the Node runtime (not Edge).
- `src/env.ts` validates env with zod — `publicEnv` vs `getServerEnv()`.
- Client Components fetch via `apiFetch` (`src/lib/api-client.ts`), same-origin
  only. Render-time data is read in Server Components.
- Added `zod`. The example endpoint is `app/api/contact/route.ts`.
- Codified as **AGENTS.md hard rule #9**.

**Consequences.** A clear, secret-safe API convention (full note:
[[api-architecture]]). Server Actions were considered for mutations but
deferred — for now everything goes through `app/api`. The choice can be
revisited if forms need progressive enhancement. First server dependency
(`zod`) and first server-only env var (`CONTACT_ENDPOINT`) now exist.

---

## ADR-0010 — SEO & performance hardening

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** A review found gaps that would hurt a production marketing site:
`metadataBase` defaulted to `null` (relative OG/canonical URLs never resolved to
absolute — broken social previews); `themeColor` sat on the deprecated metadata
field; there was no `robots.txt`, `sitemap.xml`, or structured data; the
`next.config.ts` was empty; `ScrollLayout` leaked a `requestAnimationFrame`
loop; the home view was a top-level `"use client"` (violating hard rule #6);
and the animation-heavy starter ignored `prefers-reduced-motion`.

**Decision.**
- **Site config.** `src/lib/site.ts` (`siteConfig`) is the single source of
  truth for SEO, fed by `NEXT_PUBLIC_SITE_URL` (fallback `http://localhost:3000`).
- **Metadata.** `metadataBase` is always set; `themeColor` moved to a
  `generateViewport()` / `viewport` export; dead `keywords` / `other` tags
  dropped; OG dimensions corrected to match the asset.
- **Crawlability.** Added `app/robots.ts`, `app/sitemap.ts`, and a JSON-LD
  `Organization`+`WebSite` helper rendered once in the root layout.
- **App Router files.** Added `loading.tsx` (enables streaming), `error.tsx`,
  `not-found.tsx`.
- **Rendering.** `HomeView` is a Server Component; client-only animation moved
  to the `HomeShowcase` leaf — models hard rule #6 instead of breaking it.
- **Reduced motion.** `<ReducedMotion>` calls react-spring's `useReducedMotion`,
  toggling the global `skipAnimation` — one app-root mount covers every spring
  and `spring-text-engine`. Chosen over per-component handling for its reach.
- **Build config.** `next.config.ts` now sets `removeConsole` (prod),
  AVIF/WebP, `next/image` breakpoints aligned to the adaptive-grid widths, and
  `poweredByHeader: false`. React Compiler is left as a documented opt-in (needs
  `babel-plugin-react-compiler`).
- Fixed the `ScrollLayout` Lenis rAF leak (cancel on unmount).

**Consequences.** Social/SEO metadata is correct in production once
`NEXT_PUBLIC_SITE_URL` is set. The first project env var now exists (see
[[environment-variables]]). `isBot()` stays available but is discouraged — it
opts routes out of static rendering; reduced-motion is the preferred lever (see
[[seo-metadata]]). React Compiler remains opt-in pending a dependency install.

---

## ADR-0009 — Shared animation ticker; authorized engine performance refactor

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** A performance review of the animation engine found load issues that
scale with the number of animated components on a page:
- `useLoop` started a **private `requestAnimationFrame` loop per hook instance** —
  N scroll-driven components meant N rAF loops, none of which ever stopped.
- `useWindowWidth` attached a **separate debounced `resize` listener per call** —
  one per spring component.
- `useDynamicInView` re-created its `IntersectionObserver` **on every render**
  (effect keyed on an unstable `options` object), and a dead `Proxy` branch
  created observers that were never disconnected.
- `useLoop`'s mount-only effect captured a **stale `onRender`**, so prop changes
  after mount were ignored.
All of this lives under `src/hooks/animation/` and `src/components/animation/springs/`
— `#do-not-modify` (ADR-0002).

**Decision.** With explicit user sign-off, apply a one-time performance refactor
to the protected engine, and introduce a shared, unprotected loop primitive:
- New `src/lib/animation/ticker.ts` — a single app-wide, reference-counted rAF
  loop (`subscribeToTicker`). It starts on the first subscriber, stops on the
  last, and throttles each subscriber independently. **Not** `#do-not-modify` —
  it is the supported extension point.
- `useLoop` now subscribes to the ticker and reads `onRender` / `framerate`
  through refs (fixes the stale-closure bug). Public signature unchanged.
- `useDynamicInView` rewritten without the `Proxy`: one observer, re-created only
  when the observed element or options actually change; exposes a callback ref.
- `use-window-size.ts` (not protected) now serves all three hooks from one
  debounced `resize` listener via `useSyncExternalStore`. The unused
  `debounceDelay` parameter was dropped.
- `mode="forward"` `scroll` listeners in `<Spring>` / `<Inview>` made `passive`.
- Hard rule #2 amended: the engine stays protected by default; changes require
  explicit sign-off.

**Consequences.** A page with N animated components now runs **one** rAF loop and
**one** resize listener instead of N of each, with no observer churn. Public
hook/component APIs are unchanged except `useWindowWidth`/`Height`/`Size`, which
no longer take a `debounceDelay` argument (no caller passed one). This **amends
ADR-0002's** do-not-modify scope.

A follow-up pass then cleared all 13 pre-existing ESLint problems in the engine
(also authorized): `isMobileDisabled` gained an optional `viewportWidth`
argument, missing `disableOnMobile` effect deps were added, a
`trigger.current`-in-cleanup hazard in `<Hover>` was fixed, `<Handle>`'s
transition effects were ref-stabilised, and `useProgressTrigger` now returns
`progress` as a `RefObject<number>` (no consumer affected).

---

## ADR-0008 — Adaptive scaling grid via root font-size

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** An adaptive scaling system was dropped into `src/components/common/`
to keep a rem-based design proportional across viewports. It shipped as a
`styled-components` implementation (`createGlobalStyle`, a `css` `media` helper,
`rm`/`em` helpers, plus `colors.ts` / `fonts.ts` / `utils.ts`). `styled-components`
is not a project dependency, and global CSS belongs in `globals.css` per ADR-0004.

**Decision.** Keep only the scaling behaviour; rebuild it to the project stack.
- **Scale down** (viewport ≤ largest breakpoint) — `vw`-based `html { font-size }`
  media queries in `globals.css`, inside `@layer base`.
- **Scale up** (viewport > largest breakpoint) — a `<AdaptiveGrid>` client
  component (`useAdaptiveGrid` hook) sets an inline `html` font-size at runtime,
  reusing the existing `useResizeLoop` render loop.
- Breakpoints live in `grid.config.ts` as typed config; the `globals.css` media
  queries mirror them and must be kept in sync (formula in both files).
- The dropped `styled-components` files were deleted, not committed.

**Consequences.** A rem-based layout now scales as one unit on every viewport.
`styled-components` stays out of the dependency tree. The breakpoint set is
duplicated across `grid.config.ts` and `globals.css` by design — the CSS-only
config rule (ADR-0004) forbids generating the media queries from JS.

---

## ADR-0007 — Automate the vault workflow with Claude Code hooks

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** The "read the vault first, follow the relevant guide, update the docs
after every change" workflow depended on the user reminding the agent each time.
Documentation drifts the moment it relies on memory.

**Decision.** Encode the workflow as Claude Code hooks in `.claude/settings.json`
(committed, team-wide):
- `SessionStart` — injects a pointer to read the vault first.
- `UserPromptSubmit` — on every request, reminds the agent to consult the relevant
  guide and to update docs for any change made.
- `Stop` — at the end of every turn, blocks **once** to confirm the vault was
  updated. A `${TMPDIR}` marker keyed by session id guarantees it blocks at most
  once per turn (no infinite loop).

**Consequences.** The documentation workflow is enforced without user prompting.
`.claude/settings.json` is now a tracked project file. Hooks are reviewable and
disableable via `/hooks`. New hooks take effect on the next session start (or after
opening `/hooks`). See [[ai-agent-guide]].

---

## ADR-0006 — The vault is the single source of truth

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** ADR-0001 left dense spec files (`project-specs.md`, `text-engine-docs.md`)
at the repo root alongside the vault, creating duplication — the same conventions
existed both as terse specs and as expanded vault notes, which would drift.

**Decision.** The vault is the **only** documentation source.
- `project-specs.md` — deleted; its content was already decomposed into the
  `architecture/` and `frontend/` notes (and `environment-variables.md`).
- `text-engine-docs.md` — moved into the vault as [[text-engine-reference]].
- `generic-layout-prompt.md` — moved into the vault (see ADR via [[changelog]]).
- Root keeps only thin shims: `AGENTS.md` carries the breaking-change warning and
  hard rules and points into the vault; `CLAUDE.md` and `.cursorrules` both
  `@`-import `AGENTS.md`.

**Consequences.** No documentation duplication. Agents bootstrap from `AGENTS.md`
and read vault notes on demand. This **amends ADR-0001** — root files no longer
hold canonical spec content.

---

## ADR-0005 — Use standard `next/link` for navigation

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** Two conflicting conventions existed: `project-specs.md` specified
standard `next/link` / `useRouter`, while `generic-layout-prompt.md` specified
custom `<AnimLink>` / `useAnimRouter()` wrappers. The custom wrappers were never
built.

**Decision.** Use standard Next.js navigation — `<Link>` from `next/link` and
`useRouter` from `next/navigation`. The `AnimLink` / `useAnimRouter` convention is
dropped. See [[routing]].

**Consequences.** `generic-layout-prompt.md` §5 updated to match. No animated-route-
transition layer exists; if one is needed later, revisit with a new ADR.

---

## ADR-0001 — Adopt an Obsidian vault as the project brain

- **Status:** Accepted — amended by ADR-0006
- **Date:** 2026-05-21

**Context.** Project knowledge was scattered across root markdown files
(`project-specs.md`, `text-engine-docs.md`, `AGENTS.md`). New contributors and AI
agents had no structured map of the system.

**Decision.** Introduce `obsidian/` as an Obsidian vault — a linked, navigable
second brain. Root spec files remain as machine-read sources; the vault expands on
them. See [[ai-agent-guide]].

**Consequences.** Docs must now be maintained alongside code. The vault is the
canonical place to *understand* the project; root files stay canonical for *tooling*.

---

## ADR-0002 — All motion is spring-based (`@react-spring/web`)

- **Status:** Accepted (inherited from starter)
- **Date:** Project baseline

**Context.** Marketing sites need rich, interruptible, physically natural motion.
CSS transitions and keyframes are rigid; competing libraries add weight.

**Decision.** Use `@react-spring/web` for every animation. A custom component layer
(`src/components/animation/springs/`) wraps it. CSS transitions, CSS keyframes, and
`framer-motion` are **banned**.

**Consequences.** All animation goes through the [[animation-system]]. The springs
folder is `#do-not-modify`. Text animation is delegated to [[text-engine]].

---

## ADR-0003 — Routes delegate to Views

- **Status:** Accepted (inherited from starter)
- **Date:** Project baseline

**Context.** Mixing routing concerns with page UI makes `app/` files heavy and hard
to test.

**Decision.** `app/**/page.tsx` files only import and render a component from
`src/views/`. All layout/UI logic lives in the view. See [[routing]].

**Consequences.** Every route is a 3-line file. Views are the real page components.

---

## ADR-0004 — Tailwind v4 with CSS-based config

- **Status:** Accepted (inherited from starter)
- **Date:** Project baseline

**Context.** Tailwind v4 removes `tailwind.config.js` in favour of CSS-native config.

**Decision.** All theme tokens live in `globals.css` under `:root` and `@theme inline`.
No JS config file. Raw values in class names are banned. See [[design-system]].

**Consequences.** Design tokens are the only styling currency. New values must be
added to `globals.css` first.

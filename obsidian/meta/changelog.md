---
tags: [meta, changelog]
updated: 2026-07-15
---

# Changelog

Chronological log of notable changes to the project. Newest first.
This is a human-curated log — not a mirror of `git log`.

## 2026-07-15 (latest+15)

- **Real metadata, and every brand asset regenerated from the mark.** The site
  shipped as "New Project" with `@newproject`, a `#000000` theme colour and the
  starter's stock icons.
  - `siteConfig` now carries the brand (`Stack.Side`), a ~155-char description
    drawn from the hero's own lead and body, and `themeColor: #f0f3f4` mirroring
    `--background`. The `<title>` — *"Stack.Side — Turn money into foresight"* —
    is passed from the layout: `name` is the brand and belongs to `siteName` and
    the JSON-LD Organization, not to the tab.
  - **New `yarn brand`** (`scripts/generate-brand-assets.mjs`) generates every
    favicon, PWA/MS tile and the OG card. See [[seo-metadata]].
  - **Dependency:** `sharp@^0.34.5` added as a **devDependency** ([[tech-stack]]).
    The script ran fine without it — by reaching into a *transitive* dep of Next
    that happened to hoist into `node_modules/`. That breaks whenever Next
    changes its deps or someone installs with a non-hoisting package manager
    (pnpm). A script that imports a package should declare it. `next/og` needs no
    entry (`next` is direct), but it must be imported as `next/og.js` — the bare
    specifier only resolves through Next's bundler.
  - **The mark is a recipe, not a resize.** `logo-mark.png` is 56×56 — a 512px
    icon cannot come from it. It does not have to: sampling the PNG showed it is
    exactly `conic-gradient(from 180deg, #00ff99, #48c7c9)`, the same sweep from
    the same two tokens as `<PreloaderDial>`, matching at all four quadrants
    (9 o'clock `#12f1a5`, 12 `#24e3b2`, 3 `#36d5be`, 6 `#48c7c9`). So the script
    redraws it at any size and the icons track the tokens. Drawn pixel-by-pixel
    and supersampled — SVG has no conic gradient and sharp/satori will not fake
    one.
  - The **OG card** is 1200×630 (was 900×600 — a standing `#todo`), rendered by
    `next/og` with the real General Sans files, so it is the hero's composition
    rather than a lookalike.
  - **Found: `app/favicon.ico` was shadowing `public/favicon.ico`.** The App
    Router file convention wins at `/favicon.ico`, so a generated favicon would
    never have been served — `/favicon.ico` returned the starter's 25.9 kB stock
    icon — and the page emitted two `<link rel="icon">` for the same URL.
    Deleted; this project declares icons explicitly and keeps them in `public/`.
  - **Found: `browserconfig.xml` pointed at three 404s** (`ms-icon-*.png`, never
    shipped by the starter). Now generated.
  - `#todo` **`twitterHandle` is deliberately left `undefined`** — `twitter:site`
    claims *who owns this site*, and a guessed handle credits whichever stranger
    holds the name. The generator omits both tags rather than invent them; the
    card renders fine without. Fill in once the real account is confirmed.
  - `#todo` **`NEXT_PUBLIC_SITE_URL` is still unset**, so canonicals and `og:url`
    point at localhost — a scraper cannot fetch that, so the share preview will
    be blank until it is set.

## 2026-07-15 (latest+14)

- **Pushed to GitHub** — `github.com/textura-agency/getlayers-stackside`
  (private), `main`. Checked before pushing: `.env` is ignored and untracked,
  and the only env file in the repo is `.env.example`, placeholders only.
- `#todo` **The history carries a 55 MB video that the project no longer uses.**
  `public/assets/hero/metal-human.mp4` was the original hero clip (`052a71c`),
  replaced by the shortened `man.mp4` in `58a960b`. It is gone from the working
  tree but not from history, so the working tree is **4.4 MB while `.git` is
  60 MB** — every clone pays 60 MB for a 4 MB project, forever. GitHub warned on
  push (its hard limit is 100 MB/file, so nothing is broken).
  - Purging it means rewriting history and force-pushing, which is **cheap only
    while nobody else has cloned the repo**. That window is now. Once colleagues
    have clones, their branches diverge and it gets genuinely painful.
  - Worth knowing for next time: a size check on `git ls-files` reads the
    *working tree* and cannot see this. Deleted-but-committed blobs need
    `git count-objects -vH` or a rev-list scan.

## 2026-07-15 (latest+13)

- **The entrance starts on the lift again** — reverting latest+11. Waiting for
  the curtains to be *gone* left the page blank for the ~650ms they take to
  clear, and the halftone wave then still had to accelerate from rest (its spring
  is heavily overdamped, ζ ≈ 2.1, so it barely moves for the first half second).
  Together: about two seconds of white screen, reported as exactly that.
  - That move only ever existed to chase a "blur during the loader" that turned
    out to be the halftone's crest (removed in latest+12). **The timing was never
    the problem** — three rounds were spent re-timing around an artefact instead
    of deleting it. Recorded in [[components/common]] where the next person will
    reach for the same lever.
  - The curtains uncover the page from the bottom, which is where the wave
    starts, so the field is already developing exactly where it first shows.

## 2026-07-15 (latest+12)

- **The reveal is now only the reveal** — the "blur that goes up", reported
  twice, was the wave's own **crest**: dots swelled past their settled size as
  the front passed, which puts a band of ink across the full width, background
  included. A soft bar sweeping up the page reads as a blur artefact, not as a
  subject arriving. It was an invention on top of what was asked for; removed.
  Each cell now just grows into its own brightness as the front passes
  (`lum *= local`), so the subject develops bottom-first and nothing appears
  where the picture is empty.
  - The first report ("a weird blur while the loader disappears") was the same
    crest, crossing the screen while the curtains lifted. It was read as a timing
    problem and the timing was changed instead — which moved the artefact but did
    not remove it, and the third report was the same one again. **Two wrong
    diagnoses of one symptom**: the effect was defended instead of the complaint.
  - **The front now starts at the bottom edge**, not below it:
    `front = reveal * (1 + band)`. At `-band` the first fifth of the travel
    crossed a gap nobody could see — reported as "a white screen for two seconds,
    then it appears".
  - Re-verified by uploading a 1×1 white texture and stepping `u_reveal` by hand:
    a white source makes the ink profile *be* the wave's shape. Ink to ~10% at
    `0.2`, ~60% at `0.6`, full height at `1`, soft gradient at the front, nothing
    above it, nothing left behind.
- The dev badge needed the **server restarted**, not just the config edited —
  `devIndicators` is read at boot.

## 2026-07-15 (latest+11)

- **The entrance now starts on an uncovered page** — it fired when the
  preloader's curtains *began* to lift, which was a deliberate choice and a
  wrong one. (The store itself, [[decisions-log|ADR-0016]], is unaffected — only
  the moment it fires.) The curtains take ~1s to clear,
  so everything was half-played before it could be seen: the copy arrived
  **mid-blur**, reading as a rendering fault during the intro rather than as an
  entrance, and the halftone wave was caught at ~40% of its climb — which is why
  the subject looked like it just *appeared*, exactly as it had before the wave
  existed. The wave was working; nobody could watch it. `<Preloader>` now
  announces the moment it is **gone**, so `0` in `reveal.ts` is the first visible
  frame and the whole 2.5s climb is on screen.
  - The order follows the **reading order** again — headline, frame, copy, then
    the bottom panels. "Follow the curtain, not the reading order" only made
    sense while there was a curtain to follow.
  - `#todo` Still reasoned rather than watched: rAF is frozen in a backgrounded
    tab, so no spring can be observed running here.
- **The dev badge needed a server restart** — `devIndicators: false` is read at
  boot, so the "1 Issue" pill stayed up until the dev server was restarted.
  Nothing was actually wrong: the console is clean and the build passes.

## 2026-07-15 (latest+10)

- **The subject develops bottom to top** — the reveal was a single spring
  multiplied into `dotScale`, so every dot on screen grew at the same rate: a
  uniform fade with no direction and nothing to watch. It is now a **wave**.
  `u_reveal` / `u_revealBand` / `u_revealCrest` go to the shader and each cell
  decides for itself, because *which dots are up yet* is a question about where
  they sit. The spring drives the wave's position, not the dot size.
  - The dots **arrive oversized and shrink into place**: a crest peaks in the
    middle of the band and is zero at both ends, so a ridge of ink rides up the
    screen and leaves the picture behind it. Where the picture is dark the
    settled size is ~0, so the ridge passes and fades to nothing — that is what
    makes it read as the subject *developing* rather than as a bar sweeping
    across. A ±0.02 sine wobble across the width keeps the front a tide rather
    than a ruler.
  - Verified by driving `u_reveal` by hand on the live GL context and reading
    rows back: ridge at the bottom at `0.3`, 33% height at `0.5`, 64% at `0.7`,
    gone at `1`. An empty texture makes the crest the only thing that can draw,
    which isolates the wave's geometry from the picture.
  - `#todo` `revealBand: 0.28` / `revealCrest: 0.55` are reasoned, not eyeballed
    — rAF is frozen in a backgrounded tab, so the wave could not be watched
    running. Both are props; tune them in a focused window.
- **Removed the halftone colour panel** (`<HalftoneControls>`) — the palette is
  settled and lives in `globals.css`. `ink-tokens.ts` went with it: its only
  publisher was the panel, so it was a change signal nothing could send, and the
  field now reads its four colours once on mount. `rgbToHex` (`utils/color.ts`)
  went too — it existed to feed the panel's `<input type="color">`.
  - The **bundling lesson survives the component**: gating a dev-only client
    component's JSX on `NODE_ENV` does not stop it shipping — the `import()` must
    sit inside the folded branch. Moved to [[component-conventions]], where the
    next dev-only panel will look.
- **Hid the Next.js dev-tools badge** (`devIndicators: false`). It defaults to
  the bottom-left corner, which is where this design puts the request form, so it
  sat on top of the UI it exists to help build — and went red over warnings that
  were not the page's. Dev-only either way; it never shipped.

## 2026-07-15 (latest+9)

- **Mobile** — the page had no mobile layout: the grid scaled the 1440 frame at
  every width, so a 390px phone got a **4.17px root font-size and 4px body
  copy** — the whole design, legible only to an ant. Scaling now has a floor
  (`GRID_MIN_WIDTH` = 1024, [[decisions-log|ADR-0017]]); below it the sections
  reflow into a scrolling column via `lg:` prefixes on the same DOM, and the root
  font-size is left to the browser — and so to the user's own setting.
  - **The type scale gained a second value per role.** `:root` holds `--size-*`
    at the mobile end, a 1024 media query re-points them at the frame's, and
    `@theme inline` binds `--text-display: var(--size-display)`. `text-display`
    then resolves correctly by itself — no `lg:text-*` to forget, no
    `-mobile` twin to keep in sync. See [[design-system]].
  - **The headline's accent bar is now `em`-based and anchored to the bottom** —
    `-bottom-[0.2em] h-[0.45em] w-[4.025em]`. One set of values for both layouts:
    verified it reproduces the frame's `top-35 / h-9 / w-20.125rem` to
    sub-pixel (measured 219 / -16 / 503×56 against a spec of 218.6 / -15.6 /
    502.9×56.2), *and* lands on the last line at 40px type. Anchoring to the
    bottom rather than a line number is what makes it survive a headline that
    wraps into three lines on a narrow phone.
  - **New: `<NavMenu>`** (`views/home/nav-menu.tsx`) — a burger and a full-screen
    panel, because four links in a centre pill do not survive 375px. It borrows
    the page's own vocabulary rather than inventing one: it drops from the top
    like the preloader's curtain (same spring), and is black with white type like
    the request form. The header's CTA moves inside it. Escape closes, Lenis is
    stopped while open (which also pins native touch scroll), focus returns to
    the burger.
  - Crossing the breakpoint with the panel open **closes it** — otherwise it
    would be `display: none` while still holding the scroll lock and still a
    modal dialog to a screen reader. Verified: resizing 390 → 1200 released the
    lock and restored the desktop pill.
  - The form unrolls into a card (three thumb-sized rows), the 2×2 stat grid
    stays 2×2 and only drops its fixed card width, the header goes `fixed` so the
    burger stays reachable, and the halftone subject stays a fixed background
    under the whole column.
  - Verified at 390×844: root 16px, headline 40px, wraps "Turn money into" /
    "foresight", no horizontal overflow, page scrolls; menu opens with
    `aria-modal`, 4 links at 32px, and Escape restores everything.
  - `#todo` **This is new design, not a port.** Figma has no phone artboard —
    checked all 7,183 nodes — so every mobile size, the panel, and the stacked
    form are invented and want a designer's pass. The 1024 cut-off also means the
    frame is at its smallest (≈11.4px root) right at the boundary.

## 2026-07-15 (latest+8)

- **The hero enters** — the page now animates itself in as the preloader's
  curtains leave. One choreography file, `src/views/home/reveal.ts`, holds every
  delay, spring and target; one spring curve (`tension: 80, friction: 26`,
  ζ ≈ 1.45 — overdamped, so it glides and never bounces) is shared by everything
  that enters, which is what makes it read as a single move.
  - **Headline** — per letter, left to right, unblurring as it lands
    (`<TextEngine>` `letterIn/Out`, `letterStagger: 26`). **Description** — per
    word, rising, same treatment (`wordIn/Out`, `wordStagger: 45`). Travel is in
    `rem` so it scales with the type. Cards, pills and the header lift on
    opacity + `y` with **no** blur: blur is the text's move, and a blurred border
    reads as a rendering fault rather than as depth.
  - **The person** — [[components/common|`<HalftoneVideo>`]] takes a new
    `reveal` prop: the dots grow from zero radius to `dotScale` over ~2.5s and
    the picture develops out of the paper. The grid never moves, so he arrives in
    place. It is the largest thing on screen and therefore the slowest. The flag
    is multiplied into the existing render loop and read with `.get()`, so it
    costs no re-renders; `HeroField` joins it to the intro so `home.tsx` stays a
    Server Component.
  - **Hovers** — the header CTA and its arrow twin hover as **one** control
    (scaling them apart would pull the seam between them open); the submit button
    scales on its own. Quicker than the entrance and critically damped.
  - **Gating** — [[decisions-log|ADR-0016]]: `<Preloader>` publishes the lift
    through a module store, sections pass the flag to `enabled`. Not a matching
    delay (rots), not conditional mounting (strips the `<h1>` out of SSR).
  - The order **follows the curtain, not the reading order** — the curtains go
    up, so the page is uncovered bottom-first and the headline sees daylight
    last. Animating top-down would play it out behind a black panel.
  - Reduced motion needed **no branch at all**: the count lands on frame one, and
    react-spring drops `delay` outright while `skipAnimation` is set, so the
    whole stagger collapses to "already there".
  - `#todo` The exact delays in `reveal.ts` are reasoned, not eyeballed — the
    Chrome tab this was verified in is backgrounded, so rAF never runs and no
    spring can be watched mid-flight (`framesIn600ms: 0`, `document.hidden`).
    Watch it once in a focused window and retune the numbers by eye.
  - **Found and fixed while here:** `<br>` cannot break a `<TextEngine>` line —
    the engine's root is a wrapping flex container, so a childless element is
    just another flex item. The headline drops it and wraps on the box instead;
    verified in-browser that "Turn money into" / "foresight" split correctly, and
    that the fixed `rem` width makes the wrap point scale-invariant.
  - **Vault gap fixed:** [[components/common]] claimed `halftone-video/index.ts`
    re-exports `HalftoneControls`. It deliberately does not — that is what keeps
    the dev panel out of the production bundle. Re-verified by grepping the
    built chunks.

## 2026-07-15 (latest+7)

- **Preloader** — new [[components/common|`<Preloader>`]]
  (`src/components/common/preloader/`), mounted in the root layout. Figma
  `682:837` → `682:886`: a count fills a white ring around a spinning gradient
  disc; when it lands, the black curtain lifts and the brand-green one behind it
  follows a beat later. It unmounts once clear — it covers the viewport and
  would swallow every pointer event otherwise.
  - Four tokens in `globals.css` (see [[design-system]]). The disc's conic sweep
    was read off the Figma export pixel by pixel: it runs from `#00ff9a` — the
    accent — round to `#48c7c9`, with the seam at 6 o'clock, so it is a CSS
    `conic-gradient` rather than the 257 kB PNG Figma ships.
  - The ring uses `pathLength={1}`, which makes the dash maths the progress
    value itself. Verified by rasterising it: the sweep starts at 6 o'clock and
    runs clockwise, matching the frame's arc.
  - Geometry verified against the frame at 1440×800 — disc 299, ring 591
    concentric, label at 603, 32px italic.
  - The disc's spin is derived from the count rather than looped: a `loop: true`
    spring would keep turning after the count lands, and under
    `<ReducedMotion>`'s global `skipAnimation` each iteration would complete
    instantly and restart with nothing to pace it.

## 2026-07-15 (latest+6)

- **No scroll: the grid now caps its scale on both axes** — scaling on width
  alone made the composition `width / 1.8` tall (the frame's own ratio), and
  most windows are wider than that, so the hero rendered taller than the
  viewport and the page scrolled. `globals.css` is now
  `font-size: min(1.111111vw, 2vh)` with a new `GRID_BASE_HEIGHT` in
  `grid.config.ts`: whichever axis is tighter wins, the frame always fits whole,
  and slack on the looser axis opens up between the edge-anchored pieces rather
  than pushing anything off screen. The hero section drops its
  `max(100lvh, 50rem)` floor for a plain `h-lvh` — with the cap in place the
  pieces can no longer fold together, so the floor only caused the scrolling it
  was meant to avoid. Verified at 1440×800 / 1440×1000 / 1920×900 / 1600×600:
  no scroll, no overlap, bottom row on the bottom edge. [[decisions-log]]
  ADR-0015 updated.
- **Fixed the off-centre dot in the request button** — it was a 7px disc inside
  a 9px one, and the 1px ring is thinner than a device pixel at most scales.
  Each box snaps its painted edges to the pixel grid independently, so the ring
  landed lopsided (0.67px one side, 1.33px the other) at most window widths —
  it only looked right where the rounding happened to agree, 1440 among them.
  Now a single box with a border, which is painted as one and cannot
  de-centre. See [[components/common]] for the same hazard in reverse: nested
  circles are fine when the gap is large (the logo, the header arrow), only
  sub-pixel rings break.

## 2026-07-15 (latest+5)

- **The layout scales again — one design, one grid rule** — the hero held the
  frame's proportions only at exactly 1440. The grid shipped with four
  breakpoints, and each one asserts a design exists at its base width: widening
  past 1440 rebased the layout at 1920 and it **jumped to 75%**; narrowing past
  1024 rebased it at 1024 and it overflowed the viewport.
  - `GRID_BREAKPOINTS` is now a single `{ maxWidth: 1440, baseWidth: 1440 }`,
    and `globals.css` scales the root font-size with one unbounded rule instead
    of four media queries — continuous at every width, and right before JS runs.
  - `<AdaptiveGrid>` **unmounted** from the root layout: it exists to take over
    above the largest breakpoint, which an unbounded rule never reaches, and its
    `coef` damping would pull the design off the frame's proportions. Component
    and hook stay for when a second frame arrives.
  - The hero section gained `min-height: max(100lvh, 50rem)` — its pieces are
    placed against the frame's 800px height, so a squat window folded them
    together; it scrolls instead.
  - Verified in-browser at 1000 / 1440 / 1920: the headline holds 2.08% of the
    viewport from the left and 55.35% of it wide at all three, and the edge
    elements keep hugging the edges. See [[decisions-log]] ADR-0015, which
    amends ADR-0008.

## 2026-07-15 (latest+4)

- **Hero UI ported from Figma** — frame *Get Layers* `681:256` (1440×800) built
  out over the halftone field. New sections in `src/views/home/`:
  `site-header` (logo, centre nav pill, request CTA), `hero` (headline +
  highlight bar + lead), `hero-stats` (2×2 cards), `hero-request` (the form
  pill), `hero-trust` (social proof). Copy and figures live in
  `src/data/mocks/home.ts`; assets moved to `public/assets/hero/` per the
  section-folder rule ([[folder-structure]]).
  - **Design tokens** for the frame's colours, type scale and card radius —
    see [[design-system]]. The starter's placeholder `body` rules (flex
    centring, `height: 100vh`) are gone; they would have fought any real page.
  - **Fonts** — General Sans self-hosted via `next/font/local` (four cuts),
    plus Mulish from Google for the stat labels, which is what the frame
    specifies there. Onest is dropped. Gotcha worth keeping: `@theme inline`
    resolves `--font-sans` into utilities rather than emitting a custom
    property, so `body { font-family: var(--font-sans) }` silently did nothing
    — `<body>` carries the `font-sans` utility instead.
  - Layout is `rem` against the 1440 frame so the adaptive grid scales it as one
    unit; header pins top, the bottom row pins bottom. Verified against the
    frame in-browser at 1440×800 — every element within 1px.
  - Figma's six flattened halftone images are skipped in favour of the live
    shader.

> [!note] `#todo` — hero follow-ups
> The request form is **markup only**; submission is not wired to
> `/api/contact`. Only the desktop frame exists — below the grid's 1024
> breakpoint the 1440-based layout will overflow, and needs its own frames.

## 2026-07-15 (latest+3)

- **Halftone repalette — green on off-white** — `--halftone-bg` `#f0f3f4`,
  ink ramp `#aeff00` → `#00bd71` → `#007548` (client-supplied). `--halftone-bg`
  no longer tracks `var(--background)`: the field covers the viewport, so it is
  the page's real backdrop and `--background` only shows through if WebGL2 is
  missing. See [[design-system]].
- Assets landed for an upcoming Figma port — `public/assets/1-3.png` and the
  **GeneralSans** family in `src/app/fonts/`. Neither is wired up yet: the Figma
  Dev Mode MCP server is off, so the design can't be read. `#todo` until it is.

## 2026-07-15 (latest+2)

- **Colour panel; dots go crisp** — two changes to
  [[components/common|`<HalftoneVideo>`]].
  - New `<HalftoneControls>` — a dev-only live picker for the four
    `--halftone-*` tokens. It edits them on `:root` so the real cascade is what
    you see, and *Copy CSS* returns a block for `globals.css`; the tokens stay
    the source of truth. New `ink-tokens.ts` carries the change signal — the
    field reads its tokens once, not per frame, so a runtime rewrite has to
    announce itself. `rgbToHex` added to `utils/color.ts` ([[utils]]) to feed
    the pickers. See [[design-system]].
  - **Keeping it out of production took more than gating the JSX.** A
    `NODE_ENV` check over a static import still shipped the panel: the import
    registers it in the page's client manifest and the bundler packed it into
    the hero's own chunk, which every visitor downloads. The `import()` has to
    sit *inside* the branch that folds away. `index.ts` no longer re-exports the
    panel for the same reason. Both are written up in [[components/common]].
  - **Blur off.** `softness` is now *extra* blur on top of antialiasing rather
    than the antialiasing itself, and defaults to `0`; the shader always
    feathers by half a device pixel (derived from `cellSize`, so it holds at any
    DPR). `dotScale` drops to `0.72` to match: with blur gone the radius cap
    jumps to nearly half a cell, and the old `1` would have landed a far denser
    field than the tuning was set for.

## 2026-07-15 (latest+1)

- **Pointer perspective; ink ramp goes multi-hue** — two additions to
  [[components/common|`<HalftoneVideo>`]].
  - New `tilt` prop (hero uses `0.24`): the picture leans away from the pointer
    as a perspective plane — a projective divide, so it reads as depth rather
    than skew. Only the sample position leans; the dot grid stays
    screen-aligned, keeping the field's even texture. The pointer spring now
    carries both tilt axes alongside the clip position.
  - **Ink ramp re-keyed to position.** A third token `--halftone-ink-mid` turns
    the two-stop fade into a cyan → blue → indigo ramp, and it now runs on a
    diagonal across the frame rather than on cell brightness. Keying it to
    brightness looked obvious but reads as one flat colour: brightness already
    sets the dot's *size*, so the light stop only ever lands on cells too small
    to show it. New `inkSpread` prop (default `2.5`) packs the ramp around the
    middle of the frame — at `1` a centred subject covers only the ramp's
    middle and the outer stops never appear. See [[design-system]].

## 2026-07-15 (latest)

- **Scrubbing no longer seeks; hero mirrored** — the pointer-driven head turn
  juddered because the loop asked the decoder for a seek every ~16 ms while each
  seek costs ~25–65 ms. `pointerScrub` now decodes the clip into stills up front
  (new `capture-frames.ts`) and picks one per frame, so it tracks at the full
  frame rate. Cost: a ~2.5 s / ~35 MB one-off decode; stills publish as they
  land, so the field settles during the first pass.
  - `halftone-renderer.ts` no longer knows about video — it draws any
    `TexImageSource` and re-uploads on a `sourceKey` change. The `seeked`
    listener is gone with the seeking.
  - New `mirror` prop, set on the home hero: flips the sampled image, reversing
    which way the head faces and turns.
  - Gotcha worth keeping: `UNPACK_FLIP_Y_WEBGL` has **no effect on an
    ImageBitmap**, so decoded stills uploaded upside down next to the `<video>`
    path until they were created with `imageOrientation: "flipY"`.
  - The field now reads smoother than before: stills are captured below source
    resolution, which pre-averages the frame. The old grit was point-sampling
    alias rather than detail. See [[components/common]].

## 2026-07-15 (later still)

- **Hero clip swapped; pointer scrubs the head turn** — `metal-human.mp4` (55 MB,
  10 s) replaced by `man.mp4` (3 MB, 4.4 s, 962×720). Recoverable from git if
  needed.
- **New `pointerScrub` prop** on [[components/common|`<HalftoneVideo>`]]: the
  pointer's horizontal position drives `currentTime` instead of the clip
  playing, so the head turns as the cursor moves. Spring-smoothed via
  `useSpring` read inside the shared ticker, per [[animation-system]]. The
  renderer now also re-uploads on `seeked`, since a completed seek lands a new
  frame without moving `currentTime`.

> [!note] `#todo` — the clip can't do centre-is-straight
> The brief was: cursor centred → head straight, cursor right/left → head turns
> that way. `man.mp4` is a **one-way sweep** with no frontal pose (rear ->
> three-quarter -> near-frontal at the last frame), so the screen centre lands
> mid-sweep and neither edge points "right". Mirroring one half was tried and
> rejected: it is symmetric, but the clip's end pose isn't frontal, so the image
> visibly flips as the pointer crosses the centre. Footage that **starts frontal
> and turns to one side** would give the brief exactly, mirroring the other half
> for free.

## 2026-07-15 (later)

- **Site goes light; halftone field goes blue and soft** — the page background is
  now white and the field reads as blue ink on it.
  - **Light-only.** Dropped the `prefers-color-scheme: dark` override from
    `globals.css`; see [[design-system]] for why it is not a two-token flip to
    put back.
  - **Blue, not the clip's palette.** Replaced the video-colour pass with two
    ink tokens — `--halftone-ink-light` / `--halftone-ink-deep` — mixed by cell
    brightness. `--halftone-bg` now tracks `var(--background)`.
  - **No more steps, no more corners.** The shape atlas is gone: the dot is now
    an analytic feathered distance field in the fragment shader, so its radius
    is continuous instead of quantised into ramp steps — the source of the
    field's harshness. Circles only; the `ramp` / `ShapeSpec` API and
    `shape-atlas.ts` were removed, and new `dotScale` / `softness` props took
    their place. The radius is capped so a dot's feather always lands inside its
    cell, since past that the cell clips it into a square.
  - Retuned exposure to `1.9` / `0.62` for the new response curve.

## 2026-07-15

- **Home hero — halftone video background** — added
  [[components/common|`<HalftoneVideo>`]]
  (`src/components/common/halftone-video/`), a full-bleed video background
  rendered as a halftone matrix of geometric shapes by a WebGL2 shader. Each
  cell samples the clip once, its brightness picks a ramp shape, and the shape
  is painted in that cell's own colour, so the field keeps the clip's palette.
  Mounted in `HomeView`; the clip lives at `public/assets/hero/metal-human.mp4`
  and its path comes from `src/data/mocks/home.ts` per [[component-conventions]].
  - **No new dependency** — raw WebGL2 rather than `three.js`; see
    [[decisions-log]] ADR-0014. [[tech-stack]] unchanged.
  - New token `--halftone-bg` in `globals.css` (see [[design-system]]), read into
    the shader through the new `readCssColor` helper ([[utils]]) so no colour is
    hardcoded in GLSL.
  - New hook `usePrefersReducedMotion` ([[hooks]]) — `<ReducedMotion>` covers
    react-spring, but a playing video has to honour the preference itself.
  - Shipped first as `<AsciiVideo>`: an ASCII-character ramp, monochrome ink, and
    a pointer-driven ripple. Reworked the same day per feedback — characters →
    procedurally drawn shapes, ink → the video's own colour, and the pointer
    interaction dropped. Renamed to match what it now does; the `--ascii-*` ink
    and glow tokens went with it.

## 2026-06-07

- **Fixed `<Inview>` standalone reveal + spring resize gating** — `<Inview>`
  never animated unless an external `trigger` ref was passed. The JSX `ref`
  callback wrote `inViewRef.current = node`, but that tuple slot is a *callback
  ref* (`setNode`), so the element was never observed and the `node` stayed
  `null`. Now calls `setInViewNode(node)`. This was also a build-breaking type
  error. Additionally, `<Inview>`, `<Spring>`, and `<Hover>` tracked `width` as a
  hook dependency but never passed it to `isMobileDisabled` — fixed by passing the
  tracked `width`, restoring resize re-evaluation and clearing the
  `react-hooks/exhaustive-deps` warnings. `yarn build` and `yarn lint` are now
  clean. See [[decisions-log]] ADR-0013 and [[components/animation-springs]].

## 2026-06-05

- **Home view emptied** — removed the animation showcase (`src/views/home-showcase.tsx`
  deleted) and reduced `HomeView` to an empty `<main>`. The home view is now the
  blank starting point for new work. Documented the convention — *if the project
  is empty and no other instructions are provided, start developing in the home
  view on route `/`* — in [[ai-agent-guide]] and [[new-page]].

## 2026-05-23

- **README — setup + Vercel deploy steps added** — *Getting started* expanded
  into a four-step flow (clone the template → delete bundled `.git` →
  initialise your own GitHub repo → install & run), with a macOS hint for
  revealing the hidden `.git` folder (`⇧ + ⌘ + .`). Added a *🚀 Deploy to
  Vercel* section covering the CLI flow (`vercel` / `vercel --prod`) and the
  dashboard import path, plus an `env pull` pointer to
  [[environment-variables]].
- **README rewritten to lead with the AI workflow** — root `README.md`
  reorganised so the AI usage guide is the first section: how the three
  `.claude/settings.json` hooks (`SessionStart`, `UserPromptSubmit`, `Stop`)
  enforce the vault workflow automatically, how to write a good request
  against this convention layer, and a cost-expectations note recommending
  **Claude Max (5×)** as the minimum plan (the vault-fan-out + hook
  re-injection on every turn is token-intensive by design). Technical
  *Getting started* and the existing AI-agents entry-point pointer stay
  below.

## 2026-05-22

- **Styling-placement convention added** — to stop `globals.css` accumulating
  hundreds of component-specific classes, styling now follows a strict
  placement order: one-offs are Tailwind utilities, repeated patterns become
  **React components** (not `@layer components` classes), and `@layer
  components` is reserved strictly for pseudo-elements and third-party
  overrides. `globals.css` stays bounded — `@import`, tokens, base resets only.
  No CSS Modules. Codified in [[decisions-log]] ADR-0012; [[design-system]]
  (new *Where a style goes* section) and [[component-conventions]] updated.
- **Semantic-HTML / SEO-markup convention added** — new [[html-semantics]]
  rulebook: landmarks, one `<h1>` + heading outline, native elements over
  `div`s, forms/images/ARIA, JSON-LD over microdata, a `data-*` convention, and
  passing a semantic `tag` to animation components. Codified as AGENTS.md hard
  rule #10; cross-linked from [[component-conventions]] and [[new-page]]. Fixed
  the demo (`home-showcase.tsx`) to a single `<h1>` to follow it.
- **API layer added** — a convention for reaching external services.
  `app/api/<resource>/route.ts` Route Handlers own their logic and read secret
  env vars directly (safe — route files never reach the browser). New: `zod`
  dependency; `src/env.ts` (validated env, public/server split); `src/lib/api/`
  (`handle` wrapper + `ApiError` + `{ data }`/`{ error }` envelope);
  `src/lib/api-client.ts` (typed same-origin fetch); example
  `app/api/contact/route.ts`. Codified as AGENTS.md hard rule #9. See
  [[decisions-log]] ADR-0011 and [[api-architecture]].

## 2026-05-21

- **Asset convention added** — site content assets (images, videos) now live
  under `public/assets/<section>/`, one folder per section; meta/PWA/SEO assets
  stay at the `public/` root. Documented in [[folder-structure]],
  [[component-conventions]], and the [[new-page]] playbook; `public/assets/`
  created with a `.gitkeep`.
- **SEO & performance hardening** — a broad pass on the starter. **SEO:** new
  `src/lib/site.ts` config (single source of truth, fed by `NEXT_PUBLIC_SITE_URL`);
  `metadataBase` is now always set (relative OG/canonical URLs resolve);
  `themeColor` moved to a `viewport` export; added `app/robots.ts`,
  `app/sitemap.ts`, and an `Organization`+`WebSite` JSON-LD helper; OG image
  dimensions corrected to match the asset; dead `keywords`/`other` tags dropped.
  **Performance:** populated `next.config.ts` (`removeConsole` in prod,
  AVIF/WebP, `next/image` breakpoints aligned to the grid, `poweredByHeader:
  false`); fixed a `requestAnimationFrame` leak in `ScrollLayout` (Lenis loop
  never cancelled on unmount); `HomeView` is now a Server Component with the
  animation demo split into the `HomeShowcase` client leaf; added
  `<ReducedMotion>` (honours `prefers-reduced-motion` via react-spring's global
  `skipAnimation`); removed a per-frame `console.log` from the demo; added
  `app/loading.tsx` / `error.tsx` / `not-found.tsx`. See [[decisions-log]]
  ADR-0010, [[seo-metadata]], and [[environment-variables]].
- **Animation engine — lint pass** — cleared all 13 pre-existing ESLint problems
  in the engine (2 errors + 11 warnings), an authorized engine edit (ADR-0009).
  `isMobileDisabled` now takes an optional `viewportWidth` argument, so the
  `active` memos in `<Spring>` / `<Hover>` / `<Inview>` / the trigger hooks
  depend on it genuinely. Added missing `disableOnMobile` effect deps; fixed a
  `trigger.current`-in-cleanup hazard in `<Hover>`; ref-stabilised `<Handle>`'s
  transition effects. **API change:** `useProgressTrigger` now returns `progress`
  as a `RefObject<number>` (read `.current`) instead of a render-time ref read —
  no consumer was affected (`<ProgressTrigger>` discards the return).
- **Animation engine — performance refactor** — fixed load issues that scaled
  with the number of animated components. Added `src/lib/animation/ticker.ts`, a
  single reference-counted `requestAnimationFrame` loop; `useLoop` (and all loop
  hooks) now subscribe to it instead of each starting its own rAF. `useWindowWidth`
  / `Height` / `Size` now share one debounced `resize` listener via a
  `useSyncExternalStore` store (the `debounceDelay` param was dropped — unused).
  `useDynamicInView` rewritten without the per-render `Proxy`/observer churn.
  Fixed a stale-closure bug in `useLoop`. `mode="forward"` scroll listeners made
  `passive`. This was an **authorized edit to `#do-not-modify` engine files** —
  hard rule #2 amended. See [[decisions-log]] ADR-0009 and [[animation-system]].
- **`spring-text-engine` updated** — bumped `^0.1.3` → `^0.1.5` (latest). The
  public API, types, and dependencies are unchanged between these versions
  (verified) — an internal-only patch bump, no code changes required.
- **Adaptive scaling grid added** — a root-font-size scaling system landed in
  `src/components/common/grid/` (`<AdaptiveGrid>` + `useAdaptiveGrid` hook +
  `grid.config.ts`), with `vw` media queries in `globals.css` for scale-down.
  It was dropped into `common/` as a `styled-components` system; ported to the
  project stack — config-driven TS + CSS-only Tailwind, no `styled-components`.
  The unused dropped files (`colors.ts`, `fonts.ts`, `utils.ts`, `index.ts`,
  the `styled-components` `grid.tsx`) were removed. Mounted via `<AdaptiveGrid>`
  in the root layout. See [[components/common]] and [[decisions-log]] ADR-0008.
- **Vault created** — `obsidian/` Obsidian vault initialised as the project's
  second brain. Architecture, frontend, and workflow docs populated. See [[decisions-log]] ADR-0001.
- **Root README rewritten** — replaced `create-next-app` boilerplate with a real
  project README that points into this vault.
- **`generic-layout-prompt.md` moved** — relocated from repo root to
  `obsidian/workflows/` as [[generic-layout-prompt]].
- **Navigation convention resolved** — standard `next/link` confirmed; the unbuilt
  `<AnimLink>` / `useAnimRouter()` convention dropped. See [[decisions-log]] ADR-0005.
- **Docs consolidated into the vault** — `project-specs.md` deleted (decomposed into
  vault notes + new [[environment-variables]]); `text-engine-docs.md` moved in as
  [[text-engine-reference]]. `AGENTS.md` rewritten as a thin shim; `.cursorrules`
  repointed to `@AGENTS.md`. The vault is now the single source of truth.
  See [[decisions-log]] ADR-0006.
- **Vault renamed & restructured** — vault folder `getlayers.io/` → `obsidian/`;
  number prefixes dropped from section folders (`00-meta` → `meta`, etc.). Project
  name standardised to **`next16-claude-starter`** across docs and `package.json`.
- **Components linked to docs** — every file in `src/components/` now carries a
  `// 📖 Docs:` pointer comment to its catalog note, so agents can jump from code
  to docs and back.
- **Vault workflow automated** — added `.claude/settings.json` with `SessionStart`,
  `UserPromptSubmit`, and `Stop` hooks that make agents read the vault first,
  follow the relevant guide, and update docs after every change — with no manual
  reminder. See [[decisions-log]] ADR-0007 and [[ai-agent-guide]].
- **Cookie component replaced** — the `react-cookie-consent`-based `cookie.tsx`
  was replaced by an in-house `Cookie/` component (banner + category preferences
  modal + Zustand store). `react-cookie-consent` removed from dependencies. The
  component shipped using `styled-components` + an external design system; it was
  ported to the project stack — Tailwind v4 tokens and `@react-spring/web` motion.
  Mounted via `<LazyCookie>`. See [[components/common]].
- **Fixed TextEngine spring type mismatch** — the `mode="once"` heading in
  `views/home.tsx` mixed `lineIn={{ y: 0 }}` (number) with `lineOut={{ y: "100%" }}`
  (string), throwing *"Cannot animate between _AnimatedString and _AnimatedValue"*.
  Changed to `y: "0%"`. The buggy pattern in [[text-engine]] / [[text-engine-reference]]
  examples was corrected and a type-matching gotcha note added.

## Project baseline (git history)

| Commit | Description |
|--------|-------------|
| `94b0870` | feat: update starter |
| `5280ef2` | fix: linter errors & build |
| `b2b84e6` | initial — `next16-claude-starter` scaffold |

> [!note]
> The starter shipped with: Next.js 16.2, React 19.2, Tailwind v4, `@react-spring/web`,
> `spring-text-engine`, Lenis, and Zustand. See [[tech-stack]] for the current state.

# Agent Guide — FarEdge Labs

## What this project is

A bilingual one-page company site. **Next.js 16 App Router, exported as static
HTML, served by GitHub Pages** at `https://faredgelabs.com`.

It began as the `next16-claude-starter` template (a marketing page called
"Stack.Side"), and much of the animation machinery is still that template's. The
copy, the routing, the colour system and everything server-shaped have been
rewritten. Where this guide and the template's own conventions disagree, this
guide wins.

## The one constraint that shapes everything

`next.config.ts` sets `output: "export"`. **There is no server at runtime.** Not
in production, not on a preview — the build emits files and GitHub Pages serves
them.

So the following do not exist and must not be reached for:

- **Route Handlers** (`app/**/route.ts`) — a `POST` handler fails the build
- **Middleware** — no request-time redirects, rewrites, or locale negotiation
- **Server Actions**, ISR, on-demand revalidation, `cookies()`, `headers()`
- **`next/image` optimisation** — `images.unoptimized` is set; ship right-sized
  files in `public/`
- **Server-only secrets** — every env var is inlined at build time. `src/env.ts`
  validates the public ones. If a value must stay private, it belongs in the
  backend, never here

Metadata routes (`robots.ts`, `sitemap.ts`) need `export const dynamic = "force-static"`.

The backend is separate: `cdk/` and `lambda_functions/` hold AWS (API Gateway +
Lambda), and a move to GCP is planned. The browser calls it directly over the
network. There is nothing between the two.

## Two locales, two root layouts

`/` is Japanese, `/en/` is English. The default locale sits at the root because a
static host cannot redirect.

```
src/app/
├─ layout-shell.tsx      the shared <html>/<body>/providers
├─ fonts.ts              next/font, declared once for both layouts
├─ (ja)/layout.tsx       root layout, locale="ja"  → /
├─ (ja)/page.tsx         + not-found / loading / error
├─ (en)/layout.tsx       root layout, locale="en"
└─ (en)/en/page.tsx      → /en/
```

Two root layouts in route groups, because **only a root layout can set
`<html lang>`** — one shared layout would have to misdeclare one of the two
languages. There is deliberately no `src/app/layout.tsx`; adding one breaks the
group structure.

**All user-facing strings live in `src/locales/<locale>.json`.** Never hardcode
copy in a component. The two files must stay **key-for-key identical** — the
locale registry (`src/locales/index.ts`) types them as one shape, so a missing key
is a type error at every call site. `scripts/generate-brand-assets.mjs` reads the
same JSON to render the Open Graph card, which is why it is JSON and not TS.

Asset paths and layout live in `src/data/mocks/home.ts` (`getHomeContent(locale)`).
Language is the JSON's job; file paths are not language.

Adding a locale: write the JSON, add the code to `locales`, add a route group with
its own root layout, and render a per-locale OG card. Note the bundled General
Sans is **Latin-only** — a Japanese OG card needs a font with the glyphs added to
`src/app/fonts/`; the brand script throws rather than emitting an empty card.

## Hard rules (never violate)

1. **All motion is spring-based** — `@react-spring/web` via the components in
   `src/components/animation/springs/`. Text animation uses `spring-text-engine`.
   No CSS transitions, no CSS keyframes, no `framer-motion`.
2. **Do not modify** `src/components/animation/springs/` or `src/hooks/animation/`
   without explicit sign-off — they are the vendored animation engine.
3. **Never `mode="manual"`** on `TextEngine` — use `always` / `once` / `forward` /
   `progress`.
4. **No hardcoded values** — design tokens in `globals.css` for styles; props for
   content. No raw hex/px in class names.
5. **Routes delegate to views** — `app/**/page.tsx` imports only from `src/views/`.
6. **Server Components by default**; add `"use client"` only at the leaves.
7. **No `any`.** Type everything. Run `npm run lint` **and** `npx tsc --noEmit`
   before finishing — `@typescript-eslint/no-unused-vars` is off in
   `eslint.config.mjs`, so ESLint alone will not catch dead imports.
8. **Navigation** — standard `next/link` `<Link>` and `next/navigation` `useRouter`.
9. **No server, no secrets** — see the constraint section above. Client-side
   `fetch` straight to the backend; validate what you send, and expect the backend
   to validate again.
10. **Semantic, SEO-correct HTML** — native elements over `div`s, one `<h1>` +
    a clean heading outline, named landmarks, real `button`/`a`, `alt` text,
    JSON-LD (not microdata), semantic `tag` on animation components.

## Colour tokens: which ink goes on which ground

The site follows the OS through `prefers-color-scheme` — **light is pink, dark is
green**, with no toggle and nothing stored (ADR-0019, ADR-0020).

This is where the same bug was introduced twice, so it is worth stating plainly.
A token names **the ink for a specific ground**, not "black" or "white":

| Token | Use it for |
|-------|-----------|
| `--foreground` | ink on the page itself |
| `--on-accent` | ink on an accent surface (pills, the burger's bars). Dark in *both* schemes, because the accent is bright in both |
| `--menu-panel` / `--menu-ink` | the phone menu's curtain, which stays dark in both schemes |
| `--surface` | cards and pills that must separate from the field |
| `--halftone-*` | the WebGL field's ground and its three-step ink ramp |
| `--mark-sweep-from` / `--mark-sweep-to` | the brand mark's conic sweep |

Using `--foreground` / `--surface` as stand-ins for black and white is what broke
the language pill (near-white type on bright green) and the phone menu (a *light*
curtain in dark mode). Ask what the element sits on, then pick the token.

Two consumers do not follow the scheme and have to be remembered:

- **`<HalftoneVideo>` samples the `--halftone-*` tokens into a ref** rather than
  reading them per frame, and re-samples on a `prefers-color-scheme` change. A new
  token used by the shader must be added to that subscription or it keeps its old
  value until reload.
- **`scripts/generate-brand-assets.mjs`** bakes `SWEEP_FROM` / `SWEEP_TO` as
  literals. Keep them in step with the tokens, and remember the favicons, PWA
  icons and OG card can only hold one scheme's palette.

## What the page is made of

Text, not images. The only assets are the hero clip (`man.mp4`, H.264 — **not**
HEVC, which Android Chrome may refuse) and the generated icons. The headline, the
copy, the stat labels and the nav are all real text, which is why translating is a
JSON edit.

The hero's entrance is sequenced by one signal: `<IntroReveal>` fires
`markIntroRevealed()` on mount, every section holds at rest until
`useIntroRevealed()` flips, then plays on the delays in
`src/views/home/reveal.ts`. There is no loader — the template's counted a fixed
2200ms and measured nothing (ADR-0019). Because the signal now fires immediately,
**every millisecond in `reveal.ts` is one the visitor waits**; treat the budget as
something to spend down.

`hero.stats` still carries placeholder `—` values. Fill them with real figures or
drop the section. Do not invent metrics — the social-proof pill and its stock
avatars were deleted for exactly that reason.

> [!important] The blank hero on old browsers is a decision, not a bug
> `<HalftoneVideo>` needs **WebGL2** and **`createImageBitmap`**, both of which
> Safari only shipped by default in 15 (2021). Without them the field draws
> nothing, and because pointer-scrubbing parks the clip there is no visible
> `<video>` behind it either: on those browsers the hero background is simply
> empty.
>
> This is accepted. Everything that carries meaning — headline, copy, stats, nav,
> language switch — is text and renders fine, so what is lost is decoration. A
> fallback would mean shipping and maintaining a second asset plus a branch in the
> component, for visitors who are already reading the whole page.
>
> **Do not add a bare `<video>` fallback.** A paused, un-halftoned clip is not
> the design. If this is ever revisited, the shape to use is a still frame of the
> subject facing forward — the same thing `progress: 0.5` shows — as a `poster`,
> so the composition still reads. Until someone decides that is worth an extra
> asset, empty is the intended result.
>
> The field's cost is tuned by two constants in `halftone-video.tsx`: `MAX_DPR`
> (per-frame, the one that makes an old GPU struggle) and `scrubFrames` (startup
> seeks and memory). They were halved from the template's values; both have notes
> explaining what each buys.

## Deploying

`main` → an auto-created release PR → merge to `production` → build → the `out/`
directory is pushed to `gh-pages`.

- `public/CNAME` and `public/.nojekyll` must survive every deploy. Jekyll skips
  `_next/`, so without `.nojekyll` the site loads no JS or CSS
- `NEXT_PUBLIC_SITE_URL` is set in the workflow, not committed — it drives
  canonical URLs, OG tags, `robots.txt`, `sitemap.xml` and JSON-LD
- The CDK job in `deploy.yml` is **commented out** while the frontend is rebuilt.
  Restore it, and `needs: deploy-infrastructure`, when the app starts consuming
  the API at build time
- `npm run brand` is not part of the build. Run it locally and commit the PNGs
- Do not delete `.next` while `npm run dev` is running — Turbopack's cache is in
  there and the server does not recover

## Documentation

`obsidian/` is an Obsidian vault of longer-form notes, inherited from the template
and partly retargeted. It is **reference, not law** — this file is the contract,
and where the vault still describes Stack.Side or a Vercel deployment, it is
stale. `obsidian/meta/decisions-log.md` is the part worth keeping current: it
records *why*, which is the thing that cannot be recovered by reading the code.

After making changes: dependency changes → `tech-stack.md` + `changelog.md`;
architectural choices → an ADR in `decisions-log.md`; new component/hook/util →
the relevant catalog note. Update this file when a hard rule or a constraint
changes.

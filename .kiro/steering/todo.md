---
inclusion: manual
---

# TODO — FarEdge Labs

**Loaded on request only.** Pull it in with `#todo` when you want to pick up work
or check what is outstanding; it stays out of context the rest of the time.

Not a backlog of everything imaginable — only things that are already *decided or
deliberately deferred*, so nothing here needs re-litigating from scratch. Where a
decision exists it is linked. Delete an entry when it lands; that is the whole
process.

Updated 2026-07-31. The site is live at https://faredgelabs.com (ja) and
`/en/` (en).

---

## Blocking a real launch

### Analytics is decided but not installed
ADR-0018 chose **Cloudflare Web Analytics** — cookieless, which is why there is no
consent banner. The snippet has never been added, so right now the site measures
nothing at all. Needs the site token from the Cloudflare dashboard, then a
`next/script` tag in `layout-shell.tsx`.

This is the one item where the code contradicts a written decision.

### `hero.stats` — four cards that describe a different company
The 2×2 grid is the template's: Projects, Clients, Uptime, Rating, all showing `—`.
The **labels** are the problem, not the empty values — the company was founded
weeks ago, the first engagement is in progress, and nothing has been rated.

Either find four things true today and worth saying, or drop the section. The hero
survives without it: the frame's bottom half is already empty since the request
form and the social-proof pill were removed. Do not invent metrics. Candidates
that need no track record: years of engineering experience, breadth of stack,
domains worked in (space, medical, automotive, metaverse).

See the note in `AGENTS.md` → "What the page is made of".

### Services / Works / About are placeholders
Six live routes (three segments × two locales) render "under construction" and
carry `noindex`. They exist so the nav can be walked on a real device.

When one becomes real: write its `page.tsx`, drop `noindex`, drop its entry from
`PLACEHOLDER_SEGMENTS` in `src/views/under-construction/pages.ts`, and **add it to
`src/app/sitemap.ts`** — placeholders are deliberately absent from the sitemap.

### No contact route
`lambda_functions/contact_form/app.py` requires **`name`, `email`, `message`** and
sends through Zoho SMTP with a DynamoDB rate limit. Nothing on the site calls it.
The hero's inline form was deleted rather than wired: two fields with no message
field produce an enquiry with no subject.

Blocked on the backend question below — a `/contact` page written against API
Gateway has to be rewritten if the backend moves to GCP.

---

## Decisions still open

### Backend: stay on AWS or move to GCP
`cdk/` and `lambda_functions/` are AWS (API Gateway, Lambda, DynamoDB, Cognito).
Moving to GCP was raised. The CDK job in `.github/workflows/deploy.yml` is
**commented out** in the meantime, so `production` deploys the frontend only.

Whichever way this goes, the contact form is the only thing that needs a backend
today, and it is small: a function plus SMTP plus a rate limit.

Restoring the CDK job means also restoring `needs: deploy-infrastructure` on the
frontend job.

### A real logo
The mark is a placeholder — a conic gradient, drawn in CSS in the header and baked
into every icon by `scripts/generate-brand-assets.mjs`.

ADR-0020 gave it a palette per colour scheme (pink light / green dark) *because* it
is a placeholder. A brand that intends to be recognised may well want one hue.
Revisit the two-palette decision when the logo is designed.

`public/assets/hero/logo-mark.png` is no longer referenced by anything — delete it
with the same change.

---

## Known rough edges, consciously left

### The headline bar swallows the accent word in dark mode
Near-white type on the solid green bar measures **1.19:1**, while the same word
reads at 17:1 just above the bar. It was tried at 35% alpha (6.66:1, matching light
mode's 6.74:1) and reverted — correct on paper, visually flat.

Options not yet tried, best first:
1. **Move the bar below the glyphs in dark mode** — keeps the bright green, drops
   the overlap. Currently `-bottom-[0.2em] h-[0.45em]` in `hero-headline.tsx`.
2. Shift it just enough that only descenders cross it.
3. Accept 3:1 (the headline is large text by WCAG) and use ~50% alpha.

### Empty hero on browsers without WebGL2
Deliberate — see the `[!important]` block in `AGENTS.md`. **Do not add a bare
`<video>` fallback.** If revisited, the shape is a still of the subject facing
forward (what `progress: 0.5` shows) as a `poster`.

### The Japanese OG card's font subset only holds the kanji in use
`src/app/fonts/NotoSansJP-{Light,Regular}.subset.ttf` (~100 kB each) cover kana, CJK
punctuation and **exactly the kanji the copy used when they were fetched**. Kana
rewording is free; a new kanji is not.

`scripts/generate-brand-assets.mjs` reads the fonts' own `cmap` and refuses to
render rather than emitting a card with holes in it, naming the characters and the
command:

```
python3 scripts/fetch-jp-subset.py     # re-fetch the subset
BRAND_LOCALE=ja npm run brand          # re-render the card
```

### `hreflang` assumes one page per segment
`languageAlternates()` maps a segment into every locale, which is right today. A
route that exists in only one language would need real per-page data.

### Dead imports in the animation engine
Five unused locals in `src/components/animation/springs/` (`in-view.tsx`,
`spring-trigger.tsx`), found with `tsc --noUnusedLocals`. That directory is
`#do-not-modify` without sign-off, and `@typescript-eslint/no-unused-vars` is off
in `eslint.config.mjs`, so `npm run lint` will not catch these or new ones.

Cheap fix once the engine is fair game: turn the rule on, or set
`noUnusedLocals` in `tsconfig.json`.

### Dependencies held back on purpose
- **eslint 9 → 10** would clear the `brace-expansion` advisory. `eslint-config-next`
  declares `eslint >= 9`, so it is compatible; held back because flat-config
  behaviour changes in a major and lint is currently stable.
- **TypeScript 5.9 → 7** is the Go-native compiler, two majors, with 6.0 as the
  intended migration bridge. Not a routine bump.
- `npm audit` will not reach zero: `next` pins `postcss 8.4.31` and `sharp ^0.34.5`
  as its own dependencies. Both are build-time only, and neither runs in a static
  export. **Never accept `npm audit fix --force`** here — it proposes `next@9.3.3`.

---

## Small and mechanical

- **No AAAA records.** IPv6-only clients cannot reach the site. GitHub publishes
  four: `2606:50c0:800{0,1,2,3}::153`. `www` and the apex A records are set.

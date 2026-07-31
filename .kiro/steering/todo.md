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

### `hero.stats` — to be fed from Jibble, three cards not four
The 2×2 grid is the template's: Projects, Clients, Uptime, Rating, all showing `—`.
The **labels** were the problem, not the empty values — the company was founded
weeks ago, the first engagement is in progress, and nothing has been rated.

**Decided:** drop to three cards and fill them from the Jibble time tracker's API,
refreshed daily by a scheduled job. Jibble treats *client* as a grouping dimension
alongside project and activity, so a single Tracked Time Report call can yield
hours, distinct clients and distinct projects.

`hero-stats.tsx` maps over an array, so 4 → 3 is the two locale JSONs plus the
`grid-cols-2` class. The `accented` flag per card stays.

Two things are still open:

- **The labels.** Do not pick them before seeing what the API actually returns —
  that is how the current four got there. Probe first (step 1 of the migration
  below). One caution: *hours in the last 30 days* is a number that goes **down**
  when you take a week off, and there is no honest way to tune it. Cumulative
  figures only move one way.
- **The empty state.** The numbers arrive by client-side `fetch`, so first paint
  has none of them, above the fold. Decide what that frame shows — skeleton, or
  labels with `—` that swap in. On a day the job or the bucket fails the cards
  stay in that state, so it has to be a designed state, not an accident.

Crawlers will not see the figures. That is fine; nobody searches for them.

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

It is being ported to GCP rather than wired as-is — step 7 of the migration below.
It is deliberately *after* the stats job, which is the smaller thing to prove the
new platform with.

---

## The GCP migration, in order

**Decided:** the backend moves to GCP, provisioned with **Terraform**. The stats
job goes first — it is the smaller of the two functions and it proves the whole
chain (Terraform, Secret Manager, Cloud Run, GCS, CORS) with a trivial payload, no
form UI, no email deliverability and no spam surface. The contact form then lands
on ground that is known to work.

Ordered by dependency, not by size. Steps 1 and 2 can run in parallel; everything
after 2 is a chain.

**None of this touches GitHub Actions.** The site deploy and the stats refresh are
independent on purpose: the job writes an object, the page reads it, and neither
knows the other's schedule. The CDK job in `deploy.yml` stays commented out and
will be deleted rather than restored.

### 1. Probe the Jibble API — needs nothing from GCP
An organization owner creates the credential in Organization Settings → API
Credentials; **the secret is shown once**. Auth is OAuth2 client-credentials
against `https://identity.prod.jibble.io/connect/token`.

Call the Tracked Time Report from a laptop and **read the response before choosing
the three labels** or writing any job. Picking labels first is exactly how the
current four cards got there.

### 2. Company email → Google account → GCP project → billing
Strict order. The APIs in step 3 will not enable without billing attached.

Then re-point local auth and *verify* it, rather than assuming: `gcloud auth list`
and `gcloud config list` should show the new account as active, not merely present.

The mail decision here has a second consumer — it fixes the contact form's sender
identity in step 7. Zoho or Google Workspace, decided once, not twice.

### 3. Terraform bootstrap
State lives in a GCS bucket, and that bucket cannot be created by the
configuration that keeps its state in it. Create it out of band (by hand, or a
bootstrap module on local state) then `terraform init -migrate-state`.

Enable the APIs — Cloud Run, Cloud Scheduler, Secret Manager, Cloud Storage — **in
Terraform, not the console**. This is the repo's first GCP resource, and a resource
nobody can rebuild is worse than no resource.

### 4. Restructure the directories, and decide what survives of AWS
Check this before moving anything: **no frontend code references AWS at all** — no
API URL, no Amplify, no Cognito. And `content_crud` served the old admin CMS, which
the static rebuild deleted.

So `content_crud`, `faredgelabs-content-table`, `faredgelabs-site-config`,
`faredgelabs-content-md` and the Cognito pool are all orphaned. Note that
`cdk/lambda_stack.py` pulls those tables and that bucket in **by name**
(`from_table_name`, `from_bucket_name`) — they were created outside this app, so
destroying the stack will not remove them. They are live and still billing.

Only `contact_form` has a future. Settle the layout now (`terraform/`,
`functions/`, or similar) and whether the AWS files are deleted here or parked
until GCP is serving.

### 5. Write the stats job, test it locally
Cloud Run **job**, not a service and not a function: it runs to completion, so
there is no HTTP endpoint to secure. Nothing listening is nothing to protect.

Jibble credentials in Secret Manager, mounted into the job. Its service account
gets `secretmanager.secretAccessor` and `storage.objectAdmin` **scoped to the one
bucket**. Output is a single `stats.json`.

No database. Three scalars, no queries, no history — Firestore or anything like it
would be ceremony. It earns a place only if a trend line is ever wanted.

### 6. Publish the object and wire the frontend
`allUsers` → `roles/storage.objectViewer`, plus a CORS configuration for
`https://faredgelabs.com`. GCS serves it directly, so there is no API Gateway
equivalent to build — that piece existed in the AWS sketch only because the S3
bucket was fully private.

Two traps:

- A public object with **no explicit `Cache-Control` is served
  `public, max-age=3600`**. A fresh write can read stale for an hour. Set it
  deliberately.
- The anonymous URL is `storage.googleapis.com/<bucket>/<object>`.
  `storage.cloud.google.com` demands authentication even for public objects.

Then Cloud Scheduler on a daily cron, and the empty state decided in the
`hero.stats` entry above.

**A webhook will not replace the cron.** Jibble publishes none — the third-party
"Jibble webhook" integrations are polling in costume. And it would not help anyway:
a *trailing 30-day* figure changes when the clock moves, not when data does, so it
needs a tick regardless of what events exist.

### 7. Port the contact form
More than a function: a `/contact` page in both locales, the sender identity from
step 2, and the rate limit rebuilt — the DynamoDB table has no GCS analogue, so
either Firestore, or reconsider whether a rate limit is the right control for a
one-person company's enquiry form.

### 8. Tear down AWS
Only once GCP is serving. Includes the orphaned resources named in step 4, which
are the ones actually costing money.

---

## Decisions still open

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

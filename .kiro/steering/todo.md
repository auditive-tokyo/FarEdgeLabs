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

### `hero.stats` — the panel is built, the figures are not
**Done:** the template's 2×2 grid of four cards is now **one panel** in the same
footprint, a `<dl>` of label-and-figure lines plus a `<details>` disclosure
answering "what are these figures?". Rows are data, so the count is no longer a
layout question — a figure is a line added or removed. `Rating` is gone (see
below), leaving Projects / Clients / Uptime.

Dropped with the grid: the per-card `accented` flag in both locale files, and
`REVEAL_DELAY.statStep`. Neither has meaning for a single object.

**Decided:** fill it from the Jibble time tracker's API, refreshed daily by the
scheduled function in the migration below. Jibble treats *client* as a grouping
dimension alongside project and activity, so one Tracked Time Report call can
yield hours, distinct clients and distinct projects.

**The three figures are settled:** clients, projects and hours tracked, each over
the **trailing 30 days**. The window is said once as the panel's caption
(`stats.scope`) rather than prefixed onto all three labels, and the panel is a
`role="group"` named by that caption so the period is attached to the figures for
a screen reader rather than sitting loose beside them.

No client is named. The aggregate is the point, and naming engagements on a
marketing page is a separate decision with its own consent question.

A trailing window **falls** when a week is taken off. That is now a conscious
choice — cumulative totals were the alternative and only ever rise, but they say
nothing about now. Do not quietly switch to cumulative to make a number look
better.

Still open:

- **The note is currently false.** `stats.note.body` says the figures are
  compiled daily from Jibble's API. Nothing does that yet, so this **must not
  reach production before the function does** — it would be the only untrue sentence
  on the site. The wording itself is settled and names the vendor.
- **The empty state.** The numbers arrive by client-side `fetch`, so first paint
  has none of them, above the fold. Decide what shows then — skeleton, or the `—`
  that swaps in. The panel sits in that state on any day the function or the bucket
  fails, so it has to be designed rather than incidental.
- **The hours format.** `168`, `168h`, `168時間` — the script decides, and the two
  locales may want different suffixes. It is the only figure of the three that is
  not a bare count.

Crawlers will not see the figures. That is fine; nobody searches for them.

**`Rating` is not coming back as a figure.** There is nothing rated yet, and when
there is, the plan is to link out to the Google review rather than restate a score
in the panel — a number typed beside a star is worth less than the page it came
from. That makes it a link somewhere in the layout, not a line in this list.

### Services / Works / About are placeholders
Six live routes (three segments × two locales) render "under construction" and
carry `noindex`. They exist so the nav can be walked on a real device.

When one becomes real: write its `page.tsx`, drop `noindex`, drop its entry from
`PLACEHOLDER_SEGMENTS` in `src/views/under-construction/pages.ts`, and **add it to
`src/app/sitemap.ts`** — placeholders are deliberately absent from the sitemap.

### No contact route
`gc_run_functions/contact_form/app.py` requires **`name`, `email`, `message`** and
sends through Zoho SMTP with a DynamoDB rate limit — it is still the AWS handler,
kept for its logic, not its bindings. Nothing on the site calls it.
The hero's inline form was deleted rather than wired: two fields with no message
field produce an enquiry with no subject.

It is being ported to GCP rather than wired as-is — step 7 of the migration below.
It is deliberately *after* the stats function, which is the smaller thing to prove
the new platform with.

---

## The GCP migration, in order

**Decided:** the backend moves to GCP, provisioned with **Terraform**, as **two
Cloud Run functions**. The stats one goes first — it proves the whole chain
(Terraform, Secret Manager, Cloud Run, Scheduler, GCS, CORS) with a trivial
payload, no form UI, no email deliverability and no spam surface. The contact form
then lands on ground that is known to work.

Both are functions, not services and not jobs. A **function defaults to a
concurrency of 1**, which is the Lambda-shaped execution model this code was
written for, and it deploys from source with no Dockerfile. A Cloud Run *service*
defaults to 80 concurrent requests per instance — a difference that matters, see
step 7. A **job** would suit the stats side on paper (it runs to completion and
needs no URL) but it is a second deployment shape, a second Terraform pattern and a
second mental model for two lines of IAM saved. Not worth it at this size.

Ordered by dependency, not by size. Steps 1 and 2 can run in parallel; everything
after 2 is a chain.

**None of this touches GitHub Actions.** The site deploy and the stats refresh are
independent on purpose: the stats function writes an object, the page reads it, and
neither knows the other's schedule. `deploy.yml` builds and publishes the frontend
and does nothing else; the commented-out `deploy-infrastructure` workflow job went
with `cdk/`.

### 1. Probe the Jibble API — needs nothing from GCP
An organization owner creates the credential in Organization Settings → API
Credentials; **the secret is shown once**. Auth is OAuth2 client-credentials
against `https://identity.prod.jibble.io/connect/token`.

Call the Tracked Time Report from a laptop and **read the response before choosing
the three labels** or writing any of the function. Picking labels first is exactly
how the template's four cards got there.

### 2. Mail and identity → GCP project → billing
**Decided, and no Google Workspace is being bought:**

| what | where |
|------|-------|
| `@faredgelabs.com` mail, receiving and human sending | **iCloud+ custom email domain** |
| Google / GCP sign-in | the existing **`keigo.miyasaka@icloud.com`** account |
| organization resource | **none** — one director, one project |

iCloud+ allows up to five custom domains and three addresses per domain per person,
and the domain can both send and receive. Human correspondence goes out from the
same address that receives it.

**No organization** means projects sit under "No organization" in the resource
hierarchy. That is normal and fine here; it costs org-level policies and makes a
future ownership transfer awkward. Cloud Identity **Free** would give an org at no
charge if that changes — and it works precisely because iCloud hosts the domain's
mail, which Google requires for the admin address to receive notifications, since
Cloud Identity includes no inbox of its own.

Order is strict: the APIs in step 3 will not enable without billing attached. Then
re-point local auth and *verify* it rather than assuming — `gcloud auth list` and
`gcloud config list` should show the account as **active**, not merely present.

> [!warning] Do not let account recovery form a loop
> Google sign-in is an iCloud address, so **Google's recovery mail arrives at
> iCloud**. If Apple's recovery then points at a Google address, the loop closes:
> lose one and you cannot reach the other. GCP billing hangs off this account, so
> the loop would lock production out.
>
> Put a **non-email** factor on both sides — phone number, Apple recovery contact,
> Google backup codes.

### 3. Terraform bootstrap
State lives in a GCS bucket, and that bucket cannot be created by the
configuration that keeps its state in it. Create it out of band (by hand, or a
bootstrap module on local state) then `terraform init -migrate-state`.

Enable the APIs — Cloud Run, Cloud Scheduler, Secret Manager, Cloud Storage — **in
Terraform, not the console**. This is the repo's first GCP resource, and a resource
nobody can rebuild is worse than no resource. The IAM in step 5 is the clearest case:
a missing "authentication required" is invisible in a console but a visible diff in
a plan.

### 4. Restructure the directories — **done**
`cdk/` is deleted. `lambda_functions/` is now `gc_run_functions/`, and
`content_crud` went with it — it served the old admin CMS, which the static
rebuild removed. Only `contact_form` survives, and only for its logic: it is still
the AWS handler and has to be rewritten for Cloud Run in step 7.

`terraform/` does not exist yet; it arrives with step 3.

The directory name is correct as it stands: both pieces are Cloud Run **functions**,
so `gc_run_functions/` says what is in it. An earlier note here suggested renaming
it if a job moved in — no job is coming, so leave it alone.

> [!warning] This repo has never owned an AWS resource. Do not go looking.
> Verified against the account, not inferred: there is **no** `faredgelabs-*`
> anything — no CloudFormation stack, no DynamoDB table, no S3 bucket, no Lambda,
> no API Gateway, no Cognito pool. The CDK app defined `faredgelabs-lambda` and
> `faredgelabs-apigw` and was **never deployed**; `cdk/` was a copy of another
> project's IaC with the names swapped.
>
> What *does* exist in that account is `auditive-*` — tables, a bucket, two
> Lambdas, a REST API and a user pool belonging to **auditive.tokyo, a different
> site**. An earlier draft of this file claimed the `faredgelabs-*` resources were
> "live and still billing". That was wrong, and it is a dangerous kind of wrong:
> anyone acting on it would find the similarly-named `auditive-*` resources and
> delete another site's data. **Nothing in this account is ours to remove.**

### 5. Write the stats function, test it locally
A **Cloud Run function**, triggered by Cloud Scheduler. Two or three calls to
Jibble and one object written to GCS — seconds of work, so none of a job's
advantages (24-hour runtime, parallel tasks, built-in task retries) buys anything
here, and skipping it keeps one deployment shape for the whole backend.

Jibble credentials in Secret Manager, mounted in. Its service account gets
`secretmanager.secretAccessor` and `storage.objectAdmin` **scoped to the one
bucket**. Output is a single `stats.json`.

> [!warning] A function has a URL. Lock it down in Terraform, not by hand.
> 1. Deploy with authentication **required** (no unauthenticated invocations)
> 2. Grant `run.invoker` to the **Cloud Scheduler job's service account only**
> 3. Have Scheduler attach an **OIDC token** on the call
>
> This is the one thing a job would have given for free. Get it wrong and the
> endpoint is world-callable — and it will still look like it is working. The
> damage is strangers burning Jibble API calls, tripping its rate limit so the
> figures stop updating, and running up Cloud Run invocations. Written in
> Terraform, a missing setting is a visible diff rather than a silent hole.

What it aggregates, over the **trailing 30 days** and nothing else:

- distinct clients
- distinct projects
- hours tracked

Counts and a total — **no client or project names leave Jibble.** The panel shows
aggregates, so the function should not fetch identities it has no use for.

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

Then Cloud Scheduler on a daily cron, calling the private function with an OIDC
token as set out in step 5, and the empty state decided in the `hero.stats` entry
above.

**A webhook will not replace the cron.** Jibble publishes none — the third-party
"Jibble webhook" integrations are polling in costume. And it would not help anyway:
a *trailing 30-day* figure changes when the clock moves, not when data does, so it
needs a tick regardless of what events exist.

### 7. Port the contact form
A Cloud Run function plus a `/contact` page in both locales. The mail is a *private
notification to the operator*, not correspondence with the visitor — that framing
decides most of what follows.

#### Settled

- **The notification goes to the iCloud `@faredgelabs.com` address**, never to the
  personal `@icloud.com` one. Replying in iCloud Mail then goes out as the
  faredgelabs identity. Deliver it to a personal address and every reply carries a
  personal or unrelated From to a prospect.
- **No auto-reply to the visitor.** It doubles the send volume, and — more
  importantly — it turns a form that only ever mails *you* into one that mails
  addresses **strangers typed in**. That is where sender reputation starts to
  matter and where the form becomes a way to make you mail a third party.
- **Email must not be the only record.** Persist the submission (a GCS object, or
  Firestore) and *then* notify. SMTP tells you the submission server accepted it
  and nothing more; the way you find out mail has been failing is that enquiries
  stopped arriving. Persist first and a delivery failure costs a notification, not
  a customer.
- **Rate limit before the send, and it fails closed.** The old handler's DynamoDB
  limiter returned `True` on error — a broken table meant no limit at all.

#### Who sends it: the existing Zoho mailbox
**Settled by test, not by reading.** The live contact form on auditive.tokyo was
submitted and the mail arrived, so `info@auditive.tokyo` over `smtp.zoho.jp:465`
works today. The handler already speaks it, and GCP restricts neither 465 nor 587.

Its real attraction: **nothing is added to `faredgelabs.com`'s DNS.** The apex stays
purely iCloud — no DKIM, no send subdomain, no second sender to keep aligned.

> [!warning] This is a grandfathered plan. It cannot be re-created.
> Zoho's free plan is **closed to new signups**; accounts that already had it keep
> it. So the dependency is not "a Zoho free account" — it is *this* Zoho account.
> Close it, downgrade it, migrate it, or lose it, and there is no going back to the
> same terms.
>
> Combined with the coupling it introduces — FarEdge's enquiry path resting on
> another business's credential, and a **mailbox login** rather than a send-only
> key — treat this as the cheap option it is, not as infrastructure. Which is why
> the fallback below is worth keeping written down.

**Do not try to move `faredgelabs.com` into Zoho** to make the From match. A hosted
domain there wants Zoho's MX, and the apex MX belongs to iCloud. The notification
carries the auditive identity, and that is exactly why it must be delivered to the
iCloud `@faredgelabs.com` address — see "Settled" above.

#### Fallback if Zoho ever stops: Resend
Free tier is **100/day and 3,000/month**, and the quota counts **received as well as
sent**, each To/CC/BCC recipient separately.

The DNS objection people expect does not apply: Resend puts its **SPF and MX on a
`send.` subdomain** (its Return-Path), so verifying the apex leaves iCloud's apex MX
and SPF untouched. Only the DKIM TXT sits on the apex, under a different selector
from iCloud's, and that gives strict DKIM alignment for DMARC. **No SPF merging is
needed.** (If it ever were: one SPF TXT per name, and a 10-DNS-lookup ceiling above
which SPF permerrors and fails outright.)

Switching is roughly fifteen lines — `smtplib` out, one HTTPS call in. Keep the mail
send behind a single function so that stays true.

#### The existing handler is AWS-shaped — budget a rewrite, not a copy

Only the `smtplib` block transfers. Found in `gc_run_functions/contact_form/app.py`:

- `lambda_handler(event, context)` — needs an HTTP handler
- `event['requestContext']['identity']['sourceIp']` — on Cloud Run the client IP
  comes from `X-Forwarded-For`, and a client can prepend values to that header. Read
  it wrong and the rate limit is trivially bypassed
- `dynamodb.Table(...)` for the limiter — no AWS here any more
- `ALLOWED_ORIGINS` is `https://auditive-tokyo.github.io` and `http://localhost:5173`
  — the wrong site and Vite's port; this app is `https://faredgelabs.com` and 3000
- `_request_origin` is a **module-level global mutated per request**. Harmless while
  concurrency is 1, which is a function's default — but raising concurrency is a
  single flag, and then two simultaneous submissions can swap CORS headers. Fix it
  in the port; request state does not belong in module scope
- `print("Received event:", json.dumps(event))` writes the **whole body** to Cloud
  Logging — the sender's name, address and message. Narrow it
- No length caps and no address-shape check; presence is the only validation

### 8. ~~Tear down AWS~~ — nothing to tear down
Deleting `cdk/` was the whole teardown. See the warning in step 4: there was never
a deployed AWS resource belonging to this site, so there is no bill to stop and
nothing to destroy. The step is kept, struck through, so the question is not asked
a third time.

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

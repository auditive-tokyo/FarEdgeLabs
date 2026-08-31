# TODO — FarEdge Labs

**Loaded on request only.** Pull it in with `/todo`, or just ask for this file by
name; it stays out of context the rest of the time.

Not a backlog of everything imaginable — only things that are already *decided or
deliberately deferred*, so nothing here needs re-litigating from scratch. Where a
decision exists it is linked. Delete an entry when it lands; that is the whole
process.

Updated 2026-08-31. The site is live at https://faredgelabs.com (ja) and
`/en/` (en).

---

## Blocking a real launch

### Analytics is decided but not installed
ADR-0018 chose **Cloudflare Web Analytics** — cookieless, which is why there is no
consent banner. The snippet has never been added, so right now the site measures
nothing at all. Needs the site token from the Cloudflare dashboard, then a
`next/script` tag in `layout-shell.tsx`.

This is the one item where the code contradicts a written decision.

### ~~`hero.stats` — the panel is built, the figures are not~~ — 繋がった
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

~~Still open~~ — 3点すべて解決済み。決まった内容だけ残す:

- **注記はもう嘘ではない。** 関数が日次で動いていて `stats.json` が実在し、
  `hero-stats.tsx` がそれを読んでいる。`stats.note.body` が主張する日次集計は成立した。
- **空の状態は `—` を出す。** スケルトンではない。数字はクライアントの `fetch` で
  来るので初回描画には無く、関数やバケットが落ちた日も同じ見た目になる。
  **これは設計された状態**で、事故ではない — だからリトライも出さない
  （`fetchWorkStatistics` は失敗を全部 `null` に潰す）。
- **時間の接尾辞はロケールごと。** `時間` と `h`。数字とは**別の `span`** に置き、
  一段小さく、**italic を付けない**。単位が数字と同じ大きさだと数字と競い、
  CJK に italic をかけると字が剪断される。カウント2つには接尾辞が無い。

> [!warning] 数字が縮むのは仕様
> 直近30日の窓なので、休むと下がる。累計に切り替えれば下がらないが、累計は「いま」を
> 何も語らない。**見栄えのために黙って累計へ変えないこと。**

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

### ~~No contact route~~ — `/contact` は両ロケールにある
`src/views/contact.tsx` と `src/views/contact/form.tsx`、ルートは
`src/app/(ja)/contact/` と `src/app/(en)/en/contact/`。バックエンドは
`gc_run_functions/contact_form/main.py`（`terraform/contact.tf` がデプロイ）。

項目は **会社名（任意）→ お名前 → メールアドレス → 本文**。会社名が名前の上にあるのは
日本の法人向けフォームの並び（名刺と同じ順）で、既定ロケールが日本語だから。値があれば
**件名にも入る** — 受信箱の一覧で誰から来たのか分かるのがこの項目を集めている理由なので、
本文の中だけでは半分しか役に立たない。

**エンドポイントは検証済み**（`terraform output contact_form_uri` と一致）。URL の
ハッシュは Cloud Run のプロジェクト単位の値なので、`work-statistics` と同じものが付く。

ヒーローにあったインラインのフォームは繋がずに削除した。項目が2つで本文欄が無く、
件名の無い問い合わせしか作れなかったので。

`contact` は `nav` の5項目目で、専用の CTA は無い。ヘッダーの幅がどれだけ残っているかと、
**IP レートリミットを作ってから消した理由**はステップ7に。後者はここで最も再提案され
やすい判断。

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

**Reversed: this does run in GitHub Actions**, in its own workflow `infra.yml`. An
earlier version of this entry said it must not, on the grounds that a long-lived
service account key in repository secrets was too high a price. Two things changed
that. Manual `terraform apply` was rejected as the standing procedure, and Workload
Identity Federation removes the key entirely — CI gets a short-lived token bound to
this repository, so the objection no longer applies to anything.

What survives from the original reasoning is the *separation*: `deploy.yml` publishes
the site, `infra.yml` applies the backend, both gated on `paths`, neither aware of the
other. The stats function writes an object and the page reads it; no deploy waits on
the other.

`infra.yml` has **one trigger that matters** — a push to `production` — and it plans and
applies in the same job. Several things were tried and removed on the way there, all of
them machinery that ran but achieved nothing: a `pull_request` trigger (the release PR
raises no event), a step commenting the plan on that PR, a plan on `main` pushes to
substitute for it, an `exitcode` capture reading `tee`'s status instead of Terraform's,
and `always()` on the summary step, which only covered the case where the plan failed
and wrote its error to stderr where `tee` never saw it. The reasons are in comments at
the top of the workflow so the same options are not re-derived.

### 1. Probe the Jibble API — **done**
`probe.py` dumps every response and prints the computed figures. Credentials are
OAuth2 client-credentials against `https://identity.prod.jibble.io/connect/token`;
Jibble's dashboard calls the pair API Key ID and API Key Secret, and **the secret is
shown once**.

Reading the responses first was the point, and it earned itself twice:

- **`TrackedTimeReport` returns an unassigned bucket as an ordinary row** — `id: ""`,
  `subject.name: null`, neither omitted nor flagged. Counting rows reports two clients
  where there is one. Off by exactly one, and entirely plausible on the page.
- **Break time lands in that bucket**, because the break button selects no project.
  So the clocked total (296 h/month) is not worked time (174 h). Excluded — with the
  caveat that "no project" means "cannot tell", not "break": work logged without a
  project is counted as break by this rule and disappears. `probe.py` also asks
  `TimesheetsSummary` for Jibble's own worked-versus-break split; **that output has
  not been compared yet**, and if it agrees it should be preferred, because it does not
  depend on a habit.

`groupBy=Activity` is fetched and returns nothing but the unassigned bucket — no
activities are in use. Kept so the number exists the day they are.

### 2. Mail and identity → GCP project → billing — **done**
No Google Workspace was bought.

| what | where |
|------|-------|
| `@faredgelabs.com` mail, receiving and human sending | **iCloud+ custom email domain** |
| Google / GCP sign-in | **`hello@faredgelabs.com`** — 同一アカウントのアドレス変更。元は `keigo.miyasaka@icloud.com`（ステップ9） |
| project | `faredgelabs`, number `89292293815`, region `asia-northeast1` |
| billing | `017BDD-E996A4-F6B56B`, created **2026-08-05** |
| organization | `keigo-miyasaka-org` (`283976129708`) |

iCloud+ allows up to five custom domains and three addresses per domain per person,
and the domain can both send and receive. Human correspondence goes out from the same
address that receives it.

**An organization exists, and it was not planned.** An earlier version of this entry
recorded "organization resource: none" and reasoned about Cloud Identity Free as the
way to get one. Creating the billing account produced a **standalone organization**
automatically — Google does that when you sign up with a Google email address rather
than a domain — along with a `My First Project` that has since been deleted. Both
`faredgelabs` and `farm-scoring-system` were moved under it.

Its display name cannot be changed: an organization is bound to one domain at
creation, and a standalone one has no domain. Getting `faredgelabs.com` as the name
means Cloud Identity Free on the domain, which creates a *second* organization, a
migration, and a new `@faredgelabs.com` Google identity to sign in as. The advice
here used to be "decide that on whether you want a company-domain Google identity, not
on the name". **決めた — 立てる。** 名前ではなく復旧経路のため。ステップ9。

> [!warning] The free trial ends 2026-11-03
> 90 days from the billing account, and **the workloads are shut down when it ends**,
> not billed. 30 days of grace to reinstate by upgrading, then they are deleted.
> Upgrading early costs nothing here (this all sits inside the always-free tier) and
> removes the cliff; the remaining credit stays usable until it expires.

> [!warning] Do not let account recovery form a loop
> Google sign-in is `hello@faredgelabs.com`, which **looks like a company mailbox but
> is delivered by iCloud+**, so **Google's recovery mail arrives at iCloud** exactly as
> before. The rename made the hazard harder to see, not smaller.
> If Apple's recovery then points at a Google address, the loop closes:
> lose one and you cannot reach the other. GCP billing hangs off this account, so the
> loop would lock production out.
>
> Put a **non-email** factor on both sides — phone number, Apple recovery contact,
> Google backup codes.

### 3. Terraform bootstrap — **done**
`terraform/` holds 48 resources in five files: `versions.tf` (constraints, backend,
provider), `variables.tf`, `outputs.tf`, `wif.tf`, `main.tf`. Terraform concatenates
every `.tf` in a directory before evaluating any of it, so the split is for readers
only — `wif.tf` stays separate because it is the security boundary and changes for
different reasons than the function.

No shell bootstrap script was written, and none is needed: the pool, provider,
service accounts and IAM are all Terraform resources. Putting the `attribute_condition`
in a script would have moved the security-critical line outside the tool that
describes the infrastructure, where drift is invisible.

**State is in `gs://faredgelabs-tfstate`.** The one genuine circularity — a bucket
cannot hold its own state before it exists — was resolved by applying with local
state, then enabling the backend block and `terraform init -migrate-state`. Done
once; the backend block stays enabled. The bucket carries `prevent_destroy`.

Everything is enabled in Terraform rather than the console. A missing
"authentication required" is invisible in a console and a visible diff in a plan.

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

### 5. The stats function — **deployed and verified**
`work-statistics`, a Cloud Run function on `python312`, entry point
`refresh_work_statistics`, invoked daily at 06:00 Asia/Tokyo by Cloud Scheduler.
Confirmed end to end: the scheduler run wrote the object, and the function's URL
answers **403** to an unauthenticated caller.

Jibble credentials come from Secret Manager as environment variables. The runtime
service account may read those two secrets and write to the one public bucket — that
is the whole list.

`probe.py` imports from `main.py` rather than reimplementing, because the two places
a wrong-but-plausible number comes from — parsing ISO 8601 durations and excluding
the unassigned bucket — must have one implementation.

> [!important] Three things that were only found by deploying
> - **`date.today()` reads the container's clock, and Cloud Run runs in UTC.**
>   Scheduling for the JST morning would put the window a whole day behind what the
>   Jibble dashboard shows, permanently. `WINDOW_TIMEZONE` fixes it, and a JST laptop
>   hides the bug completely.
> - **`zoneinfo` ships no timezone data.** It reads the host database and raises
>   without one, so `tzdata` is a runtime dependency, not an optional extra.
> - **Cloud Build needs its own service account.** Google changed the default and the
>   first apply failed with "missing permission on the build service account". Fixed
>   with a dedicated builder, *not* by widening the default compute account — that one
>   carries Editor on the whole project.

> [!warning] A function has a URL. It is locked down in Terraform, not by hand.
> 1. No unauthenticated invocations
> 2. `roles/run.invoker` granted **on the underlying Cloud Run service** to the
>    scheduler's account only — `cloudfunctions.invoker` is how a gen2 function keeps
>    answering 403 to the caller you meant to allow
> 3. Scheduler attaches an **OIDC token** whose audience is the function's URL
>
> Get it wrong and the endpoint is world-callable while still looking like it works.
> The damage is strangers burning Jibble API calls, tripping its rate limit so the
> figures stop updating, and running up invocations.

What it aggregates, over the **trailing 30 days** and nothing else:

- distinct clients
- distinct projects
- hours tracked

Counts and a total — **no client or project names leave Jibble.** The panel shows
aggregates, so the function should not fetch identities it has no use for.

No database. Three scalars, no queries, no history — Firestore or anything like it
would be ceremony. It earns a place only if a trend line is ever wanted.

### 6. Publish the object — **done**. Wire the frontend — **done**
Live and checked with `curl`:

```
https://storage.googleapis.com/faredgelabs-public/stats.json
  200  cache-control: public, max-age=1800  content-type: application/json
  Origin: https://faredgelabs.com  → access-control-allow-origin returned
  Origin: https://example.com      → no CORS headers
```

GCS serves it directly and answers preflights itself, so there is no gateway to
build — that piece only existed in the AWS sketch because the S3 bucket was fully
private.

Two traps, both handled, both worth keeping written down:

- A public object with **no explicit `Cache-Control` is served
  `public, max-age=3600`**, so a fresh write can read stale for an hour. Set
  deliberately to 1800.
- The anonymous URL is `storage.googleapis.com/<bucket>/<object>`.
  `storage.cloud.google.com` demands authentication even for public objects.

**フロントエンドも繋がった。** `src/lib/work-statistics.ts` がこのオブジェクトを取り、
`hero-stats.tsx` が描く。空の状態は `—`（上の `hero.stats` の項）。Scheduler は
06:00 JST の日次で、OIDC トークン付きで私物の関数を叩く（ステップ5）。

`statsUrl` は環境変数ではなく `src/lib/site.ts` にリテラルで置いてある。バケットは
1つで Terraform が名前を決めているので、設定可能にすると**忘れる余地が増えるだけ**で、
しかも忘れたときの症状が「パネルが永久に埋まらない」という静かなもの。代償はバケットを
改名したらここも直すこと。`NEXT_PUBLIC_SITE_URL` が localhost を既定にして「忘れたら
騒がしい」側に倒してあるのと逆の判断で、逆にしてある理由がこれ。

**A webhook will not replace the cron.** Jibble publishes none — the third-party
"Jibble webhook" integrations are polling in costume. And it would not help anyway:
a *trailing 30-day* figure changes when the clock moves, not when data does, so it
needs a tick regardless of what events exist.

### 7. Port the contact form — **done**、残り1点
Cloud Run function と両ロケールの `/contact`。メールは**訪問者との往復ではなく運営者へ
の私信**で、その前提が以下のほとんどを決めている。

**本番で往復まで確認済み。** エンドポイント、CORS、Turnstile、入力検証、SMTP 送信。

このアカウントは Zoho の **JP データセンター**にある。`smtp.zoho.jp` の 465 と 587 が
通り、`.com` / `.eu` / `.in` は 535 を返す。ホストを動かす理由はない。

以下は解決済みの記録として残す。特に**3層に落とした理由**と**`contact` を `nav` に
入れない理由**は、どちらも「良くしよう」として戻されやすい。

#### フロントエンド側で決めたこと

- **`contact` は `nav` の5項目目。** 一度ヘッダーの CTA ピルとして特別扱いにして、
  戻した。行き先の1つであって別種のものではないので、専用のボタンを与えると
  「これは違う何かだ」と言ってしまう。CTA スロットは元どおり言語切替。
  > **ja のピルは 672px で、1024px のときロゴとの余白が 8.8px。** 中央のピルは
  > ビューポートに対して中央寄せかつ中身に合わせて伸びるので、ラベル1つで両側が同時に
  > 詰まる。実フォントのメトリクスから測った値で（4項目なら 508px）、収まってはいるが
  > **ヘッダーが一番詰まる状態**。1024px より広ければ増分の半分ずつ両側に付く。
  > **6項目目やラベルの延長は目分量ではなく測り直すこと。** en は "Contact" で
  > 624.9px / 余白 +32.3px。`_measure.py` 相当の計算は
  > `src/views/home/site-header.tsx` の注記にある数字で足りる。
- **Turnstile は明示レンダリング。** `class="cf-turnstile"` + `data-callback` の暗黙
  レンダリングは、トークンの受け取りが**グローバル関数名**になる。`?render=explicit` と
  `turnstile.render()` ならコールバックがクロージャで済む。`src/hooks/use-turnstile.ts`。
- **トークンは使い捨てなので、送信が失敗したら `reset()`。** 忘れると
  「1通目は届くが2通目から必ず `timeout-or-duplicate` で落ちる」という、手で1回試す
  だけでは見つからない壊れ方をする。
- **`aria-invalid:` は Tailwind の既定バリアントに無い**（`checked` や `disabled` は
  ある）。`aria-[invalid=true]:` と書く。そのまま書くと**静かに効かない**。
- **サイトキーは公開値。** `deploy.yml` にリテラルで置く。repository secret に入れても
  隠れるのは自分に対してだけ。既定値は Cloudflare のテスト用キーで、本番で設定を忘れて
  も**本番の secret がダミートークンを拒否するので抜け道にならない**。

#### Settled

- **The notification goes to the iCloud `@faredgelabs.com` address**, never to the
  personal `@icloud.com` one. Replying in iCloud Mail then goes out as the
  faredgelabs identity. Deliver it to a personal address and every reply carries a
  personal or unrelated From to a prospect.
- **No auto-reply to the visitor.** It doubles the send volume, and — more
  importantly — it turns a form that only ever mails *you* into one that mails
  addresses **strangers typed in**. That is where sender reputation starts to
  matter and where the form becomes a way to make you mail a third party.
- **An enquiry must survive a failed send** — but only the failed ones are worth
  keeping. An earlier draft here said to persist every submission before notifying;
  that was narrowed, correctly, because a stored copy of a mail that arrived is a
  second copy of something you already have, with a TTL to manage. **Log the content
  to Cloud Logging on send failure only.** No Firestore, no TTL, and no personal data
  in logs on the normal path — which also fixes the old handler's
  `print(json.dumps(event))`, currently dumping every name, address and message.

#### Protection: three layers, cheapest and most effective first

> [!important] There were four. The IP rate limiter was built, then deleted — read this
> before rebuilding it
> It was written: Firestore, TTL policy, sliding window, three in five minutes. It came
> out again because putting numbers on it broke the argument for it.
>
> - **Three in five minutes still passes 864 a day.** That does not protect Zoho's
>   daily cap, which is the asset this section names as the thing that matters
> - **Distribute the source and per-IP misses entirely** — and distribution is the
>   natural shape of a flood, not an exotic one
> - What remained was "a naive loop that already passed Turnstile", plus double
>   submits. The first is bot-shaped, so it is layer 1's job; the second belongs in the
>   form's own disabled-button state, not the backend
>
> Against that, the standing cost was **`roles/datastore.user` on the whole project**
> (Firestore has no per-collection IAM, so the narrowest predefined role still reaches
> every document in every collection), a **fail-closed path that takes the form down
> when Firestore is unwell**, `google-cloud-firestore` in the cold start, and three
> Terraform resources. A permanent widening bought against a low-probability event.
>
> **The accepted risk:** if Turnstile is beaten, Zoho's daily cap drains and real
> enquiries then fail — the failure this section opens by naming. It is *not* silent
> though: layer 3 logs every send failure, so it is visible in Cloud Logging. Nobody
> is watching those logs, which is a different problem with a cheaper fix. **A
> log-based alert on the send-failure line is the next thing to add, ahead of
> rebuilding the limiter.**
>
> Rebuilding is cheap if it ever earns its place. Firestore's location is fixed *after*
> creation; creating it later in `asia-northeast1` costs nothing extra. The code is in
> git history.
>
> This also removed a task: **measuring `X-Forwarded-For` is no longer needed.** The
> only consumer of a trustworthy client IP was the limiter. `remoteip` on `siteverify`
> is optional, and passing a *wrong* IP is worse than omitting it, so it is omitted.
> The trap below is kept because it is what makes rebuilding safe, not because
> anything currently depends on it.

The function has to accept unauthenticated requests from strangers — a static page has
no credential to present, so `allow_unauthenticated` is unavoidable and every control
lives in what the function does.

> [!warning] CORS will not protect this, and it is the natural mistake to make here
> A `POST` from `curl` ignores CORS entirely; it is enforced by browsers, on browsers.
> The bucket's CORS rule protects nothing either — see step 6.

**What actually breaks when it is abused** is not the invocation bill. It is **Zoho's
daily sending cap**: a flood exhausts it, and then *real* enquiries fail silently and
the way you notice is that nobody is contacting you. So the goal is protecting the
channel, not blocking requests.

1. **Cloudflare Turnstile.** Managed mode is free for unlimited use and works on any
   site regardless of whether it is proxied through Cloudflare — which matters, since
   DNS here must stay "DNS only". Bots are the overwhelming majority of contact-form
   abuse, so this is where volume actually stops. Tokens last five minutes and are
   verified server-side against `siteverify`.
2. **Cap the input.** Lengths on name, email and message, and a shape check on the
   address. The current handler has **no caps at all** — a 10 MB body would be accepted
   and mailed.
3. **Log the content on send failure only.** No personal data in logs on the normal
   path — see "Settled" above. This is also the only place a drained Zoho cap becomes
   visible, which is why the alert mentioned above hangs off it.

~~**Rate limit per IP.**~~ **Removed — see the note above.** The traps are kept below
because they are what a rebuild would need, and every one of them is a real CVE class:
   - **IPv6 must be bucketed by prefix, not address.** An ISP hands a household at
     least a **/64 — 2^64 addresses** (RIPE suggests /56 for home users, /48 for
     businesses). Keyed on the full /128, a client rotates addresses for free and the
     limiter is decoration. Bucket on **/64**.
   - **Do not mask IPv4 the same way.** IPv4-mapped IPv6 (`::ffff:a.b.c.d`) has 80
     leading zero bits, so a /56 mask collapses **every IPv4 client into one bucket** —
     one abuser then returns 429 to everyone else. Separate masks, and normalise the
     mapped form first.
   - **Normalise the text before keying.** One address has several valid
     representations; comparing strings lets the same client look like many.
   - And **fail closed.** The old handler returned `True` when the table errored, so a
     broken limiter meant no limit.
   - **Measure what Cloud Run puts in `X-Forwarded-For`** rather than reasoning about
     it: send a request with a forged header and log what arrives. The header is
     append-only and the left end is attacker-controlled; leftmost parsing is its own
     vulnerability class.
~~**Firestore for the counter, with its built-in TTL policy.**~~ Also removed. If it
returns, the caveat that shaped it still holds: **TTL deletion happens within 24 hours
of expiry, not at expiry.** A "3 in 5 minutes" window cannot rely on the document being
gone — compare timestamps in code and let TTL do housekeeping only.

**Not doing: Cloud Armor.** A real WAF with edge rate limiting, but it needs a global
load balancer in front of Cloud Run, which bills hourly whether or not anyone visits.
Disproportionate for one form.

**What bounds the bill instead is `max_instance_count = 3`** on the function. It stops
nothing, but it converts "the invocation bill grows without limit" into "requests get
429 or 503" — free, and for a site this size the only cost control that matters. Raise
it knowing that is what you are raising.

Order matters, and it is why the limiter lost: Turnstile removes the traffic the limiter
was meant to catch, and the limiter was the only stateful piece. Building the stateful
thing first and skipping the free effective one is exactly the shape of the handler that
was replaced — a DynamoDB rate limiter, no CAPTCHA and no input caps.

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

#### ~~The existing handler is AWS-shaped — budget a rewrite, not a copy~~ — done

`app.py` is gone; `gc_run_functions/contact_form/main.py` replaced it, and
`terraform/contact.tf` deploys it. The rewrite was the right budget — two of the
findings were bugs that only appear on Cloud Run, and the reasoning for each now lives
next to the code that fixes it rather than here:

- **`_request_origin` was a module-level global mutated per request.** Correct under
  Lambda's one-request-per-container model; on Cloud Run two concurrent submissions
  swap each other's `Access-Control-Allow-Origin`
- **The subject line interpolated the raw name**, so `\r\n` in it injects SMTP headers
  — `Bcc:` turns the form into someone else's sending relay
- `lambda_handler(event, context)` → an HTTP handler that answers `OPTIONS` itself,
  since there is no API Gateway to do it
- `print("Received event:", json.dumps(event))` was writing every name, address and
  message to Cloud Logging on the normal path
- No length caps, no address-shape check, and `smtplib` with no timeout
- `ALLOWED_ORIGINS` pointed at `auditive-tokyo.github.io` and Vite's 5173

フロントエンドも済んだ。このリポジトリで**最初の `<form>`、最初の `<label>`、最初の
外部スクリプト**なので、形を決めたのはここ — 前例が無かった。`src/views/contact/form.tsx`
と `src/hooks/use-turnstile.ts`。

### 8. ~~Tear down AWS~~ — nothing to tear down
Deleting `cdk/` was the whole teardown. See the warning in step 4: there was never
a deployed AWS resource belonging to this site, so there is no bill to stop and
nothing to destroy. The step is kept, struck through, so the question is not asked
a third time.

### 9. Cloud Identity を立てて org を移す — 決定済み、未着手
`faredgelabs.com` で **Cloud Identity Free** を立て、そこに現れる新しい org へプロジェクトを
移す。2026-08-31 決定。急ぎではない。

**org は「作る」ものではない。** `gcloud organizations` には `create` も `delete` も無い
（`resource-manager folders` には両方ある）。org は Cloud Identity アカウントの**副産物として
現れる**もので、表示名もそのプライマリドメインから derive される。いまの
`keigo-miyasaka-org` が意図せず生まれたのと同じ仕組み。

**動機は表示名ではない。** 同日に確認した2つの事実が同じ方向を指している:

- org の `describe` が `owner: {}` を返す（`directoryCustomerId` が空）
- サインインアカウントの userinfo に **`hd` クレームが無い**

つまり `hello@faredgelabs.com` は Workspace 管理下ではなく、独自アドレスで作った
**通常の Google アカウント**。org と2プロジェクトと請求アカウントの管理権限が、
**上位に管理者のいない個人アカウント1つ**に集中している。失ったとき復旧を頼める相手が
いない。CI 側はサービスアカウントキーを持たない WIF なのに、人間側だけ復旧経路が無い。
表示名が会社名になるのは副産物。

**サインインアドレスはもう iCloud のものではない。** ステップ2の表にあった
`keigo.miyasaka@icloud.com` と `hello@faredgelabs.com` は**同一アカウント**
（`sub` は `100709608036505294284`）で、アドレスだけが変わっている。gcloud はログイン時の
ラベルを `credentials.db` の主キーとしてキャッシュするため、`gcloud auth list` が古い方を
表示し続けていた。**設定ファイルの `account =` を書き換えて直そうとしないこと** — あれは
実体ではなく鍵で、対応する行が無ければ全コマンドが `does not have any valid credentials`
で落ちる。`gcloud auth login hello@faredgelabs.com` で踏み直し、古い行は revoke 済み。

やるときの順序と罠:

- **Cloud Identity Free は ID だけで、メールボックスを作らない。** だから
  `@faredgelabs.com` のメールは iCloud+ のまま動く。**MX を触らないこと** — 触ると
  問い合わせが静かに届かなくなる（「DNS を Terraform に入れるか」の節が名指ししている
  のと同じ壊れ方）
- **ドメイン検証の TXT は Cloudflare に足す。** ゾーンはコンソール管理で、半分が iCloud の
  メール基盤。**追加であって置換ではない**
- **一番危ないのは競合アカウントの処理。** Cloud Identity がドメインを取ると、そのドメインの
  アドレスを使っている既存の個人アカウント（= `hello@faredgelabs.com`）は「未管理アカウント」
  になり、組織への移管か強制リネームを選ばされる。そのアカウントが org と2プロジェクトと
  請求アカウントを持っている。**ドメイン検証のついでに起きる作業にしてはいけない。**
  単独の手順として、先に何が起きるかを確かめてから踏む
- **新しい org は別の org。** プロジェクトの移動には**両方の org** に対する権限が要る。
  プロジェクト ID は `faredgelabs` のままなので、Terraform state、関数の URL、WIF は
  影響を受けない — `wif.tf` が固定しているのは **GitHub 側の数値 id** で、GCP の org とは
  無関係
- **請求アカウントは旧 org に属している。** プロジェクトとは別に移す必要がある
- **旧 org は消せない。放置でよい。** `delete` が無いのは、org の寿命が裏の Cloud Identity
  アカウントに従属しているから。`keigo-miyasaka-org` は standalone で裏にアカウントが無い
  （`owner: {}`）ため、消すにはサポート依頼になるはず（未検証）。空の org に費用は付かず、
  コンソールのピッカーに1行残るだけなので、**移行が落ち着くまではむしろ残しておく**

> [!important] `farm-scoring-system` を一緒に連れて行くかは未決
> あの org には FarEdge とは別の事業のプロジェクトも入っている。`faredgelabs.com` の
> Cloud Identity 配下に置くと、**別事業のプロジェクトが FarEdge の組織ポリシーと管理者の
> 下に入る**。移すか、旧 org に残すか、別に立てるかを移行前に決めること。決めずに始めると
> 「ついでに移した」で決まってしまう。

> [!warning] 無料試用の終了 2026-11-03 とぶつけないこと
> ステップ2の警告のとおり、終了時点でワークロードは課金ではなく**停止**される。移行と
> その期限が重なると、切り分けのできない障害になる。**先に試用をアップグレードして崖を
> 無くしてから移すこと** — この構成は always-free の範囲なので、アップグレード自体に
> 費用は付かない。


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

- ~~**`infra.yml` has never run.**~~ **走った。WIF の鎖は実証済み** — production への
  push で7回、うち5回成功。認証・`attribute_condition`・`tf-deployer` の権限は、もう
  疑う対象ではない。落ちた2回はどちらも設定の中身の問題で、経路の問題ではなかった。
  > **ローカルで `terraform plan` を強制終了すると CI が止まる。** GCS に
  > `default.tflock` が残り、次の plan が 412 で落ちる。`plan` のロックなので state を
  > 書いている途中ではなく、外して壊れるものは無い。ただし **GCS バックエンドの
  > `force-unlock` は UUID ではなくオブジェクトの `generation` を要求する** —
  > ロック情報が表示する `ID:` がそれで、`gcloud storage objects describe …
  > --format='value(generation)'` で取れる。tflock の中身に載っている UUID を渡すと
  > `Lock ID should be numerical value` で拒否される。
  >
  > **これが Apply で `Failed to load "tfplan"` として現れていた理由は
  > `infra.yml` の `defaults.run.shell` の注記にある。** 症状と原因が別のステップに
  > 出るので、片方だけ直すともう片方が次の事故で同じ形で戻ってくる。
- **No budget alert.** During the trial the $300 absorbs a mistake silently, which is
  the opposite of what is wanted from an unauthenticated function being hammered.
  Scope it to the `faredgelabs` project (number `89292293815`) and set
  `--credit-types-treatment=exclude-all-credits`, or it measures spend *after* the
  credit and never fires. Left out of Terraform on purpose: `google_billing_budget`
  needs IAM on the billing account, and one budget is not worth widening the CI
  service account beyond the project.
- ~~**No AAAA records.**~~ **入れた（2026-08-19）。** apex に `2606:50c0:800{0,1,2,3}::153`
  の4本、DNS only。A の4本と併存させたデュアルスタックで、4本それぞれに直接繋いで
  HTTP 200 と TLS 検証通過を確認済み。
  > **壊れ方は「繋がらない」ではなかった。** `www` は `auditive-tokyo.github.io` への
  > CNAME なので GitHub 側の AAAA を最初から引き継いでいて、IPv6 で**接続も TLS も
  > 成功していた**。その上で 301 を返す先が `public/CNAME` の指す apex で、そこに
  > AAAA が無かった。つまり IPv6-only のクライアントは**接続に成功してから行き止まりに
  > 送られていた**。片側だけ見て「www は動くから IPv6 は大丈夫」と判断すると見逃す。
  >
  > 検証で `curl -6` は当てにならない。macOS の resolver は AAAA の否定キャッシュを
  > 持っている間 `::ffff:a.b.c.d` を返し、**IPv4 で繋がったものを IPv6 の成功に見せる**。
  > `--resolve name:443:[addr]` でアドレスを直に指定するのが確実。

### DNS を Terraform に入れるかは、まだ開いている
ゾーンは Cloudflare（`craig`/`penny.ns.cloudflare.com`）にあり、**コンソール管理のまま**。
「コンソールではなく Terraform」という他の全部と逆になっているので、理由を残す。

**ゾーンの半分がメール基盤だから。** MX ×2、SPF、DKIM、`apple-domain` の検証 TXT が
iCloud のもので、問い合わせの通知はそこへ届く。plan を間違えると**問い合わせが静かに
届かなくなる** — ステップ7がレートリミッタの節で名指ししている、まさにその壊れ方。

見返りも小さい。IaC の利点は drift が `plan` に出ることだが、**このゾーンは drift しない**。
apex の A/AAAA は GitHub の固定値、メール系は iCloud の固定値。

やるなら形は決まっている: `cloudflare_record` はレコード単位なので、**このリポジトリが
所有するもの（apex の A/AAAA、`www` の CNAME）だけを入れて、メール系4件は触らない**。
ゾーンファイル方式と違い、知らないレコードを消さない。トークンはアカウント全体ではなく
**このゾーンの `Zone:DNS:Edit` だけ**に絞ること。

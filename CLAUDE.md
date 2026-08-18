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
  validates the public ones and is the only place that reads `process.env` in `src/`
  (`next.config.ts` reads `NEXT_PUBLIC_BASE_PATH` directly). If a value must stay
  private, it belongs in the backend, never here — Turnstile's *site* key is in
  `deploy.yml` as a literal, its *secret* key is in Secret Manager

Metadata routes (`robots.ts`, `sitemap.ts`) need `export const dynamic = "force-static"`.

The backend is separate: handlers in `gc_run_functions/`, infrastructure in
`terraform/`. It is **GCP** — Cloud Run functions, deployed by `infra.yml`. See
"The backend" below. The AWS CDK app that used to sit beside it was never deployed
and has been deleted.

The browser talks to the backend directly — there is nothing between the two — and the
two directions work differently:

- **Reading the figures does not touch a function at all.** `work-statistics` writes a
  public object to Cloud Storage and the page `fetch`es that. GCS answers the preflight
  itself
- **Sending an enquiry is a `POST` to a function that anyone may call.** It has to be:
  a static page holds no credential to present. `contact-form` is therefore the one
  unauthenticated endpoint in the project, and its defences are all inside its own
  handler. See "The backend"

Nothing in this repo has ever had an AWS resource of its own — see the warning in
`.kiro/steering/todo.md` before touching an AWS account from here.

## Two locales, two root layouts

`/` is Japanese, `/en/` is English. The default locale sits at the root because a
static host cannot redirect.

```
src/app/
├─ layout-shell.tsx      the shared <html>/<body>/providers
├─ fonts.ts              next/font, declared once for both layouts
├─ (ja)/layout.tsx       root layout, locale="ja"  → /
├─ (ja)/page.tsx         + not-found / loading / error
├─ (ja)/contact/         → /contact/          a real page, in the nav
├─ (ja)/{services,works,about}/               placeholders, noindex
├─ (en)/layout.tsx       root layout, locale="en"
├─ (en)/en/page.tsx      → /en/
├─ (en)/en/contact/      → /en/contact/
└─ (en)/en/{services,works,about}/
```

`not-found` / `loading` / `error` exist only under `(ja)`. A new segment needs a
`page.tsx` in **both** groups, the same `path` const in each, and an entry in
`src/app/sitemap.ts` unless it is a `noindex` placeholder.

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

## コメントは日本語で書く

これから書くコメントと docstring は日本語。既存の英語は、**そのコードを触るついでに**直す。

**翻訳だけのコミットは作らない。** 差分がレビューできない大きさになり、`git blame` が全行そのコミットに付け替わって、そのコメントが書かれた理由を辿れなくなる。急いで揃える必要はない。英語のコメントが残っていること自体は不具合ではない。

言語が変わってもコメントの基準は変わらない。**何をしているか**はコードが言うので書かない。書くのは**なぜそうなっているか**と、**素直に書くと何が壊れるか**。`gc_run_functions/work_statics/main.py` の `WINDOW_TIMEZONE` と `duration_to_hours` の注記が見本で、どちらも「もっともらしいが間違っている数字」がどこから出てくるかを説明している。訳すときにそこを削ってはいけない。日本語にした結果ただの要約になるなら、英語のまま残したほうがまだよい。

英語のまま残すもの:

- 識別子、型名、外部 API のフィールド名（`belongsToDate`、`trackedTime`）。訳すと grep で追えなくなる
- `# noqa: PLC0415` や `# pragma: no cover` のような、機械が読むディレクティブ
- 引用した外部のエラー文字列。検索して当てるために書いてある

例外メッセージとログ出力は日本語でよい。Cloud Logging は日本語で検索できる。ただし外部から受け取った文字列を混ぜる行は、その部分だけ原文のまま残す。

この文書と `obsidian/` はまだ英語。移すかどうかはコードとは別の判断で、いまは触らない。

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
  literals. Keep them in step with the tokens.

Only the tab icon can follow the scheme, and only because `<link rel="icon">`
accepts `media` — the script emits `favicon-{16,32}x{16,32}-{light,dark}.png` and
`icons` in `generate-page-metadata.ts` pairs each with a `prefers-color-scheme`
query. Everything else is referenced by bare URL and is baked **light**: the PWA
tiles, the OG card, and `favicon.ico`. The `.ico` is deliberately the one icon
link without `media`, since it exists for clients that ignore those links and
request `/favicon.ico` directly. A single-palette `.ico` is a format limit, not an
oversight — do not file it as a bug.

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

> [!important] `hero.stats` の数字は実測値。作らないこと
> テンプレートの 2×2 グリッド（Projects / Clients / Uptime / Rating）は捨てた。あれは
> 実績のある会社を描いていて、この会社には数える実績が無かった。いまは `<dl>` 1枚に
> **クライアント数・プロジェクト数・稼働時間**の3行で、値は Jibble の打刻から
> `work-statistics` 関数が日次で集計している。行はデータなので、増減はレイアウトの
> 問題ではない。
>
> **`—` が出ているのは壊れているのではない。** 初回描画と、関数やバケットが落ちた日の
> 設計された状態。`fetchWorkStatistics` は失敗を全部 `null` に潰す（見せるものが何も
> 無いので、対処が1つしかない）。リトライもスケルトンも足さないこと。
>
> **数字は休むと下がる。** 直近30日の窓なので当然で、累計に変えれば下がらないが累計は
> 「いま」を何も語らない。見栄えのために黙って累計へ変えないこと。
>
> `Rating` は数字としては戻さない。評価が付いたら Google のレビューへ**リンクする**
> 方針で、星の隣に打ち直した数字はリンク元より価値が低い。つまりレイアウトのどこかの
> リンクであって、この一覧の行ではない。

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

## フォームと外部スクリプト

どちらも**前例が1つしか無い**ので、増やすときはそれに倣う。

- **`<form>` と `<label>` は `src/views/contact/form.tsx` だけ。** 入力の
  プリミティブは `src/components/` に無く、装飾は既存トークンの組み合わせ
  （`bg-background` + `border-hairline` + `focus-visible:outline-accent`）。
  ラベルは `htmlFor` と `id` を結ぶのではなく**入力要素を `<label>` で包む** —
  `useId()` が要らず、`id` の付け忘れという壊れ方が存在しなくなる
- **`noValidate` を付けてブラウザ内蔵の検証を切る。** 切らないと日本語のページに
  `Please fill out this field.` が混ざる。文言はロケールファイルにある
- **`aria-invalid:` は Tailwind の既定バリアントに無い**（`checked` / `disabled` /
  `expanded` などはある）。`aria-[invalid=true]:` と書く。**そのまま書くと静かに
  効かない**
- **入力の上限は `src/lib/contact.ts` の `CONTACT_LIMITS` が単一の出どころ**で、
  `gc_run_functions/contact_form/main.py` の `MAX_*_LENGTH` と同じ数字。片方だけ
  動かすと「ブラウザは通すのにサーバが 400 を返す」という一番わかりにくい形で壊れる
- **必須と任意は別の配列で持つ。** `REQUIRED_CONTACT_FIELDS`（`name` / `email` /
  `message`）に無い項目は空でも通す。任意なのは「無くてもよい」であって「何を入れても
  よい」ではないので、**長さは任意項目でも見る**。バックエンドも
  `REQUIRED_LIMITS` / `OPTIONAL_LIMITS` に分けてあり、任意項目は値があるときだけ
  返る辞書に入る（呼び出し側が `fields.get("company")` 1つで判断できる）
- **二重送信を止めるのはフロントエンドの仕事。** バックエンドのレートリミットを落とした
  ときの前提がこれなので、送信中に `disabled` にするのは飾りではない
- **ヘッダーの nav は5項目でほぼ限界。** 中央のピルはビューポートに対して中央寄せかつ
  中身に合わせて伸びるので、ラベル1つで両側が同時に詰まる。`ja` は 672px で、
  `GRID_MIN_WIDTH`（1024px）のときロゴとの余白が **8.8px**。6項目目やラベルの延長は
  目分量ではなく測ること — 数字と測り方は `site-header.tsx` の注記にある
- **外部スクリプトは `src/hooks/use-turnstile.ts` の1本だけ。** `next/script` は
  使っていない（このリポジトリに前例が無く、必要なのは「1回だけ読む」だけなので
  モジュールスコープの Promise 1つで足りる）。`next/script` を入れるならそれが最初の
  使用になるので、そのつもりで入れること
- **Turnstile のトークンは使い捨て。** 送信のあと必ず `reset()`。忘れると
  「1通目は届くが2通目から必ず落ちる」という、手で1回試すだけでは見つからない壊れ方を
  する

`<script>` がもう1か所あるが別物: `layout-shell.tsx` の JSON-LD で、これは外部から
読まないインライン。

## Deploying

`main` → an auto-created release PR → merge to `production` → build → the `out/`
directory is pushed to `gh-pages`.

- `public/CNAME` and `public/.nojekyll` must survive every deploy. Jekyll skips
  `_next/`, so without `.nojekyll` the site loads no JS or CSS
- `NEXT_PUBLIC_SITE_URL` is set in the workflow, not committed — it drives
  canonical URLs, OG tags, `robots.txt`, `sitemap.xml` and JSON-LD
- `deploy.yml` builds and publishes the frontend and does nothing else. **Do not
  add a backend step to it.** The backend has its own workflow, `infra.yml`, and the
  separation is the point: a site deploy must not depend on a function existing, and
  a backend change must not rebuild the site. Both are gated on `paths`
- Its `env:` block holds four public values. Two are worth knowing about:
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is a literal on purpose — the browser reads it, so a
  repository secret would hide it from you and from nobody else — and
  `NEXT_PUBLIC_CONTACT_ENDPOINT` must agree with `terraform output contact_form_uri`.
  There is nothing that checks that they agree
- `npm run brand` is not part of the build. Run it locally and commit the PNGs
- Do not delete `.next` while `npm run dev` is running — Turbopack's cache is in
  there and the server does not recover

## The backend

**GCP, in `terraform/`, applied by `infra.yml`.** Project `faredgelabs`, region
`asia-northeast1`, under the `keigo-miyasaka-org` organisation. An earlier note here
said the backend was provisioned out of band and that GitHub Actions must not touch
it; that was reversed — manual applies were rejected, and Workload Identity
Federation removes the reason to avoid CI.

- **Terraform state is in `gs://faredgelabs-tfstate`.** Never commit a `.tfstate`.
  A run that cannot see the state believes nothing exists and tries to create all
  48 resources again
- **CI authenticates with WIF — there are no service account keys.** All of the
  security is `attribute_condition` in `wif.tf`, which pins the GitHub owner and
  repository by *numeric id*. Without it, any public repository on GitHub can mint a
  token for this project. Hiding the provider name in a repository secret would do
  nothing; it is an identifier, not a credential
- **Secret *values* never go through Terraform.** The containers are managed; the
  payloads are added with `gcloud secrets versions add` so they stay out of state.
  Use `printf`, not `echo` — a trailing newline authenticates nowhere and looks
  perfectly present
- **Flow:** one path in. A human merges the release PR, `production` gets the push,
  and `infra.yml` plans and then applies in the same job. **The review is the pull
  request diff, not the plan** — the same shape as putting `sam deploy` behind a
  branch. The edge of that trade: Terraform replaces resources for changes that look
  harmless in a diff (a bucket rename, a region, an `account_id`), and only a plan says
  `must be replaced`. When a change might do that, dispatch the workflow from `main`
  first, where Apply's condition is false, or plan locally
- There is **no `pull_request` trigger**, because the release PR is opened with
  `GITHUB_TOKEN` and **GitHub raises no workflow event for it**. Do not add one back
  expecting it to fire
- **There are two functions and they have opposite exposure.** `work-statistics` is
  private: `roles/run.invoker` goes to the scheduler's service account **on the
  underlying Cloud Run service** — granting `cloudfunctions.invoker` instead is how a
  gen2 function keeps answering 403. `contact-form` grants the same role to
  **`allUsers`**, because a static page has no credential to present. It is the only
  resource here for which that is correct
- **`contact-form` has no rate limiter, and that was a decision.** One was built —
  Firestore, TTL, sliding window — and removed: three in five minutes still passes 864
  a day, distributing the source misses per-IP entirely, and what remained overlapped
  what Turnstile already does. Against that it cost **`roles/datastore.user` on the
  whole project** (Firestore has no per-collection IAM) and a fail-closed path that
  takes the form down when Firestore is unwell. What bounds the damage instead is
  `max_instance_count = 3`, which converts an unbounded bill into 429s. The full
  reasoning, and the accepted risk, are at the top of
  `gc_run_functions/contact_form/main.py` — **read it before rebuilding the limiter**
- **`max_instance_request_concurrency > 1` requires `available_cpu >= 1`.** A function's
  default memory is 256 MiB and the CPU that goes with it is under 1, so raising
  concurrency alone fails the apply with `Total cpu < 1 is not supported with
  concurrency > 1`. It failed exactly that way once; the note is in `contact.tf`
- **A failed `apply` does not roll back.** Unlike a CloudFormation stack, whatever was
  created before the error stays created, and state records it. That is usually what you
  want — fix the one resource and re-run, rather than rebuild everything — but it means
  "the apply failed" and "nothing happened" are different statements. Read the next
  plan before assuming either
- Cloud Build needs a **dedicated build service account**. Google changed the
  default and a fresh project fails with "missing permission on the build service
  account". Do not fix it by widening the default compute account; that one holds
  Editor on the whole project

DNS lives at Cloudflare and **must stay "DNS only"** — proxying breaks GitHub's
certificate renewal for the apex and `www` (next renewal 2026-10-29). That is also
why there is no HSTS: the first `http://` hit reads "not secure" for the moment
before GitHub's 301, which is accepted rather than worked around.

## Documentation

`.kiro/steering/todo.md` is the outstanding-work list — decided or deliberately
deferred items, with links to the decision behind each. It is `inclusion: manual`,
so pull it in with `#todo` rather than expecting it in context. Delete an entry when
it lands.

`obsidian/` is an Obsidian vault of longer-form notes, inherited from the template
and partly retargeted. It is **reference, not law** — this file is the contract,
and where the vault still describes Stack.Side or a Vercel deployment, it is
stale. `obsidian/meta/decisions-log.md` is the part worth keeping current: it
records *why*, which is the thing that cannot be recovered by reading the code.

After making changes: dependency changes → `tech-stack.md` + `changelog.md`;
architectural choices → an ADR in `decisions-log.md`; new component/hook/util →
the relevant catalog note. Update this file when a hard rule or a constraint
changes.

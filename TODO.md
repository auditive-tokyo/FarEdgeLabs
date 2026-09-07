# TODO — FarEdge Labs

**Loaded on request only.** Pull it in with `/todo` when you want to pick up work or
check what is outstanding; it stays out of context the rest of the time.

**残っている作業だけを置く。** 済んだものは消す — それがこの文書の運用の全部。判断の
理由で残す価値があるものは、消す前に行き先を決める: 恒久的な制約は `CLAUDE.md`、
アーキテクチャの選択は `obsidian/meta/decisions-log.md`、コードを読めば分かる話は
その場のコメント。ここに残すのは**まだ手が要るもの**に限る。

Updated 2026-09-08.

---

## Blocking a real launch

### 稼働時間が固定値になっている — 文言が追いついていない
**2026-09-05、暫定。** Jibble での打刻をやめたので `src/lib/work-statistics.ts` の
`FIXED_FIGURES` が `hours: 160` を返す。`clients` と `projects` は実測のまま。

**なぜ固定したか。** 直近30日の窓なので、打刻をやめると `hours` は 0 へ向かって落ちて
いく。関数もバケットも正常なまま、ページだけが「稼働が減っている」と言い出す。上の
[!warning]「数字が縮むのは仕様」は**測っている間だけ**成り立つ話だった。

副作用がひとつあり、これは改善方向: 固定値は `stats` を見ないので**サーバ描画の時点で
出る**。`hours` だけ `fetch` を待たずに初回描画に載る。両サイドで決定的な値なので
ハイドレーションのズレは起きない。

**未解決が2つ。どちらも承知の上で入れた:**

- **`hero.stats.note.body[0]` が嘘。** ja は「代表エンジニアの過去30日の稼働記録を
  Jibble の API で取得し、日次で集計しています」、en も同じ主張。`hours` については
  事実でなくなった。**公開ページの、数字のすぐ隣にある文**
- **`_stats_readme` に反している。** 「数字をでっち上げるより、埋めるかセクションごと
  落とす」と両ロケールに書いてある

**選択肢は3つで、筋がいいのは1番目。** 「見た目を変えない」要求で 3 を選んだ:

1. **セクションごと落とす**（`_stats_readme` が勧める形）。ただし `lg` でパネルは
   `right-7.5 / top-[24.3125rem] / w-[24.25rem]` の絶対座標でフレームの右側を占め、
   モバイルでは `mt-auto` の3ブロック目。**落とすとヒーローの構図変更になる**
2. **枠は残して中身を測定値でない情報に差し替える。** 構図は無傷、コピーは要決定
3. **固定値のまま注記を実態に合わせる** ← いまここ。注記が未着手

> [!warning] 「平日8時間で積む」に戻さないこと
> 一度検討して落とした。**関数は要らない**（平日を数えて8を掛けるのはブラウザで3行）。
> そして**動く数字は測られているように見える** — 直近30日の平日数は21〜22で揺れるので
> 168 → 176 → 168 と毎日変わり、静的な数字より強く「追跡している」と言ってしまう。
> 誤解は減らず増える。

**Jibble は完全には切れていない。** `clients` / `projects` がまだ `stats.json` 経由なので、
関数・Scheduler・シークレット2つ・日次の API 呼び出しは全部生きている。完全に切るなら
3行すべて固定するかセクションを落とすかで、そのとき下を読むこと。

> [!warning] git ではシークレットの値が戻らない
> `jibble-api-key` / `jibble-api-secret`（ともに version 1）の値は、CLAUDE.md の方針どおり
> Terraform を通していないので **state にも git にも無い**。所在は Secret Manager と、
> 追跡外の `gc_run_functions/work_statics/.env` の2箇所だけ。**Jibble の secret は一度しか
> 表示されない**ので、消してから `.env` も失うと、アカウント解約後は再取得できない。
> 消す前に `.env` をどこかへ退避すること。

### Services / Works / About are placeholders
Six live routes (three segments × two locales) render "under construction" and
carry `noindex`. They exist so the nav can be walked on a real device.

When one becomes real: write its `page.tsx`, drop `noindex`, drop its entry from
`PLACEHOLDER_SEGMENTS` in `src/views/under-construction/pages.ts`, and **add it to
`src/app/sitemap.ts`** — placeholders are deliberately absent from the sitemap.


---

## 期限とアカウント

### 無料トライアルが 2026-11-03 に切れる
課金開始日から90日。**切れるとワークロードは課金ではなく停止する。** 復帰は
アップグレードで30日の猶予、その後は削除。

いま全部 always-free tier の中に収まっているので**早期アップグレードの費用はゼロ**で、
残クレジットも期限まで使えます。つまり待つ理由が費用ではない。

保留の理由は「AI をページに載せるかもしれず、その運用コストの実額を見てから決めたい」
（2026-09-05）。ただし**それを測る道具が下の予算アラートで、まだ無い**。

### アカウント復旧をループさせない
Google のサインインは `hello@faredgelabs.com` で、**会社のメールボックスに見えて実体は
iCloud+ が配送している**。つまり Google の復旧メールは iCloud に届く。改名でこの危険は
見えにくくなっただけで、小さくなっていない。

Apple 側の復旧先が Google のアドレスを指していると輪が閉じる。片方を失うともう片方に
到達できず、**GCP の課金がこのアカウントにぶら下がっているので本番から締め出される。**

**両側にメール以外の要素を置くこと** — 電話番号、Apple の復旧用連絡先、Google の
バックアップコード。

### Cloud Identity を立てて org を移す — 決定済み、未着手
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

**サインインアドレスはもう iCloud のものではない。** 旧来の
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
> 上の「無料トライアルが 2026-11-03 に切れる」のとおり、終了時点でワークロードは課金
> ではなく**停止**される。移行と
> その期限が重なると、切り分けのできない障害になる。**先に試用をアップグレードして崖を
> 無くしてから移すこと** — この構成は always-free の範囲なので、アップグレード自体に
> 費用は付かない。


---


---

## 監視が無い

### 予算アラートが無い
トライアル中は $300 が失敗を静かに吸収する。無認証の関数を叩かれているときに一番
望ましくない挙動。

`faredgelabs` プロジェクト（番号 `89292293815`）に絞り、
**`--credit-types-treatment=exclude-all-credits` を付ける** — 付けないとクレジット控除
*後*の支出を測るので、トライアル中は永久に鳴らない。

Terraform に入れないのは意図的で、`google_billing_budget` は請求先アカウントへの IAM を
要求する。予算1つのために CI のサービスアカウントをプロジェクトの外へ広げる価値は無い。

**これは単独の項目ではない。** 上のトライアルの判断（実額を見てから）も、`main.tf` の
「イメージの増え方は予算アラートが教えてくれる」という注記も、これがある前提で書かれて
いる。無いあいだ、両方が宙に浮いている。

### 送信失敗のログベースアラートが無い
`contact-form` の IP レートリミッタを外したときの**受け入れたリスクの前提**がこれ。理由は
`gc_run_functions/contact_form/main.py` の冒頭にある。

要旨: Turnstile が破られると Zoho の日次上限が枯れ、そのあと本物の問い合わせが失敗する。
その失敗は *silent ではない* — 送信失敗は必ず Cloud Logging に出る、というのが受け入れの
根拠だった。**しかし誰も見ていないので実質 silent。**

送信失敗の行に対するログベースアラートを1本張れば前提が成立する。**リミッタを作り直すより
先にこれ。**


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

### DNS を Terraform に入れるかは、まだ開いている
ゾーンは Cloudflare（`craig`/`penny.ns.cloudflare.com`）にあり、**コンソール管理のまま**。
「コンソールではなく Terraform」という他の全部と逆になっているので、理由を残す。

**ゾーンの半分がメール基盤だから。** MX ×2、SPF、DKIM、`apple-domain` の検証 TXT が
iCloud のもので、問い合わせの通知はそこへ届く。plan を間違えると**問い合わせが静かに
届かなくなる** — `gc_run_functions/contact_form/main.py` 冒頭がレートリミッタを外した
理由として名指ししている、まさにその壊れ方。

見返りも小さい。IaC の利点は drift が `plan` に出ることだが、**このゾーンは drift しない**。
apex の A/AAAA は GitHub の固定値、メール系は iCloud の固定値。

やるなら形は決まっている: `cloudflare_record` はレコード単位なので、**このリポジトリが
所有するもの（apex の A/AAAA、`www` の CNAME）だけを入れて、メール系4件は触らない**。
ゾーンファイル方式と違い、知らないレコードを消さない。トークンはアカウント全体ではなく
**このゾーンの `Zone:DNS:Edit` だけ**に絞ること。

### Zoho が止まったときの移行先は Resend
Zoho 依存の性質は `CLAUDE.md`（grandfathered で再取得不能、他社の資格情報、送信専用鍵では
なくメールボックスのログイン）。止まったときに慌てないよう、移行先だけ決めてある。

無料枠は **100/日・3,000/月**で、**受信も送信と同じ枠を消費**し、To/CC/BCC は宛先ごとに
1通と数える。

**DNS の懸念は当たらない。** Resend は SPF と MX を `send.` サブドメイン（Return-Path）に
置くので、apex の iCloud MX と SPF はそのまま。apex に乗るのは DKIM の TXT だけで、
iCloud とは別セレクタなので DMARC の DKIM アラインメントが厳密に取れる。**SPF の統合は
不要。**（必要になった場合: SPF TXT は1名前に1本、かつ DNS ルックアップ10回の上限を
超えると permerror で落ちる。）

差し替えは15行程度 — `smtplib` を抜いて HTTPS 呼び出し1本。**そうあり続けるよう、メール
送信は1つの関数の内側に閉じておくこと。**


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

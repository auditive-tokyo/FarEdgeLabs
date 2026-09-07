import { cfBeaconToken } from "@/env";
import { htmlLang, type Locale } from "@/locales";
import { getSiteStructuredData } from "@/utils/seo/structured-data";

import { IntroReveal } from "@/components/common/intro";
import { ReducedMotion } from "@/components/common/reduced-motion";
import { ScrollLayout } from "@/layouts/scroll-layout";

import { generalSans, mulish } from "./fonts";

import "@/app/globals.css";

/**
 * The document every locale's root layout renders.
 *
 * There is one root layout per locale, in a route group — `src/app/(ja)/` and
 * `src/app/(en)/` — because `<html lang>` can only be set by a root layout, and
 * a single shared one would have to lie about one of the two languages. Route
 * groups are the only way to have more than one, so the parts that do *not*
 * differ live here instead of being written twice.
 *
 * Note this is not itself a layout: it is a component the layouts call. Next
 * treats any `layout.tsx` as a segment boundary, so making this one would add a
 * level to the tree rather than share code across it.
 */
export const LayoutShell = ({
  locale,
  children,
}: Readonly<{ locale: Locale; children: React.ReactNode }>) => {
  return (
    <html lang={htmlLang(locale)}>
      <body
        className={`${generalSans.variable} ${mulish.variable} font-sans antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getSiteStructuredData(locale)),
          }}
        />
        {/* No <AdaptiveGrid />: it exists to take over *above* the largest
            breakpoint, and the single unbounded `vw` rule in globals.css never
            hands over — it scales the same way at every width. Mounting it
            would only damp the scale-up away from the design's proportions.
            See obsidian/meta/decisions-log.md ADR-0015. */}
        <ScrollLayout>
          <ReducedMotion />
          {/* Renders nothing — it starts the entrance. The template's
              full-screen loader is gone: it counted a fixed 2200ms without
              measuring a single byte, and the page it was hiding was already
              there. See decisions-log ADR-0019. */}
          <IntroReveal />
          {/* No consent banner: the site stores nothing on the visitor's device
              beyond what it needs to render. Analytics is Cloudflare Web
              Analytics, which is cookieless, so there is no non-essential
              storage to ask about. Reinstate one before adding GA4 or any other
              tag that writes a cookie — see decisions-log ADR-0018. */}
          {children}
        </ScrollLayout>

        {/* Cloudflare Web Analytics。cookieless なので同意バナーが要らない
            （上の注記と decisions-log ADR-0018）。`</body>` の直前という置き場所は
            Cloudflare の指定。

            **プロキシは要らない。** 公式が「DNS を変えず、Cloudflare のプロキシも
            使わずに」と言っているので、CLAUDE.md の「DNS only を維持」と衝突しない。
            ここを取り違えると、計測のためにオレンジ雲へ変えて apex の証明書更新を
            壊す方向へ進んでしまう。

            **`next/script` は使っていない。** このリポジトリに前例が無く（CLAUDE.md）、
            入れれば最初の使用になる。一方このビーコンは誰も待たない撃ち放しで、
            load を拾う必要も状態も無いので、strategy 制御も重複排除も買うものが無い。
            同じ `<body>` に生の `<script>`（JSON-LD）がもう1つあるので、前例も
            このファイルの中にある。

            **トークンが無いときはタグごと描かない。** `undefined` の入った
            `data-cf-beacon` を出すより無いほうが読める。ローカルで未設定なのは
            既定の挙動 — 理由は `src/env.ts` の注記。

            **`type="module"` はダッシュボードのスニペットに合わせてある。**
            `defer` から替えた。いまの `beacon.min.js` は webpack の IIFE で
            トップレベルの `import`/`export` を持たないので classic でも動くが、
            Cloudflare が module と言っている以上そちらが支持されている形で、
            将来本当の ESM になったとき classic だと構文で落ちる。
            **module は暗黙に defer** なので `defer` を併記する意味は無い。仕様上
            module script では `defer` 属性は無視されるので、足しても「効いている」と
            誤読させるだけ。だから下の lint 抑制は属性ではなくコメントで解いてある。

            > [!warning] module は必ず CORS 付きで取得される
            > classic と違い、配信元が `Access-Control-Allow-Origin` を返さないと
            > **読み込み自体が失敗する**。`static.cloudflareinsights.com` は `*` を
            > 返すので成立している（実測済み）。自前ホストへ写す判断をするなら、
            > そこで最初に確認するのはこのヘッダ。 */}
        {cfBeaconToken ? (
          // `no-sync-scripts` は `<script src>` に async/defer が無いと機械的に
          // 警告するルールで、`type="module"` が defer 相当であることを知らない。
          // パーサをブロックしないので誤検知。
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script
            type="module"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: cfBeaconToken })}
          />
        ) : null}
      </body>
    </html>
  );
};

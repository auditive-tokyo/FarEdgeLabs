/**
 * サービスのページ — Server Component。
 *
 * 骨格は `works.tsx` と同じ。場とヘッダーを保ったまま `<main>` の中身だけ差し替える。
 *
 * ## このページが答える問い
 *
 * 他の3つで埋まらない穴がここだった。
 *
 * | | |
 * |---|---|
 * | ヒーロー | 主張（`決める前に、測る`） |
 * | `/works` | 証拠（13件） |
 * | `/contact` | 行動 |
 * | **ここ** | **結局、何をどう頼めるのか** |
 *
 * だから技術の羅列にしない。**依頼の形**を5つ並べて、それぞれに実例を添える。
 * 5つは思いつきではなく、実績13件を分類したら出てきた区分で、**全部に実例がある**。
 *
 * 受託 SIer の定石は「事業内容3行 + 技術名40個 + 案件60件」で、あれは**量そのものが
 * 主張**になっている（長くやってきた、人を出せる）。この規模では勝てない土俵なので、
 * 同じ形にしない。詳しい理由は `works.tsx` の注記。
 *
 * ## 「チームに入る」を頼めることの1つとして並べる
 *
 * 「何を作るか」と「どう関わるか」で2セクションに分けかけて、やめた。**訪問者から
 * 見れば「新規開発を頼む」も「チームに入ってもらう」も同じ選択肢**で、軸を分けると
 * 「技術検証」が両方に出てきて重複する。
 *
 * ## 言語を独立した節にしている理由
 *
 * 今どき言語名そのものの情報量は小さい。それでも1行置いてあるのは、**人も AI
 * エージェントも絞り込みの手掛かりとして必ず探す**から。逆に言えば1行で足りるので、
 * 「扱う層」の表と混ぜて水増ししない。
 */

import { getHomeContent } from "@/data/mocks/home";
import { localeHref, otherLocale, type Locale } from "@/locales";

import { HeroField } from "./home/hero-field";
import { SiteHeader } from "./home/site-header";

export interface ServicesViewProps {
  locale: Locale;
}

/** 節見出しのピル。`works.tsx` と同じ扱い（`--on-accent` で両配色の contrast が確定）。 */
const SECTION_PILL =
  "inline-block self-start rounded-card bg-accent px-3 py-1 font-mulish text-caption leading-[1.2] tracking-wider text-on-accent";

export const ServicesView = ({ locale }: ServicesViewProps) => {
  const content = getHomeContent(locale);
  const { services } = content;

  return (
    <>
      <HeroField src={content.hero.backgroundVideoSrc} />
      <SiteHeader
        brand={content.brand}
        nav={content.nav}
        languageSwitch={content.languageSwitch}
        languageHref={localeHref(otherLocale(locale), services.path)}
      />
      <main>
        <section aria-labelledby="page-title" className="px-5 py-24">
          <div className="flex w-full max-w-[32rem] flex-col gap-8 rounded-card bg-surface/75 p-8 lg:mx-auto">
            <div className="flex flex-col gap-3">
              <h1 id="page-title" className="text-display font-light leading-none">
                {services.heading}
              </h1>
              <p className="font-mulish text-caption leading-[1.5]">
                {services.lead}
              </p>
            </div>

            <section className="flex flex-col gap-4">
              <h2 className={SECTION_PILL}>{services.offeringsTitle}</h2>
              <ul className="divide-y divide-hairline">
                {services.offerings.map((offering) => (
                  <li key={offering.title} className="py-4 first:pt-0 last:pb-0">
                    <h3 className="font-mulish text-body font-semibold leading-[1.3]">
                      {offering.title}
                    </h3>
                    {/* 実例は置かない。`/works` が13件を持っていて nav から1クリック、
                        両方に書くと同じ案件が2ページに散る。**ここは選ぶための一覧**で、
                        確かめるのは向こうの仕事。 */}
                    <p className="mt-2 font-mulish text-caption leading-[1.6]">
                      {offering.body}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className={SECTION_PILL}>{services.layersTitle}</h2>
              {/* 用語と説明の対なので `<dl>`。狭い幅では `flex-wrap` で2行に折り返る。
                  `<table>` にすると 24rem の内寸で2列が潰れる。 */}
              <dl className="divide-y divide-hairline">
                {services.layers.map((row) => (
                  <div
                    key={row.layer}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                  >
                    <dt className="font-mulish text-body font-semibold leading-[1.3]">
                      {row.layer}
                    </dt>
                    <dd className="font-mulish text-caption leading-[1.5]">
                      {row.example}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className={SECTION_PILL}>{services.languagesTitle}</h2>
              <p className="font-mulish text-body leading-[1.5]">
                {services.languages}
              </p>
            </section>
          </div>
        </section>
      </main>
    </>
  );
};

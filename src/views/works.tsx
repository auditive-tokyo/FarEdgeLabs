/**
 * 開発実績のページ — Server Component。
 *
 * `contact.tsx` と同じ骨格。場とヘッダーを保ったまま `<main>` の中身だけ差し替える。
 * プレースホルダーだった3枚のうち、**最初に中身が入ったページ**。
 *
 * ## 案件名だけの一覧にしない
 *
 * 受託会社の実績ページは「案件名 + 技術スタック」を数十件並べる形が定石で、あれは
 * **量そのものが主張**になっている（長くやってきた、人を出せる、潰れない）。
 * ここは件数で勝てないので、**1件ずつに「何を判断したか」を書く**ほうへ振ってある。
 *
 * 全件には書いていない。**「やらないと決めた」判断があるものだけ**に絞っている ——
 * エッジ AI（カタログ値ではなく計測値で採用可否を出した）、暗号資産（寄与の無い特徴量を
 * 不採用にした）、眼科 AI（精度ではなく速度と費用が制約だと判断して外部 API へ移った）。
 * 全件に付けると、判断したという主張自体が薄まる。
 *
 * ## 年度を書かない
 *
 * 経歴書には入っているが、ここでは落とした。**この一覧は時系列ではなく能力の棚卸し**で、
 * 年度があると読み手が「新しい/古い」で選別を始める。判断の質は古くならない。
 * 在籍年から年齢が推測できるという問題も同時に消える。
 *
 * 失うのは「最近やった」という信号で、AI 系ではそれ自体が主張になる。**並び順が肩代わり
 * している** —— 新しい順のまま `稼働中` と `これまで` で切ってあるので、一番効く境界は
 * 引かれている。
 *
 * ## 見出しの階層
 *
 * `<h1>` 実績 → `<h2>` 稼働中 / これまで → `<h3>` 案件名。`<ul>` に入れてあるのは
 * **件数が意味を持つ並び**だから（ハードルール #10）。
 *
 * カードは枠なしの `bg-surface/75`。`under-construction/body.tsx` と
 * `contact/form.tsx` が同じ形で、**大きいカードに枠は要らない**（面積が地として
 * 成立する）。枠が要るのはヒーローの小さいパネルのほうで、あちらは `border-accent`。
 */

import { getHomeContent } from "@/data/mocks/home";
import { localeHref, otherLocale, type Locale } from "@/locales";

import { HeroField } from "./home/hero-field";
import { SiteHeader } from "./home/site-header";

export interface WorksViewProps {
  locale: Locale;
}

export const WorksView = ({ locale }: WorksViewProps) => {
  const content = getHomeContent(locale);
  const { works } = content;

  return (
    <>
      <HeroField src={content.hero.backgroundVideoSrc} />
      <SiteHeader
        brand={content.brand}
        nav={content.nav}
        languageSwitch={content.languageSwitch}
        languageHref={localeHref(otherLocale(locale), works.path)}
      />
      <main>
        {/* `min-h-lvh` と `items-center` は使わない。1枚のカードを画面中央に置く
            他のページと違って、ここは縦に長い一覧なので上端から始める。 */}
        <section aria-labelledby="page-title" className="px-5 py-24">
          <div className="flex w-full max-w-[32rem] flex-col gap-8 rounded-card bg-surface/75 p-8 lg:mx-auto">
            <div className="flex flex-col gap-3">
              <h1 id="page-title" className="text-display font-light leading-none">
                {works.heading}
              </h1>
              {/* 顧客名を出さない断り。**一覧の前に置く** — 読み終わってから
                  「名前が無い」と気づかせるより、先に言うほうが誠実に読める。 */}
              <p className="font-mulish text-caption leading-[1.5]">{works.lead}</p>
            </div>

            {works.groups.map((group) => (
              <section key={group.title} className="flex flex-col gap-4">
                <h2 className="inline-block self-start rounded-card bg-accent px-3 py-1 font-mulish text-caption leading-[1.2] tracking-wider text-on-accent">
                  {group.title}
                </h2>

                <ul className="divide-y divide-hairline">
                  {group.items.map((item) => (
                    <li key={item.title} className="py-4 first:pt-0 last:pb-0">
                      <h3 className="font-mulish text-body font-semibold leading-[1.3]">
                        {item.title}
                      </h3>
                      <p className="mt-2 font-mulish text-caption leading-[1.6]">
                        {item.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </main>
    </>
  );
};

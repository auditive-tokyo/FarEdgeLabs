/**
 * お問い合わせページ — Server Component。
 *
 * `under-construction.tsx` と同じ骨格で、場とヘッダーを保ったまま `<main>` の中身だけ
 * 差し替える。プレースホルダーと違うのは `noindex` を付けないこと: これは実在する
 * ページで、検索から直接来てほしい唯一の下層ページ。
 *
 * ヘッダーの nav は5項目目としてこのページを指す。**専用の CTA ボタンは無い** —
 * 一度ヘッダーのピルとして特別扱いにして、戻した。行き先の1つであって別種のものでは
 * ないので。
 */

import { getHomeContent } from "@/data/mocks/home";
import { localeHref, otherLocale, type Locale } from "@/locales";

import { ContactForm } from "./contact/form";
import { HeroField } from "./home/hero-field";
import { SiteHeader } from "./home/site-header";

export interface ContactViewProps {
  locale: Locale;
}

export const ContactView = ({ locale }: ContactViewProps) => {
  const content = getHomeContent(locale);

  return (
    <>
      <HeroField src={content.hero.backgroundVideoSrc} />
      <SiteHeader
        brand={content.brand}
        nav={content.nav}
        languageSwitch={content.languageSwitch}
        // 同じページの他言語版。`under-construction` と同じ理由で `path` を渡す。
        languageHref={localeHref(otherLocale(locale), content.contact.path)}
      />
      <main>
        {/* `min-h-lvh` と中央寄せは `under-construction/body.tsx` と同じ。ページに
            1枚しか無いカードは、フレームの真ん中に置く以外の置き方が無い。 */}
        <section
          aria-labelledby="page-title"
          className="flex min-h-lvh items-center px-5 py-24"
        >
          <div className="flex w-full flex-col gap-5 lg:mx-auto lg:max-w-[32rem]">
            {/* ページの唯一の `<h1>`。フォームのカードの外に出してあるのは、
                見出しがカードの持ち物ではなくページの持ち物だから — 送信後に
                カードが差し替わっても見出しは残る。 */}
            <h1
              id="page-title"
              className="text-display font-light leading-none"
            >
              {content.contact.heading}
            </h1>
            <ContactForm copy={content.contact} locale={locale} />
          </div>
        </section>
      </main>
    </>
  );
};

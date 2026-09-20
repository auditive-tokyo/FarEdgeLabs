"use client";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/intro";
import type { HomeContent } from "@/data/mocks/home";

import { LIFT_IN, LIFT_OUT, REVEAL_DELAY, REVEAL_SPRING } from "./reveal";

export interface HeroProjectsProps {
  projects: HomeContent["hero"]["projects"];
}

/** 見出しのピルと、それが名前を与えるグループを結ぶ。 */
const SCOPE_ID = "hero-projects-scope";

/**
 * いま動いている案件を並べる1枚のパネル。フレーム右下、テンプレートの 2×2 グリッドが
 * 占めていた footprint に入る。
 *
 * ## 数字のパネルだった
 *
 * 元はクライアント数・プロジェクト数・稼働時間の3行で、値は Jibble の打刻から
 * `work-statistics` 関数が日次で集計していた。**捨てた理由は「数えられる実績が無い」
 * ではなく、稼働時間が固定値になっていたから** —— 実測でない数字が1つ混ざった時点で、
 * パネル全体が「実測です」と言えなくなる。
 *
 * **いま書いてあることのほうが、数字より多くを語る。** 何をやっているかが直接書いて
 * あるので、読み手は数字から推測しなくてよい。
 *
 * 読み手が消えたので、**書き手も丸ごと消した** —— `src/lib/work-statistics.ts`、
 * `work-statistics` 関数、Cloud Scheduler、公開バケット、Jibble のシークレット。
 * 詳細はルートの `CLAUDE.md`。
 *
 * ## 寸法
 *
 * `lg:w-[24.25rem]` は旧グリッドの正確な幅（11.875rem のカード2枚 + 0.5rem の gap）で、
 * フレームの構図を動かさないため。**高さは内容任せ。** 上端で固定してあるので、行が
 * 増えれば元から空いている下へ伸びる。
 *
 * `bg-surface/75` は `<HeroCopy>` のカードと同じ値。**2枚がフィールドの同じ深さに
 * 座る**ためで、片方だけ違うと穴に見える。数字の根拠と「`/70` を下回ると `text-body`
 * が被写体の一番暗い部分に負ける」という下限は、あちらのカードに書いてある。
 * コピーは `lg` でフィールドの静かな左3分の1へ移ってカードを捨てるが、**こちらは
 * 忙しい右側に残るのでどの幅でも地を保つ。**
 *
 * `backdrop-blur` は入れない。フィールドは毎フレーム描き直す WebGL canvas なので、
 * フィルタも同じ頻度で掛け直すことになる。
 *
 * ## 見出しはピルで、キャプションではない
 *
 * 「現在稼働中のプロジェクト」は下の全項目に掛かるので、**項目の1つに見えてはいけない。**
 * 文字サイズを2段落とすだけでは足りず、しかも普段使う手が2つとも使えない:
 *
 * - **書体では分けられない。** General Sans も Mulish も Latin のみなので、日本語は
 *   どちらでも OS の CJK にフォールバックする。`font-sans` と `font-mulish` は
 *   現在稼働中のプロジェクト を同じに描く
 * - **アクセント色の文字でも分けられない。** 緑は暗い面では楽に通るが、ピンクは明るい面で
 *   3:1 付近に落ちてキャプションサイズでは落第する。`CLAUDE.md` の色トークンの表が
 *   警告しているのがこれ
 *
 * ピルは両方を回避する。`--on-accent` は**アクセント面に乗せるインク**として存在し、
 * どちらの配色でも暗いので、コントラストは運ではなくトークンで決まる。
 *
 * `role="group"` に `aria-labelledby` で結んであるのは、読み上げで「機械学習エンジニア」
 * だけが読まれて**それが何の一覧なのか分からなくなる**のを避けるため。見出しが横に
 * 浮いた `<p>` のままだと、グループとの関係が伝わらない。
 *
 * `<h2>` にはしない。体言止めの断片であり、見出しの階層は文書構造の約束だから
 * （ハードルール #10）。
 *
 * ## `<ul>` であって `<dl>` ではない
 *
 * 数字の頃は「ラベル → 値」だったので `<dl>` が正しかった。いまは**案件の一覧**で、
 * 説明文は値ではなく地の文。用語と定義の対ではないので `<ul>` にしてある。
 *
 * ## 段が2つしか無い
 *
 * 数字の頃は3段あった（`text-stat` の斜体 / ラベル / キャプション）。**一番大きい段が
 * 消えたので、残り2つは太さで分けている** —— サイズ差だけだと、このパネルでは
 * 平らに見える（4つの役割を1サイズで並べて失敗した前歴がそれ）。
 *
 * 役割名を**アクセント色にはしない。** 上のピルの節と同じ理由で、明るい配色で落第する。
 *
 * **罫線も重みを2つ使う。** `--hairline-strong` がデータ部を上下で囲み、素の
 * `--hairline` が中の行を分ける。全部同じ濃さだと、これも平らさの片棒を担ぐ。
 *
 * 注記だけ左に罫を引くのは、項目の続きではなく**項目に対する断り**だから。引用の形。
 * アクセントにしないのは、パネルの枠が既にアクセントで、中にもう1本引くと競合するため。
 *
 * ## なぜ `<details>` か
 *
 * 「顧客名は？」は訪問者が実際に持つ疑問で、開閉はプラットフォームの答えそのもの ——
 * キーボードで辿れ、開閉可能だと読み上げられ、静的書き出しのページに状態を持ち込まない。
 * ホバーのツールチップは電話で触れないが、**電話こそパネルが一番狭くて疑問が湧く場所**。
 *
 * 既定のマーカーは付け替えではなく**外す**。ヒーローにアイコンの語彙が無く、裸の「?」が
 * 唯一のそれになる。ヘッダーにあった丸囲みの矢印を「意味が無い」として消したのと同じ話。
 *
 * パネルは上端で固定なので、開いても数字を押しのけずに**元から空いている下の帯へ**伸びる。
 */
export const HeroProjects = ({ projects }: HeroProjectsProps) => {
  const isRevealed = useIntroRevealed();

  return (
    <Inview
      tag="div"
      role="group"
      aria-labelledby={SCOPE_ID}
      className="rounded-card border border-accent bg-surface/75 p-4 lg:absolute lg:right-7.5 lg:top-[24.3125rem] lg:w-[24.25rem] lg:p-6"
      from={LIFT_OUT}
      to={LIFT_IN}
      config={REVEAL_SPRING}
      delayIn={REVEAL_DELAY.projects}
      mode="once"
      enabled={isRevealed}
    >
      <div className="border-b border-hairline-strong pb-3">
        <p
          id={SCOPE_ID}
          className="inline-block rounded-card bg-accent px-3 py-1 font-mulish text-caption leading-[1.2] tracking-wider text-on-accent"
        >
          {projects.scope}
        </p>
      </div>

      <ul className="divide-y divide-hairline">
        {projects.items.map((project) => (
          <li key={project.role} className="py-3">
            <p className="font-mulish text-body font-semibold leading-[1.2]">
              {project.role}
            </p>
            <p className="mt-1.5 font-mulish text-caption leading-[1.5]">
              {project.body}
            </p>
          </li>
        ))}
      </ul>

      <details className="border-t border-hairline-strong pt-3">
        <summary className="cursor-pointer list-none font-mulish text-caption leading-[1.2] underline decoration-hairline-strong underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          {projects.note.summary}
        </summary>
        <div className="mt-3 space-y-2 border-l-2 border-hairline-strong pl-3">
          {projects.note.body.map((paragraph) => (
            <p key={paragraph} className="font-mulish text-caption leading-[1.5]">
              {paragraph}
            </p>
          ))}
        </div>
      </details>
    </Inview>
  );
};

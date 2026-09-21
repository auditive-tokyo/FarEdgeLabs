"use client";

import TextEngine from "spring-text-engine";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/intro";

import {
  REVEAL_DELAY,
  REVEAL_SPRING,
  WORD_IN,
  WORD_OUT,
  WORD_STAGGER,
} from "./reveal";

export interface HeroCopyProps {
  lead: string;
  body: string;
}

/**
 * The rule and the two paragraphs hanging off it — Figma 681:370.
 *
 * The copy rises a word at a time, unblurring as it settles — the same move as
 * the headline turned through ninety degrees, which is what keeps the two
 * reading as one entrance rather than two effects.
 *
 * > [!important] 座標は箱1つぶんだけ。中身は内容に追随させる
 * > 以前は罫線・lead・body の3つがそれぞれ `lg:absolute` で別々の座標を持ち、
 * > 段落の間隔は **`top` の差**（10.25rem）でできていた。フレームはいまより長い
 * > コピーを前提に引かれていたので、`検証から、本番まで` の1行に縮んだ時点で
 * > **その下に7〜8rem の空白が残った**。
 * >
 * > 座標を詰めても直らない。罫線は `h-60` 固定で「lead の頭から body の足まで」を
 * > 張る寸法なので、body を上げると今度は罫線が下に余る。**コピーの長さが変わる
 * > たびに2つの数字を調整し直す形**になっていた。
 * >
 * > いまは箱1つ（`lg:left-7.5 / lg:top-[24.3125rem] / lg:w-[27.6875rem]`）だけを
 * > 置いて、中はスマホと同じ flex。罫線は伸び、段落は `gap` で離れる。**幅と左端は
 * > フレームのまま**（罫線 1.875rem、本文 3.875rem、本文幅 25.6875rem から算出）。
 * >
 * > `lg:contents` は要らなくなった。あれは「各ピースをセクションに対して置く」ための
 * > 仕掛けで、置く対象が1つになれば入れ子を消す理由も無い。
 *
 * > [!note] `<TextEngine>` に `absolute` は効かない
 * > エンジンはルートのインラインスタイルに `position: relative` を書き込むので、
 * > クラスの `absolute` は静かに落ちる。**位置を持たせるなら必ず外側の箱に。**
 * > いまは絶対配置が箱1つだけなので、段落を包む必要は無くなっている。
 */
export const HeroCopy = ({ lead, body }: HeroCopyProps) => {
  const isRevealed = useIntroRevealed();

  return (
    /* The card is mobile's alone. On the frame this copy sits in the field's
       quiet left third, but a phone stacks it straight over the subject's face,
       where body text at `text-body` competes with the halftone's densest dots.
       A ground of its own is the cheapest fix that keeps the art intact, and it
       is deliberately short of opaque — the dots still read through it, so the
       card sits *in* the field rather than punching a hole in it. Below about
       `/70` the body copy starts losing contrast against the darkest part of the
       subject, which is the floor to tune against.
       `lg` ではカードの装飾だけを外す（`lg:rounded-none lg:bg-transparent lg:p-0`）。
       箱そのものは残す —— **フレームの座標を持つのがこの箱**だから。以前は
       `lg:contents` で箱ごと消しており、「箱を生成しない要素は背景も塗らない」ので
       上書きが1つも要らなかった。座標を中の3要素が分担していたぶん、その手が使えた。
       No `backdrop-blur`: the field behind it is a WebGL canvas redrawing every
       frame, and a backdrop filter would have to re-blur it just as often. A
       near-opaque ground costs nothing per frame and reads the same. */
    <div className="flex gap-4 rounded-card bg-surface/75 p-5 lg:absolute lg:left-7.5 lg:top-[24.3125rem] lg:w-[27.6875rem] lg:gap-8 lg:rounded-none lg:bg-transparent lg:p-0">
      {/* 上から下へ引かれる。コピーの背骨が届く動きで、線が浮き上がるのとは別物。
          **長さは指定しない** —— flex アイテムとして隣の段落の高さまで伸びる。
          以前は `lg` だけ `h-60`（15rem）固定で、「lead の頭から body の足まで」に
          合わせた寸法だった。コピーが縮んだ日に合わなくなる書き方だった。 */}
      <Inview
        tag="span"
        aria-hidden="true"
        className="w-px shrink-0 origin-top bg-foreground"
        from={{ scaleY: 0 }}
        to={{ scaleY: 1 }}
        config={REVEAL_SPRING}
        delayIn={REVEAL_DELAY.rule}
        mode="once"
        enabled={isRevealed}
      />

      <div className="flex flex-col gap-6">
        <TextEngine
          tag="p"
          className="text-lead leading-[1.2]"
          mode="once"
          enabled={isRevealed}
          delayIn={REVEAL_DELAY.lead}
          wordOut={WORD_OUT}
          wordIn={WORD_IN}
          wordStagger={WORD_STAGGER}
          wordConfig={REVEAL_SPRING}
        >
          {lead}
        </TextEngine>

        <TextEngine
          tag="p"
          className="text-body leading-[1.2]"
          mode="once"
          enabled={isRevealed}
          delayIn={REVEAL_DELAY.body}
          wordOut={WORD_OUT}
          wordIn={WORD_IN}
          wordStagger={WORD_STAGGER}
          wordConfig={REVEAL_SPRING}
        >
          {body}
        </TextEngine>
      </div>
    </div>
  );
};

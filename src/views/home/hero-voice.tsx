"use client";

import { useEffect, useState } from "react";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/intro";
import {
  useRealtimeCall,
  type RealtimeCallError,
  type RealtimeCallState,
} from "@/hooks/use-realtime-call";
import { useTurnstile } from "@/hooks/use-turnstile";
import { useWindowSize } from "@/hooks/use-window-size";
import type { HomeContent } from "@/data/mocks/home";
import type { Locale } from "@/locales";

import { LIFT_IN, LIFT_OUT, REVEAL_DELAY, REVEAL_SPRING } from "./reveal";

export interface HeroVoiceProps {
  copy: HomeContent["hero"]["voice"];
  locale: Locale;
}

/** `man.mp4` の素の大きさ。`object-cover` の倍率を出すのに要る。 */
const VIDEO_WIDTH = 962;
const VIDEO_HEIGHT = 720;

/**
 * 頭の中心（クリップ座標の正規化）。**3フレーム（0 / 50 / 100%）を実測して決めた値**で、
 * 首から上が回転するだけで body は移動しないので、クリップのどこでも同じ位置にある。
 */
const HEAD_CENTER = { x: 0.485, y: 0.325 };

/**
 * 男に話しかけるボタン。
 *
 * ## 位置をピクセルで焼かない
 *
 * フィールドは `fixed inset-0` に `object-cover` なので、**同じ頭でも画面座標は
 * ビューポート比で動く**。デスクトップは上下が切れ、スマホ縦は左右が大きく切れる。
 * だから毎回カバー倍率から計算する。焼くと特定の幅でだけずれる。
 *
 * **`mirror` の反転を忘れないこと。** `<HeroField>` が `mirror` を立てていて、
 * シェーダが画像空間で `1 - x` を引いている（`shaders.ts`）。被写体がほぼ中央なので
 * ずれは3%ほどだが、正しくないものを「見た目が合っているから」で残さない。
 *
 * `tilt` は無視してよい。頭の位置（中心から `(-0.015, -0.175)`）では歪みの係数が
 * 0.954〜1.046 にしかならず、**画面上のずれは10px弱**でボタンの大きさに吸収される。
 *
 * ## 狭い幅では重ねない
 *
 * スマホでは頭がちょうどコピーカードの裏に来る。そこで**breakpoint の判定を JS で
 * やらない** — `useWindowSize` は SSR で `{0,0}` を返すので、JS で分けるとサーバと
 * クライアントで別のレイアウトを描くことになる。位置は CSS 変数で渡し、`lg:` から
 * 上でだけ絶対配置に切り替える。判定は CSS の仕事。
 *
 * ## canvas にヒットテストを置かない
 *
 * フィールドは `-z-10` かつ `aria-hidden` で、支援技術から隠された要素をインタラクティブ
 * にはできない。さらに `pointerdown` は既にスクラブに使われている（`hero-field.tsx`）。
 * **見えるボタンにすれば3つとも消える** — しかも誰も背景をクリックしない。
 */
export const HeroVoice = ({ copy, locale }: HeroVoiceProps) => {
  const isRevealed = useIntroRevealed();
  const { width, height } = useWindowSize();

  /**
   * Turnstile をいつ読むか。**話しかけない訪問者に読ませない。**
   *
   * ボタンに手を伸ばした時点（`pointerenter`）で立てて、押されるまでに解き終えて
   * おく。タッチにはホバーが無いので、押下でも立てる。
   */
  const [armed, setArmed] = useState(false);
  /** 押されたがトークンがまだ、という状態。届き次第 `start` する。 */
  const [pending, setPending] = useState(false);

  const { containerRef, token, status, reset } = useTurnstile({
    language: locale,
    enabled: armed,
  });
  const { state, error, start, stop, audioRef } = useRealtimeCall();

  useEffect(() => {
    if (!pending || !token) return;
    setPending(false);
    void start(token);
    // トークンは使い捨て。次の通話のために取り直させる（`use-turnstile.ts` の注記）。
    reset();
  }, [pending, token, start, reset]);

  // Turnstile 自体が失敗したら待ち続けない。拡張機能によるブロックが典型で、
  // 訪問者に落ち度が無いぶん、黙って止まるのが一番不親切。
  useEffect(() => {
    if (pending && status === "unsupported") setPending(false);
  }, [pending, status]);

  const scale = Math.max(width / VIDEO_WIDTH, height / VIDEO_HEIGHT);
  const drawnWidth = VIDEO_WIDTH * scale;
  const drawnHeight = VIDEO_HEIGHT * scale;
  const left = (width - drawnWidth) / 2 + (1 - HEAD_CENTER.x) * drawnWidth;
  const top = (height - drawnHeight) / 2 + HEAD_CENTER.y * drawnHeight;

  const live = state === "live";
  const busy = pending || state === "requesting-mic" || state === "connecting";

  /**
   * 状態と失敗の文言は、どちらも**写像として書く**。三項の連鎖にしない。
   *
   * 読みにくさもあるが、効いているのは型のほう: `Record<RealtimeCallState, …>` は
   * **網羅性が検査される**ので、状態やエラー種別を足したときに文言の追加漏れが
   * コンパイルエラーになる。三項で書くと黙って `null` に落ちて、**何も表示されない
   * 状態**が生まれる。
   */
  const stateText: Record<RealtimeCallState, string | null> = {
    idle: null,
    "requesting-mic": copy.states.requestingMic,
    connecting: copy.states.connecting,
    live: copy.states.live,
    // 失敗の文言は `errorText` のほうが持つ。ここで二重に持たない。
    error: null,
  };

  const errorText: Record<RealtimeCallError, string> = {
    "mic-denied": copy.errors.micDenied,
    rejected: copy.errors.rejected,
    unavailable: copy.errors.unavailable,
    "connection-lost": copy.errors.connectionLost,
  };

  // Turnstile の検証は `useRealtimeCall` の外で起きるので、状態の写像に無い。
  const status_ = pending && !token ? copy.states.verifying : stateText[state];
  const message = error === null ? null : errorText[error];

  return (
    <Inview
      tag="div"
      className="self-start lg:absolute lg:left-(--voice-left) lg:top-(--voice-top) lg:-translate-x-1/2 lg:-translate-y-1/2"
      style={
        {
          "--voice-left": `${left}px`,
          "--voice-top": `${top}px`,
        } as React.CSSProperties
      }
      from={LIFT_OUT}
      to={LIFT_IN}
      config={REVEAL_SPRING}
      delayIn={REVEAL_DELAY.voice}
      mode="once"
      enabled={isRevealed}
    >
      <button
        type="button"
        aria-label={copy.label}
        disabled={busy}
        onPointerEnter={() => setArmed(true)}
        onClick={() => {
          if (live) {
            stop();
            return;
          }
          setArmed(true);
          setPending(true);
        }}
        className="rounded-card border border-accent bg-surface/75 px-4 py-2 font-mulish text-body leading-[1.2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {live ? copy.stop : copy.start}
      </button>

      {/* 状態と失敗は**同じ枠**に出す。片方ずつしか起きないので、2つ場所を取ると
          どちらも空の時間が長くなる。`aria-live` で読み上げに乗せるのは、進行が
          見た目の変化だけだと目を離した人に伝わらないため。 */}
      <p
        aria-live="polite"
        className="mt-2 min-h-[1.5em] font-mulish text-caption leading-[1.2]"
      >
        {message ?? status_}
      </p>

      {/* Turnstile の描画先。`armed` になるまで空のまま。 */}
      <div ref={containerRef} className={armed ? "mt-2" : undefined} />

      {/* 相手の声。`autoPlay` はフックが自分で `play()` を呼ぶので付けない。 */}
      <audio ref={audioRef} hidden />
    </Inview>
  );
};

/**
 * Turnstile のウィジェットを1つ持つ。防御の1層目のブラウザ側。
 *
 * `?render=explicit` で読み込んで自分で `render()` を呼ぶ。暗黙レンダリング
 * （`class="cf-turnstile"` を置くとスクリプトが勝手に描く）を使わない理由は、
 * **トークンの受け取りがグローバル関数名になる**こと。`data-callback="onToken"` は
 * `window.onToken` を探すので、React の state に入れるには一度グローバルを経由する
 * ことになり、複数ウィジェットや再マウントで壊れる。明示レンダリングなら
 * コールバックがクロージャで済む。
 *
 * > [!important] トークンは使い捨て
 * > 1つのトークンで送れるのは1回だけ。バックエンドが2度目を
 * > `timeout-or-duplicate` で弾くので、**送信のたびに `reset()` が必要**。忘れると
 * > 「1通目は届くが2通目から必ず失敗する」という、テストで見つけにくい壊れ方をする。
 *
 * スクリプトは `next/script` ではなく手で入れている。このリポジトリに `next/script`
 * の前例が無く、必要なのは「1回だけ読む」だけなので、モジュールスコープの Promise を
 * 1つ持つほうが短い。読み込みとレンダリングの順序もこのファイルの中で閉じる。
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { turnstileSiteKey } from "@/env";
import type { TurnstileApi } from "@/types/turnstile";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * `loading` = スクリプトかウィジェットの準備中。`unsupported` = ウィジェット自身が
 * 失敗した（ネットワーク、拡張機能によるブロック、サイトキーの不一致）。
 *
 * `unsupported` を `error` と呼ばないのは、訪問者の側に落ち度が無いから。フォームは
 * この状態で送信を止める — トークンが無い送信はバックエンドが必ず 403 で返すので、
 * 出させてから失敗させるほうが不親切。
 */
export type TurnstileStatus = "loading" | "ready" | "solved" | "unsupported";

/**
 * 読み込みは1回。**同じ `<script>` を2度入れると Turnstile は2度目を無視するが、
 * `onload` は返ってこない**ので、Promise を共有して待ち合わせる。
 *
 * React の Strict Mode は開発時に effect を2回走らせるので、これは仮定ではなく毎回
 * 通る経路。
 */
let scriptPromise: Promise<void> | null = null;

const loadScript = (): Promise<void> => {
  // `if (scriptPromise)` ではなく明示的に null 比較。Promise を真偽値として見る書き方
  // は、`await` を書き忘れた条件分岐と見分けが付かない。
  if (scriptPromise !== null) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile script failed to load"));
    document.head.appendChild(script);
  });

  return scriptPromise;
};

export interface UseTurnstileOptions {
  /** ウィジェットの表示言語。ページのロケールをそのまま渡す。 */
  language: string;
}

export interface UseTurnstile {
  /** ウィジェットを描く先。空の `<div>` に付ける。 */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 解けていれば使い捨てトークン、まだなら空文字列。 */
  token: string;
  status: TurnstileStatus;
  /** 送信のあとに呼ぶ。次の送信のために新しいトークンを取り直させる。 */
  reset: () => void;
}

export const useTurnstile = ({ language }: UseTurnstileOptions): UseTurnstile => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<TurnstileStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    // API を掴んでおく。cleanup の時点で `window.turnstile` を読み直すと、ページを
    // 離れる途中で消えている可能性がある。
    let api: TurnstileApi | undefined;

    void loadScript()
      .then(() => {
        if (cancelled) return;

        api = window.turnstile;
        const container = containerRef.current;
        if (!api || !container) {
          setStatus("unsupported");
          return;
        }

        widgetIdRef.current = api.render(container, {
          sitekey: turnstileSiteKey,
          theme: "auto",
          language,
          callback: (value) => {
            setToken(value);
            setStatus("solved");
          },
          // 期限切れは失敗ではない。トークンを捨てて `ready` に戻すと、ウィジェットが
          // 自分で解き直したときに `callback` で戻ってくる。
          "expired-callback": () => {
            setToken("");
            setStatus("ready");
          },
          "error-callback": () => {
            setToken("");
            setStatus("unsupported");
          },
        });

        setStatus((current) => (current === "loading" ? "ready" : current));
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });

    return () => {
      cancelled = true;
      // Strict Mode の2回目のマウントで、1回目のウィジェットが同じ `<div>` に
      // 残ったままになる。消さないと2つ重なって描かれる。
      if (widgetIdRef.current !== undefined) api?.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [language]);

  const reset = useCallback(() => {
    setToken("");
    if (widgetIdRef.current === undefined) return;
    window.turnstile?.reset(widgetIdRef.current);
    setStatus("ready");
  }, []);

  return { containerRef, token, status, reset };
};

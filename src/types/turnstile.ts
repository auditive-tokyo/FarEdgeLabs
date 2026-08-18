/**
 * Cloudflare Turnstile の型 — 公式の型定義パッケージを入れない代わり。
 *
 * 使うのは `render` / `reset` / `remove` の3つだけで、依存を1つ増やすより手で書いた
 * ほうが軽い。増やしたくなったら
 * https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 *
 * `window.turnstile` は**スクリプトが読み終わるまで存在しない**。だから
 * `useTurnstile` は `?render=explicit` で読み込んだあとに触る。
 */

export interface TurnstileRenderOptions {
  sitekey: string;
  /** 解けたときに1度だけ呼ばれる。トークンは使い捨て。 */
  callback?: (token: string) => void;
  /** ウィジェット自身が失敗したとき（ネットワーク、ブロック、設定違い）。 */
  "error-callback"?: () => void;
  /** トークンの有効期限切れ。放置されたフォームで起きる。 */
  "expired-callback"?: () => void;
  /** `auto` はページの `prefers-color-scheme` に従う。 */
  theme?: "auto" | "light" | "dark";
  language?: string;
  action?: string;
}

export interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions,
  ) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * お問い合わせの送信 — ブラウザから Cloud Run function を直接叩く。
 *
 * `gc_run_functions/contact_form/main.py` が受け口で、`terraform/contact.tf` が
 * それを `allUsers` に公開している。**サイト側で唯一、書き込みをするネットワーク
 * 呼び出し。**
 *
 * `output: "export"` なので中継できるサーバが無く、ブラウザから直接投げる以外の形が
 * ない。だから守りは全部あちら側にあり（Turnstile と入力上限）、ここにあるのは
 * 「無駄な往復をさせない」ためのチェックだけ。
 *
 * `work-statistics.ts` と作りは揃えてあるが、**エラーの扱いだけ正反対**。あちらは
 * 失敗を全部 `null` に潰す — ダッシュを出すのが設計された状態で、訪問者に見せる
 * ことが何も無いから。こちらは送れたかどうかが用件そのものなので、失敗の種類を
 * 呼び出し側まで返す。
 */

import { contactEndpoint } from "@/env";

/** `main.py` の `parse_submission` が要求する3項目。あちらと揃えること。 */
export interface ContactSubmission {
  name: string;
  email: string;
  message: string;
  /** Turnstile が発行する使い捨てトークン。空だとバックエンドが 403 を返す。 */
  turnstileToken: string;
}

/**
 * 入力の上限。**`main.py` の `MAX_*_LENGTH` と同じ数字**で、片方だけ動かすと
 * 「ブラウザは通すのにサーバが 400 を返す」という一番わかりにくい形で壊れる。
 *
 * ここで見るのは往復を1回節約するためで、防御ではない。防御はあちら側。
 */
export const CONTACT_LIMITS = {
  name: 100,
  /** RFC 5321 のメールアドレスの最大長。 */
  email: 254,
  message: 5000,
} as const;

export type ContactField = keyof typeof CONTACT_LIMITS;

/** 何が起きたか。文言は持たない — 表示する言葉はロケールファイルにある。 */
export type ContactResult =
  | { ok: true }
  /** バックエンドが受け付けなかった、あるいは届かなかった。 */
  | { ok: false; reason: "failed" };

/**
 * メールアドレスの形の最低限の確認。**RFC の検証ではない。**
 *
 * `main.py` の `email_shaped` と同じ判定を同じ理由で正規表現なしで書いている。
 * `^[^@\s]+@[^@\s]+\.[^@\s]+$` は素直だが `+` が3つ隣り合って後戻りが指数的に効く
 * 形（ReDoS）で、**入力の上限が防御になっているという構造にしたくない**。
 */
export const isEmailShaped = (value: string): boolean => {
  if (/\s/.test(value)) return false;

  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;

  const labels = value.slice(at + 1).split(".");
  return labels.length >= 2 && labels.every((label) => label.length > 0);
};

/**
 * 送信する。例外は投げない。
 *
 * 区別しているのは「送れた」と「送れなかった」だけで、理由を細かく分けていない。
 * ネットワークが落ちていても、Turnstile に弾かれていても、Zoho が受け付けなくても、
 * 訪問者にできることは同じ（少し待ってもう一度出す）で、**それ以上を伝えると
 * どの層で止まったかを外に教えることになる**。理由は Cloud Logging 側にある。
 */
export const submitContactForm = async (
  submission: ContactSubmission,
  signal?: AbortSignal,
): Promise<ContactResult> => {
  try {
    const response = await fetch(contactEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
      signal,
    });

    // 本文は読まない。`main.py` はメッセージを返すが、それは日本語固定で、この
    // ページには表示すべき訳文が既にある。状態行だけ見る。
    return response.ok ? { ok: true } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
};

// 日本語リソース（キーの正）。
// このオブジェクトのキー集合が TranslationKey となり、en.ts はこれと同一キーを型で強制される。
export const ja = {
  // ドキュメントメタ（index.html を JS で上書きする用）
  "meta.title": "FarEdge Labs株式会社",
  "meta.description":
    "FarEdge Labs株式会社 — 最先端を、さらに先へ。エッジテクノロジーとソフトウェアで課題を解決するITカンパニーです。",

  // ヘッダー / フッター
  "header.tagline": "最先端を、さらに先へ。",
  "footer.rights": "All rights reserved.",

  // 共通
  "common.loading": "読み込み中...",

  // メニュー
  "menu.open": "メニューを開く",
  "menu.close": "メニューを閉じる",
  "menu.reorder": "並べ替え",
  "menu.exitReorder": "並べ替えを終了",

  // お問い合わせ
  "contact.title": "お問い合わせ",
  "contact.intro": "コラボ・ご依頼・ご相談など、お気軽にお問い合わせください。",
  "contact.name": "お名前:",
  "contact.email": "メールアドレス:",
  "contact.message": "メッセージ:",
  "contact.send": "送信",
  "contact.sending": "送信中...",
  "contact.success": "メッセージを送信しました。",
  "contact.error": "エラーが発生しました。時間をおいて再度お試しください。",
} as const;

export type TranslationKey = keyof typeof ja;

import type { TranslationKey } from "./ja";

// 英語リソース。Record<TranslationKey, string> により ja.ts と同一キーを型で強制。
// キーの過不足があるとコンパイルエラーになる。
export const en: Record<TranslationKey, string> = {
  // Document meta (used to override index.html via JS)
  "meta.title": "FarEdge Labs Inc.",
  "meta.description":
    "FarEdge Labs Inc. — Pushing the Edge Further. An IT company solving challenges with edge technology and software.",

  // Header / Footer
  "header.tagline": "Pushing the Edge Further.",
  "footer.rights": "All rights reserved.",

  // Common
  "common.loading": "Loading...",

  // Menu
  "menu.open": "Open menu",
  "menu.close": "Close menu",
  "menu.reorder": "Reorder Menu",
  "menu.exitReorder": "Exit Reorder Mode",

  // Contact
  "contact.title": "Contact",
  "contact.intro": "Contact us for collaboration, projects, or any inquiries.",
  "contact.name": "Name:",
  "contact.email": "Email:",
  "contact.message": "Message:",
  "contact.send": "Send",
  "contact.sending": "Sending...",
  "contact.success": "Message sent successfully!",
  "contact.error": "An error occurred. Please try again later.",
};

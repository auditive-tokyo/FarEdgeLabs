import React, { useCallback, useMemo, useState } from "react";
import { ja, type TranslationKey } from "./locales/ja";
import { en } from "./locales/en";
import { I18nContext, type Lang } from "./context";

const STORAGE_KEY = "lang";

const resources: Record<Lang, Record<TranslationKey, string>> = { ja, en };

// 言語検出: localStorage優先 → navigator.language(en*のみen) → 既定ja
function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ja" || stored === "en") return stored;
  } catch {
    // localStorage 不使用環境は既定へフォールバック
  }
  const nav =
    typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "";
  return nav.startsWith("en") ? "en" : "ja";
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 永続化に失敗しても表示は切り替える
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => resources[lang][key] ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

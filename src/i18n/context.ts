import { createContext, useContext } from "react";
import type { TranslationKey } from "./locales/ja";

export type Lang = "ja" | "en";

// ブランド名（翻訳対象外の固有名詞。両言語共通）
export const BRAND = "FarEdge Labs";

export interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}

// 文言取得だけ欲しい場合の薄いフック
export const useT = (): I18nContextValue["t"] => useI18n().t;

export type { TranslationKey };

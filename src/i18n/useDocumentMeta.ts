import { useEffect } from "react";
import { useI18n } from "./context";

/**
 * 現在の言語に応じて index.html のドキュメントメタを動的に更新する。
 * - <html lang>
 * - <title>
 * - <meta name="description">
 * index.html 側は ja のデフォルト値を静的に保持し（初回描画/JS無効時のフォールバック）、
 * マウント後にこのフックが現在言語で上書きする。
 */
export function useDocumentMeta(): void {
  const { lang, t } = useI18n();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t("meta.title");

    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", t("meta.description"));
    }
  }, [lang, t]);
}

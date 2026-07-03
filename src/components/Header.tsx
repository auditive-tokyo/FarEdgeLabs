import React from "react";
import { BRAND, useI18n, type Lang } from "@/i18n";

const LANGS: Lang[] = ["ja", "en"];
const LANG_LABEL: Record<Lang, string> = { ja: "JA", en: "EN" };

const Header: React.FC = () => {
  const { lang, setLang, t } = useI18n();

  return (
    <header className="header-footer-common">
      <div className="site-title mb-2">{BRAND}</div>
      <p className="text-lg">{t("header.tagline")}</p>

      <div className="mt-2 flex justify-center gap-2" role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`px-2 py-0.5 text-sm rounded transition-colors ${
              lang === l
                ? "bg-cyan-600 text-white"
                : "bg-transparent text-gray-400 hover:text-white"
            }`}
          >
            {LANG_LABEL[l]}
          </button>
        ))}
      </div>
    </header>
  );
};

export default Header;

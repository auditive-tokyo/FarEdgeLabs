import React from "react";
import { BRAND, useT } from "@/i18n";

const Footer: React.FC = () => {
  const t = useT();
  return (
    <footer className="header-footer-common">
      <p className="text-lg">
        © 2026 {BRAND}. {t("footer.rights")}
      </p>
    </footer>
  );
};

export default Footer;

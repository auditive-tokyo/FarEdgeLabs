import React, { Suspense, lazy } from "react";
import Contact from "./Contact/Contact";
const CreateContent = lazy(() => import("./CreateContent/CreateContent"));
const ShowContent = lazy(() => import("./ShowContent/ShowContent"));
import { VALID_MENU_OPTIONS } from "../Menu/Menu";
import { useT } from "@/i18n";

interface ContentProps {
  activeMenu: string;
  onContentNotFound?: () => void;
}

const Content: React.FC<ContentProps> = ({ activeMenu, onContentNotFound }) => {
  const t = useT();
  const renderContent = () => {
    // activeMenuが空の場合はローディング表示
    if (!activeMenu) {
      return <div>{t("common.loading")}</div>;
    }

    const staticMenus = VALID_MENU_OPTIONS.filter((menu) => menu !== "login");

    if (!staticMenus.includes(activeMenu)) {
      return <ShowContent id={activeMenu} onNotFound={onContentNotFound} />;
    }

    switch (activeMenu) {
      case "contact":
        return <Contact />;
      case "create":
        return <CreateContent />;
      default:
        return null;
    }
  };

  return (
    <div className="content-container">
      <div className="content-wrapper">
        <Suspense fallback={<div>{t("common.loading")}</div>}>
          {renderContent()}
        </Suspense>
      </div>
    </div>
  );
};

export default Content;

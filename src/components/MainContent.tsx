import React from "react";
import Content from "./Content/Content";

interface MainContentProps {
  activeMenu: string;
  onContentNotFound?: () => void;
}

const MainContent: React.FC<MainContentProps> = ({
  activeMenu,
  onContentNotFound,
}) => {
  return (
    <main className="relative min-h-screen">
      <div className="relative w-full min-h-screen pt-[60px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Content
          activeMenu={activeMenu}
          onContentNotFound={onContentNotFound}
        />
      </div>
    </main>
  );
};

export default MainContent;

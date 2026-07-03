import React from "react";
import { useT } from "@/i18n";

interface MenuHeaderProps {
  onClose: () => void;
  isReorderMode: boolean;
  toggleReorderMode: () => void;
  isAuthenticated: boolean;
}

export const MenuHeader: React.FC<MenuHeaderProps> = ({
  onClose,
  isReorderMode,
  toggleReorderMode,
  isAuthenticated,
}) => {
  const t = useT();
  return (
    <>
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 hover:opacity-70 transition-opacity"
        aria-label={t("menu.close")}
      >
        <div className="w-8 h-[4px] bg-gray-400 rounded-full rotate-45 absolute"></div>
        <div className="w-8 h-[4px] bg-gray-400 rounded-full -rotate-45 absolute"></div>
      </button>

      {/* Reorder mode toggle button (only for authenticated users) */}
      {isAuthenticated && (
        <button
          onClick={toggleReorderMode}
          className={`absolute top-6 left-6 px-4 py-2 rounded ${
            isReorderMode ? "bg-amber-500" : "bg-gray-700 text-white"
          }`}
        >
          {isReorderMode ? t("menu.exitReorder") : t("menu.reorder")}
        </button>
      )}
    </>
  );
};

export default MenuHeader;

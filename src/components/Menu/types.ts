import { SpringValue } from "@react-spring/web";

// 静的メニュー("contact", "create", "login")と動的ページIDの両方を受け入れる
export const VALID_MENU_OPTIONS: string[] = ["contact", "create", "login"];

export interface MenuItem {
  name: string;
  label: string;
  isDynamic?: boolean;
  isDraft?: boolean;
  isSeparator?: boolean;
  isParent?: boolean; // 親メニューかどうかを示すフラグ
  children?: string[]; // 子メニューのIDリスト
}

export interface MenuProps {
  activeMenu: string;
  onMenuClick: (menu: string) => void;
}

// Type for animated styles
export interface AnimatedStyles {
  transform?: SpringValue<string>;
  opacity?: SpringValue<number>;
  y?: SpringValue<number>;
  color?: SpringValue<string>;
}

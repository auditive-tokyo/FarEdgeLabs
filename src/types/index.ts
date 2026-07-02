export interface Content {
  id: string;
  title: string;
  content?: string;
  status?: 'DRAFT' | 'PUBLISHED';
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteConfig {
  id: string;  //常に "pageOrder" などの固定値
  defaultPageId: string; // デフォルトページID
  menuOrder: string[]; // メニューの順序
}
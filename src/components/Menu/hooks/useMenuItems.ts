import { useState, useEffect, useMemo } from "react";
import {
  createContent,
  updateContent,
  deleteContent,
  getAdminContent,
  getAdminContents,
} from "@/api/Content";
import { getAllContents } from "@/api/public";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useT } from "@/i18n";
import { MenuItem } from "../types";

// 親メニューかどうかを検証するヘルパー関数
const isValidParentMenu = (
  page: MenuItem | undefined,
): page is MenuItem & { isParent: true } => {
  return !!page && !!page.isParent;
};

// 親メニューのコンテンツデータをパースするヘルパー関数
interface ParentMenuData {
  isParentMenu: boolean;
  children: string[];
}

const parseParentMenuContent = (
  content: string | undefined,
): ParentMenuData => {
  try {
    return JSON.parse(content || "{}");
  } catch {
    return { isParentMenu: true, children: [] };
  }
};

export const useMenuItems = (isAuthenticated: boolean, isAuthLoading: boolean = false) => {
  const [dynamicPages, setDynamicPages] = useState<MenuItem[]>([]);
  const t = useT();

  // サイト設定フックを使用
  const {
    menuOrder: customOrder,
    defaultPageId: dbDefaultPageId,
    setMenuOrder: setDbMenuOrder,
    setDefaultPage: setDbDefaultPage,
  } = useSiteSettings();

  // 親メニューの子ページリストを更新するヘルパー関数
  const updateParentChildren = (
    parentId: string,
    updatedChildren: string[],
  ) => {
    setDynamicPages((prevPages) =>
      prevPages.map((page) =>
        page.name === parentId ? { ...page, children: updatedChildren } : page,
      ),
    );
  };

  // デフォルトページIDはDB値を直接使用（フォールバック付き）
  const defaultPageId = dbDefaultPageId || "contact";

  // Fetch dynamic pages
  useEffect(() => {
    if (isAuthLoading) return; // auth初期化完了まで待つ

    const fetchPages = async () => {
      try {
        const contents = isAuthenticated
          ? await getAdminContents()
          : await getAllContents();

        const dynamicMenuPages = await Promise.all(
          contents
            .filter(
              (content) =>
                content.status === "PUBLISHED" ||
                (isAuthenticated && content.status === "DRAFT"),
            )
            .map(async (content) => {
              // コンテンツが親メニューかどうかを判定
              let isParent = false;
              let children: string[] = [];

              try {
                // コンテンツからJSON情報を解析
                const contentData = JSON.parse(content.content || "{}");
                isParent = contentData.isParentMenu === true;
                if (isParent && Array.isArray(contentData.children)) {
                  children = contentData.children;
                }
              } catch {
                // JSONのパースに失敗した場合は通常のコンテンツとして扱う
              }

              return {
                name: content.id,
                label:
                  content.status === "DRAFT"
                    ? `${content.title} (Draft)`
                    : content.title,
                isDynamic: true,
                isDraft: content.status === "DRAFT",
                isParent: isParent,
                children: children.length > 0 ? children : undefined,
              };
            }),
        );

        setDynamicPages(dynamicMenuPages);
      } catch (error) {
        console.error("Error fetching pages:", error);
      }
    };

    fetchPages();
  }, [isAuthenticated, isAuthLoading]);

  // Memoize filtered arrays
  const publishedPages = useMemo(
    () => dynamicPages.filter((page) => !page.isDraft),
    [dynamicPages],
  );

  const draftPages = useMemo(
    () => dynamicPages.filter((page) => page.isDraft),
    [dynamicPages],
  );

  // すべての子ページIDのコレクションを作成
  const allChildPages = useMemo(() => {
    const childIds = new Set<string>();
    publishedPages.forEach((page) => {
      if (page.isParent && page.children) {
        page.children.forEach((childId) => childIds.add(childId));
      }
    });
    return childIds;
  }, [publishedPages]);

  // Apply custom order to published pages
  const orderedPublishedPages = useMemo(() => {
    // 子ページでないページのみをフィルタリング
    const mainMenuPages = publishedPages.filter(
      (page) => !allChildPages.has(page.name),
    );

    return [...mainMenuPages].sort((a, b) => {
      const aIndex = customOrder.indexOf(a.name);
      const bIndex = customOrder.indexOf(b.name);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      return 0;
    });
  }, [publishedPages, customOrder, allChildPages]);

  // Construct the complete menu items array
  const menuItems = useMemo(
    () => [
      ...orderedPublishedPages,
      { name: "contact", label: t("contact.title") },
      ...(isAuthenticated
        ? [
            { name: "create", label: "Create Page" },
            ...(draftPages.length > 0
              ? [
                  {
                    name: "drafts-separator",
                    label: "-- DRAFTS --",
                    isDraft: true,
                    isSeparator: true,
                  },
                ]
              : []),
            ...draftPages,
          ]
        : []),
    ],
    [orderedPublishedPages, draftPages, isAuthenticated, t],
  );

  // Function to update custom order
  const updateCustomOrder = async (newOrder: string[]) => {
    await setDbMenuOrder(newOrder);
  };

  const resetCustomOrder = async () => {
    await setDbMenuOrder([]);
  };

  // Add function to set default page
  const setDefaultPage = async (pageId: string) => {
    await setDbDefaultPage(pageId);
  };

  // Add delete menu item function
  const deleteMenuItem = async (pageId: string) => {
    try {
      // If deleting the default page, reset to contact
      if (pageId === defaultPageId) {
        await setDbDefaultPage("contact");
      }

      // Delete from database
      await deleteContent(pageId);

      // Remove from local state
      setDynamicPages((prevPages) =>
        prevPages.filter((page) => page.name !== pageId),
      );

      // Update custom order if needed
      if (customOrder.includes(pageId)) {
        const newOrder = customOrder.filter((id) => id !== pageId);
        await setDbMenuOrder(newOrder);
      }

      return true;
    } catch (error) {
      console.error("Error deleting menu item:", error);
      return false;
    }
  };

  // 親メニュー追加用の関数
  const addMenuItem = async (menuItem: MenuItem): Promise<boolean> => {
    try {
      // 親メニューをコンテンツとして保存
      // コンテンツの内容を準備
      const title = menuItem.label;
      const contentBody = JSON.stringify({
        isParentMenu: true,
        children: menuItem.children || [],
      });

      // DBに保存 - 個別の引数として渡す
      await createContent(
        title, // 第1引数: title
        contentBody, // 第2引数: content (JSONとして親メニュー情報を格納)
        "published", // 第3引数: status
      );

      // ローカルの状態を更新
      setDynamicPages((prevPages) => [...prevPages, menuItem]);

      return true;
    } catch (error) {
      console.error("Error adding menu item:", error);
      return false;
    }
  };

  // 親メニューに子ページを追加する関数
  const addChildToParent = async (
    parentId: string,
    childId: string,
  ): Promise<boolean> => {
    try {
      // 親メニューを見つける
      const parentPage = dynamicPages.find((page) => page.name === parentId);

      if (!isValidParentMenu(parentPage)) {
        console.error("Parent menu not found or not a parent");
        return false;
      }

      // 既存の子ページリストを取得
      const children = parentPage.children || [];

      // 既に子ページになっている場合は何もしない
      if (children.includes(childId)) {
        return true;
      }

      // 子ページリストに追加
      const updatedChildren = [...children, childId];

      // 親メニューのコンテンツを取得して更新
      const parentContent = await getAdminContent(parentId);
      const parentData = parseParentMenuContent(parentContent.content);
      parentData.children = updatedChildren;

      // Firestoreに保存（タイトルを指定せずに元のタイトルを維持）
      await updateContent(
        parentId,
        JSON.stringify(parentData),
        "PUBLISHED",
        parentContent.title,
      );

      // ローカル状態を更新
      updateParentChildren(parentId, updatedChildren);

      // ここからが変更部分: カスタム順序リストから削除
      if (customOrder.includes(childId)) {
        const newOrder = customOrder.filter((id) => id !== childId);
        await setDbMenuOrder(newOrder);
      }

      return true;
    } catch (error) {
      console.error("Error adding child to parent:", error);
      return false;
    }
  };

  // 親メニューから子ページを削除する関数
  const removeChildFromParent = async (
    parentId: string,
    childId: string,
  ): Promise<boolean> => {
    try {
      // 親メニューを見つける
      const parentPage = dynamicPages.find((page) => page.name === parentId);

      if (!isValidParentMenu(parentPage) || !parentPage.children) {
        return false;
      }

      // 子ページリストから削除
      const updatedChildren = parentPage.children.filter(
        (id) => id !== childId,
      );

      // 親メニューのコンテンツを取得して更新
      const parentContent = await getAdminContent(parentId);
      const parentData = parseParentMenuContent(parentContent.content);
      parentData.children = updatedChildren;

      // データベースに保存
      await updateContent(
        parentId,
        JSON.stringify(parentData),
        "PUBLISHED",
        parentContent.title,
      );

      // ローカル状態を更新
      updateParentChildren(parentId, updatedChildren);

      // 子ページをカスタム順序リストに戻す
      // ただし、他の親メニューの子ページになっていないことを確認
      const isChildOfAnotherParent = dynamicPages.some(
        (page) =>
          page.isParent &&
          page.name !== parentId &&
          page.children?.includes(childId),
      );

      if (!isChildOfAnotherParent && !customOrder.includes(childId)) {
        const newOrder = [...customOrder, childId];
        await setDbMenuOrder(newOrder);
      }

      return true;
    } catch (error) {
      console.error("Error removing child from parent:", error);
      return false;
    }
  };

  return {
    menuItems,
    orderedPublishedPages,
    publishedPages, // publishedPagesも返す
    draftPages,
    customOrder,
    defaultPageId, // Expose the default page ID
    updateCustomOrder,
    resetCustomOrder,
    setDefaultPage, // Expose the function to set default page
    deleteMenuItem, // Add this to the return object
    addMenuItem, // 新しい関数を返り値に追加
    addChildToParent, // 新しい関数を返り値に追加
    removeChildFromParent, // 新しい関数を返り値に追加
  };
};

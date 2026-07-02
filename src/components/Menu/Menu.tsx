import React, { useState, useCallback } from "react";
import { useSprings } from "@react-spring/web";
import { useAuth } from "@/auth/AuthContext";
import { DropResult } from "@hello-pangea/dnd";
import { MenuProps, MenuItem } from "./types";
import { useMenuItems } from "./hooks/useMenuItems";
import { MenuToggle } from "./components/MenuToggle";
import { MenuHeader } from "./components/MenuHeader";
import { NormalMenu } from "./components/NormalMenu";
import { ReorderMenu } from "./components/ReorderMenu";

export { VALID_MENU_OPTIONS } from "./types";

export const Menu: React.FC<MenuProps> = ({ activeMenu, onMenuClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(
    new Set(),
  );
  const { isAuthenticated, isAuthLoading, logout } = useAuth();

  const {
    menuItems,
    orderedPublishedPages,
    publishedPages, // publishedPagesもエクスポートする
    updateCustomOrder,
    defaultPageId,
    setDefaultPage,
    deleteMenuItem,
    addMenuItem,
    addChildToParent,
    removeChildFromParent,
  } = useMenuItems(isAuthenticated, isAuthLoading);

  // 親メニューの展開/折りたたみを切り替える関数
  const toggleParentExpansion = useCallback((parentId: string) => {
    setExpandedParents((prevExpanded) => {
      const newSet = new Set(prevExpanded);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source } = result;

      // ドロップ先がない場合は何もしない
      if (!destination) {
        return;
      }

      // 親メニューへのドラッグ＆ドロップは、ReorderMenu内で処理される
      if (
        destination.droppableId.startsWith("parent-") ||
        source.droppableId.startsWith("parent-")
      ) {
        return;
      }

      // 通常のメニュー順序変更
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const items = [...orderedPublishedPages];
      const [removed] = items.splice(source.index, 1);
      items.splice(destination.index, 0, removed);

      const newOrder = items.map((item) => item.name);
      updateCustomOrder(newOrder);
    },
    [orderedPublishedPages, updateCustomOrder],
  );

  // Menu item click handler
  const handleMenuClick = useCallback(
    (menu: string, isParent: boolean = false) => {
      if (isReorderMode) return;

      // 親メニューの場合は展開/折りたたみを切り替える
      if (isParent) {
        toggleParentExpansion(menu);
      } else {
        onMenuClick(menu);
        setIsOpen(false);
      }
    },
    [isReorderMode, onMenuClick, toggleParentExpansion],
  );

  // Toggle reorder mode
  const toggleReorderMode = useCallback(() => {
    setIsReorderMode((prev) => !prev);
  }, []);

  // Handle logout
  const handleLogout = useCallback(() => {
    logout();
    if (activeMenu === "create") {
      onMenuClick("contact");
    }
    setIsOpen(false);
  }, [logout, activeMenu, onMenuClick]);

  // Add a handler for setting default page
  const handleSetDefaultPage = useCallback(
    (pageId: string) => {
      setDefaultPage(pageId);
    },
    [setDefaultPage],
  );

  // Add handler for deleting menu items
  const handleDeleteMenuItem = useCallback(
    async (pageId: string) => {
      const success = await deleteMenuItem(pageId);

      // If the deleted item was the active menu, navigate to a safe page
      if (success && pageId === activeMenu) {
        onMenuClick("contact"); // Navigate to default fallback page
      }

      return success;
    },
    [deleteMenuItem, activeMenu, onMenuClick],
  );

  // 親メニュー作成ハンドラを追加
  const handleCreateParentMenu = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        const newParentMenu: MenuItem = {
          name: name.toLowerCase().replaceAll(/\s+/g, "-"),
          label: name,
          isDynamic: true,
          isParent: true,
          children: [],
        };

        // addMenuItem関数を呼び出す
        const success = await addMenuItem(newParentMenu);
        return success;
      } catch (error) {
        console.error("Error creating parent menu:", error);
        return false;
      }
    },
    [addMenuItem],
  );

  // 親メニューに子ページを追加するハンドラ
  const handleAddChildToParent = useCallback(
    async (parentId: string, childId: string) => {
      try {
        const success = await addChildToParent(parentId, childId);
        if (!success) {
          alert("Failed to add child page");
        }
        return success;
      } catch (error) {
        console.error("Error adding child to parent:", error);
        return false;
      }
    },
    [addChildToParent],
  );

  // 親メニューから子ページを削除するハンドラ
  const handleRemoveChildFromParent = useCallback(
    async (parentId: string, childId: string) => {
      try {
        const success = await removeChildFromParent(parentId, childId);
        if (!success) {
          alert("Failed to remove child page");
        }
        return success;
      } catch (error) {
        console.error("Error removing child from parent:", error);
        return false;
      }
    },
    [removeChildFromParent],
  );

  // Spring animations
  const springs = useSprings(
    menuItems.length,
    menuItems.map((item) => ({
      transform: activeMenu === item.name ? "scale(1.05)" : "scale(1)",
      opacity: isOpen ? 1 : 0,
      y: isOpen ? 0 : -20,
      color:
        activeMenu === item.name
          ? "rgb(34, 211, 238)"
          : "rgba(255, 255, 255, 0.9)",
      config: { tension: 300, friction: 20 },
    })),
  );

  return (
    <nav className="fixed top-[120px] left-4 z-50">
      <MenuToggle isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />

      <div
        className={`fixed top-0 left-0 h-full w-[400px] bg-black/85 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <MenuHeader
          onClose={() => setIsOpen(false)}
          isReorderMode={isReorderMode}
          toggleReorderMode={toggleReorderMode}
          isAuthenticated={isAuthenticated}
        />

        {isReorderMode ? (
          <ReorderMenu
            orderedPublishedPages={orderedPublishedPages}
            publishedPages={publishedPages} // publishedPagesを渡す
            isAuthenticated={isAuthenticated}
            onDragEnd={handleDragEnd}
            defaultPageId={defaultPageId}
            onSetDefaultPage={handleSetDefaultPage}
            onAddChildToParent={handleAddChildToParent} // 新しいハンドラを渡す
            onRemoveChildFromParent={handleRemoveChildFromParent} // 新しいハンドラを渡す
          />
        ) : (
          <NormalMenu
            menuItems={menuItems}
            springs={springs}
            activeMenu={activeMenu}
            handleMenuClick={handleMenuClick}
            isAuthenticated={isAuthenticated}
            logout={handleLogout}
            onDeleteMenuItem={handleDeleteMenuItem}
            onCreateParentMenu={handleCreateParentMenu}
            expandedParents={expandedParents}
            publishedPages={publishedPages}
          />
        )}
      </div>
    </nav>
  );
};

export default Menu;

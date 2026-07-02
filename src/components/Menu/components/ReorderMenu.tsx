import React, { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { MenuItem } from "../types";

// ドラッグ可能なメニュー項目のクラス名を生成
const getDraggableClassName = (
  item: MenuItem,
  defaultPageId: string,
  isDragging: boolean,
) => {
  const baseClasses =
    "relative px-4 py-2 text-menu bg-gray-800/50 rounded text-white w-[90%] flex flex-col";
  const dragClass = isDragging
    ? "cursor-grabbing shadow-lg"
    : "cursor-grab hover:bg-gray-700/30";

  let borderClass = "border-cyan-500";
  if (item.isParent) {
    borderClass = "border-purple-500";
  } else if (item.name === defaultPageId) {
    borderClass = "border-amber-500";
  }

  return `${baseClasses} ${dragClass} border-l-4 ${borderClass}`;
};

// デフォルト設定ボタンのクラス名を生成
const getDefaultButtonClassName = (isDefault: boolean) => {
  return isDefault
    ? "bg-amber-600 text-white"
    : "bg-gray-600 hover:bg-amber-600 text-gray-300 hover:text-white";
};

// 子ページ項目コンポーネント
interface ChildPageItemProps {
  childId: string;
  childPage: MenuItem;
  defaultPageId: string;
  parentName: string;
  onSetDefaultPage: (pageId: string) => void;
  onRemoveChild: (parentId: string, childId: string) => void;
}

const ChildPageItem: React.FC<ChildPageItemProps> = ({
  childId,
  childPage,
  defaultPageId,
  parentName,
  onSetDefaultPage,
  onRemoveChild,
}) => (
  <div
    className={`flex items-center justify-between py-1 px-2 
               bg-gray-700/50 hover:bg-gray-700 
               rounded text-sm border-l-2 
               ${
                 childId === defaultPageId
                   ? "border-amber-500"
                   : "border-cyan-500/50"
               }`}
  >
    <span>{childPage.label}</span>
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSetDefaultPage(childId);
        }}
        className={`text-xs px-1.5 py-0.5 rounded ${getDefaultButtonClassName(
          childId === defaultPageId,
        )}`}
      >
        {childId === defaultPageId ? "Default" : "Set"}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemoveChild(parentName, childId);
        }}
        className="text-xs text-red-400 hover:text-red-300 hover:bg-gray-600 p-1 rounded"
      >
        Remove
      </button>
    </div>
  </div>
);

// ドラッグ可能なメニュー項目コンポーネント
interface DraggableMenuItemProps {
  item: MenuItem;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  defaultPageId: string;
  selectedItemId: string | null;
  publishedPages: MenuItem[];
  orderedPublishedPages: MenuItem[];
  parentMenus: MenuItem[];
  onSetDefaultPage: (pageId: string) => void;
  onSelectItem: (itemName: string | null) => void;
  onAddToParent: (parentId: string, childId: string) => void;
  onRemoveChild: (parentId: string, childId: string) => void;
}

const DraggableMenuItem: React.FC<DraggableMenuItemProps> = ({
  item,
  provided,
  snapshot,
  defaultPageId,
  selectedItemId,
  publishedPages,
  orderedPublishedPages,
  parentMenus,
  onSetDefaultPage,
  onSelectItem,
  onAddToParent,
  onRemoveChild,
}) => {
  const handleToggleSelect = () => {
    onSelectItem(item.name === selectedItemId ? null : item.name);
  };

  const handleAddChildAndClear = (parentId: string, childId: string) => {
    onAddToParent(parentId, childId);
    onSelectItem(null);
  };

  return (
    <li
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={getDraggableClassName(
        item,
        defaultPageId,
        snapshot.isDragging,
      )}
      data-id={item.name}
    >
      <button
        type="button"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
        onClick={handleToggleSelect}
        aria-label={`Select ${item.label}`}
      />
      <div className="flex items-center justify-between w-full relative z-10">
        <div className="flex items-center w-full">
          <span
            className="mr-2 px-1 py-1 bg-gray-700 rounded cursor-grab"
            {...provided.dragHandleProps}
          >
            ≡
          </span>
          {item.isParent ? (
            <span className="font-bold text-purple-300">
              {item.label} (Parent)
            </span>
          ) : (
            <span>{item.label}</span>
          )}
        </div>

        {!item.isParent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetDefaultPage(item.name);
            }}
            className={`ml-2 px-2 py-1 text-xs rounded ${getDefaultButtonClassName(
              item.name === defaultPageId,
            )}`}
          >
            {item.name === defaultPageId ? "Default" : "Set as Default"}
          </button>
        )}
      </div>

      {/* 親メニューの場合、子ページリストを表示 */}
      {item.isParent && (
        <div className="mt-2 border-l-2 border-purple-500/50 pl-2 relative z-10">
          <p className="text-xs text-gray-400 mb-2 font-bold">Child pages:</p>

          {item.children && item.children.length > 0 ? (
            <div className="space-y-1 mb-2">
              {item.children.map((childId) => {
                const childPage = publishedPages.find(
                  (p) => p.name === childId,
                );
                if (!childPage) return null;
                return (
                  <ChildPageItem
                    key={childId}
                    childId={childId}
                    childPage={childPage}
                    defaultPageId={defaultPageId}
                    parentName={item.name}
                    onSetDefaultPage={onSetDefaultPage}
                    onRemoveChild={onRemoveChild}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic mb-2">
              No child pages yet
            </p>
          )}

          {selectedItemId &&
            selectedItemId !== item.name &&
            !item.children?.includes(selectedItemId) && (
              <div className="mt-1 p-2 bg-purple-900/30 border border-purple-500/50 rounded">
                <p className="text-xs text-gray-300 mb-1">
                  Selected:{" "}
                  {
                    orderedPublishedPages.find((p) => p.name === selectedItemId)
                      ?.label
                  }
                </p>
                <button
                  onClick={() =>
                    handleAddChildAndClear(item.name, selectedItemId)
                  }
                  className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded w-full"
                >
                  Add as child page
                </button>
              </div>
            )}
        </div>
      )}

      {/* 通常のページの場合で、選択中かつ親メニューがある場合 */}
      {!item.isParent &&
        selectedItemId === item.name &&
        parentMenus.length > 0 && (
          <div className="mt-2 border-l-2 border-cyan-500/50 pl-2 relative z-10">
            <p className="text-xs text-gray-400 mb-1">Add to parent menu:</p>
            <div className="space-y-1 mb-2">
              {parentMenus
                .filter((parent) => !parent.children?.includes(item.name))
                .map((parent) => (
                  <button
                    key={parent.name}
                    onClick={() =>
                      handleAddChildAndClear(parent.name, item.name)
                    }
                    className="flex items-center justify-between py-1 px-2 w-full
                         bg-gray-700/50 hover:bg-purple-700/50 
                         rounded text-sm border-l-2 border-purple-500/50
                         text-left"
                  >
                    <span>Add to {parent.label}</span>
                    <span className="text-xs">→</span>
                  </button>
                ))}
            </div>
          </div>
        )}
    </li>
  );
};

interface ReorderMenuProps {
  orderedPublishedPages: MenuItem[];
  publishedPages: MenuItem[];
  isAuthenticated: boolean;
  onDragEnd: (result: DropResult) => void;
  defaultPageId: string;
  onSetDefaultPage: (pageId: string) => void;
  onAddChildToParent?: (parentId: string, childId: string) => Promise<boolean>;
  onRemoveChildFromParent?: (
    parentId: string,
    childId: string,
  ) => Promise<boolean>;
}

export const ReorderMenu: React.FC<ReorderMenuProps> = ({
  orderedPublishedPages,
  publishedPages,
  isAuthenticated,
  onDragEnd,
  defaultPageId,
  onSetDefaultPage,
  onAddChildToParent,
  onRemoveChildFromParent,
}) => {
  // 選択中の項目を追跡するための状態
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // 親メニュー一覧を取得
  const parentMenus = orderedPublishedPages.filter((page) => page.isParent);

  // 子ページ削除処理
  const handleRemoveChildPage = async (parentId: string, childId: string) => {
    if (!onRemoveChildFromParent) return;

    try {
      await onRemoveChildFromParent(parentId, childId);
    } catch (error) {
      console.error("Error removing child page:", error);
      alert("An error occurred while removing child page");
    }
  };

  // 子ページに追加ボタン処理
  const handleAddToParent = async (parentId: string, childId: string) => {
    if (!onAddChildToParent) return;
    try {
      await onAddChildToParent(parentId, childId);
    } catch (error) {
      console.error("Error adding child page:", error);
    }
  };

  return (
    <div className="h-full pt-[80px] pb-20 overflow-y-auto">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="menu-items">
          {(provided, snapshot) => (
            <ul
              className={`flex flex-col items-start pl-12 gap-4 
                        ${snapshot.isDraggingOver ? "bg-gray-800/30" : ""}`}
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {orderedPublishedPages.length > 0 ? (
                orderedPublishedPages.map((item, index) => (
                  <Draggable
                    key={item.name}
                    draggableId={item.name}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <DraggableMenuItem
                        item={item}
                        provided={provided}
                        snapshot={snapshot}
                        defaultPageId={defaultPageId}
                        selectedItemId={selectedItemId}
                        publishedPages={publishedPages}
                        orderedPublishedPages={orderedPublishedPages}
                        parentMenus={parentMenus}
                        onSetDefaultPage={onSetDefaultPage}
                        onSelectItem={setSelectedItemId}
                        onAddToParent={handleAddToParent}
                        onRemoveChild={handleRemoveChildPage}
                      />
                    )}
                  </Draggable>
                ))
              ) : (
                <li className="text-gray-400">公開ページがありません</li>
              )}
              {provided.placeholder}

              {/* Static items and reset buttons */}
              <li className="opacity-50 px-4 py-2 text-gray-400 mt-6">
                Static pages:
              </li>
              <li
                className={`opacity-75 px-4 py-2 text-gray-300 flex items-center justify-between border-l-4 ${
                  defaultPageId === "contact"
                    ? "border-amber-500"
                    : "border-gray-600"
                }`}
              >
                <div className="flex items-center">
                  <span>Contact</span>
                  {defaultPageId === "contact" && (
                    <span className="ml-2 text-amber-500 text-xs font-bold">
                      (DEFAULT)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onSetDefaultPage("contact")}
                  className={`ml-2 px-2 py-1 text-xs rounded ${getDefaultButtonClassName(
                    defaultPageId === "contact",
                  )}`}
                >
                  {defaultPageId === "contact" ? "Default" : "Set as Default"}
                </button>
              </li>
              {isAuthenticated && (
                <li className="opacity-50 px-4 py-2 text-gray-400">
                  - Create Page (cannot be set as default)
                </li>
              )}

              <li className="mt-8 flex gap-2">
                {selectedItemId && (
                  <button
                    onClick={() => setSelectedItemId(null)}
                    className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded transition-colors"
                  >
                    Deselect
                  </button>
                )}
              </li>
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default ReorderMenu;

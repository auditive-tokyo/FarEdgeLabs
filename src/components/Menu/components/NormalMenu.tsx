import React, { useState } from 'react';
import { SpringValues } from '@react-spring/web';
import { AnimatedLi } from './AnimatedLi';
import { MenuItem } from '../types';

interface MenuSpringProps {
  transform: string;
  opacity: number;
  y: number;
  color: string;
}

// 削除確認ダイアログコンポーネント
interface DeleteConfirmDialogProps {
  label: string;
  isDeleting: boolean;
  onConfirm: (e: React.MouseEvent) => void;
  onCancel: (e: React.MouseEvent) => void;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  label,
  isDeleting,
  onConfirm,
  onCancel,
}) => (
  <div className="absolute left-full ml-2 top-0 bg-gray-800 p-3 rounded shadow-lg z-10 w-[200px]">
    <p className="text-sm mb-2">Delete "{label}"?</p>
    <div className="flex gap-2">
      <button
        onClick={onConfirm}
        disabled={isDeleting}
        className="px-2 py-1 bg-red-500 text-white text-xs rounded"
      >
        {isDeleting ? 'Deleting...' : 'Yes, delete'}
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-1 bg-gray-600 text-white text-xs rounded"
      >
        Cancel
      </button>
    </div>
  </div>
);

// 削除ボタンコンポーネント
interface DeleteButtonProps {
  label: string;
  onClick: (e: React.MouseEvent) => void;
}

const DeleteButton: React.FC<DeleteButtonProps> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="opacity-0 group-hover:opacity-100 w-5 h-5 ml-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs transition-opacity"
    aria-label={`Delete ${label}`}
  >
    ✕
  </button>
);

// 子メニュー項目コンポーネント
interface ChildMenuItemProps {
  childItem: MenuItem;
  childId: string;
  activeMenu: string;
  isAuthenticated: boolean;
  confirmDelete: string | null;
  isDeleting: boolean;
  onMenuClick: () => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  onDeleteConfirm: (e: React.MouseEvent) => void;
  onDeleteCancel: (e: React.MouseEvent) => void;
}

const ChildMenuItem: React.FC<ChildMenuItemProps> = ({
  childItem,
  childId,
  activeMenu,
  isAuthenticated,
  confirmDelete,
  isDeleting,
  onMenuClick,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}) => (
  <button
    onClick={onMenuClick}
    type="button"
    className={`
      block w-full text-left
      px-4 py-2 text-menu
      cursor-pointer
      text-gray-300 hover:text-white
      ${activeMenu === childId ? 'text-cyan-400' : ''}
      transition-colors duration-200
      group relative
    `}
  >
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center">
        <span>{childItem.label}</span>
      </div>
      {isAuthenticated && (
        <DeleteButton label={childItem.label} onClick={onDeleteClick} />
      )}
    </div>
    {confirmDelete === childId && (
      <DeleteConfirmDialog
        label={childItem.label}
        isDeleting={isDeleting}
        onConfirm={onDeleteConfirm}
        onCancel={onDeleteCancel}
      />
    )}
  </button>
);

// 親メニュー作成UIコンポーネント
interface ParentMenuCreatorProps {
  showInput: boolean;
  menuName: string;
  isCreating: boolean;
  onMenuNameChange: (value: string) => void;
  onCreate: () => void;
  onShowInput: () => void;
  onCancel: () => void;
}

const ParentMenuCreator: React.FC<ParentMenuCreatorProps> = ({
  showInput,
  menuName,
  isCreating,
  onMenuNameChange,
  onCreate,
  onShowInput,
  onCancel,
}) => (
  <li className="mt-4">
    {showInput ? (
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={menuName}
          onChange={(e) => onMenuNameChange(e.target.value)}
          placeholder="Parent menu name"
          className="px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded focus:border-cyan-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={onCreate}
            disabled={isCreating || !menuName.trim()}
            className="px-3 py-1 bg-cyan-600 text-white rounded hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <button
        onClick={onShowInput}
        className="px-4 py-2 text-cyan-500 hover:text-cyan-400 transition-colors"
      >
        Create Parent Menu
      </button>
    )}
  </li>
);

interface NormalMenuProps {
  menuItems: MenuItem[];
  springs: SpringValues<MenuSpringProps>[];
  activeMenu: string;
  handleMenuClick: (menu: string, isParent?: boolean) => void;
  isAuthenticated: boolean;
  logout: () => void;
  onDeleteMenuItem: (pageId: string) => Promise<boolean>;
  onCreateParentMenu?: (name: string) => Promise<boolean>;
  expandedParents: Set<string>;
  publishedPages: MenuItem[];
}

export const NormalMenu: React.FC<NormalMenuProps> = ({
  menuItems,
  springs,
  activeMenu,
  handleMenuClick,
  isAuthenticated,
  logout,
  onDeleteMenuItem,
  onCreateParentMenu,
  expandedParents,
  publishedPages
}) => {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showParentMenuInput, setShowParentMenuInput] = useState(false);
  const [parentMenuName, setParentMenuName] = useState('');
  const [isCreatingParent, setIsCreatingParent] = useState(false);
  
  const handleDelete = async (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation(); // Prevent menu click
    
    setIsDeleting(true);
    try {
      const success = await onDeleteMenuItem(pageId);
      if (success) {
        setConfirmDelete(null);
      } else {
        alert('Failed to delete page');
      }
    } catch (error) {
      console.error('Error deleting page:', error);
      alert('An error occurred while deleting the page');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // 親メニュー作成処理ハンドラ
  const handleCreateParentMenu = async () => {
    if (!parentMenuName.trim() || !onCreateParentMenu) return;
    
    setIsCreatingParent(true);
    try {
      const success = await onCreateParentMenu(parentMenuName);
      if (success) {
        setParentMenuName('');
        setShowParentMenuInput(false);
      } else {
        alert('Failed to create parent menu');
      }
    } catch (error) {
      console.error('Error creating parent menu:', error);
      alert('An error occurred while creating the parent menu');
    } finally {
      setIsCreatingParent(false);
    }
  };
  
  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(null);
  };

  // メニュー項目のclassNameを生成するヘルパー関数
  const getMenuItemClassName = (item: MenuItem) => {
    const baseClasses = 'relative px-4 py-2 text-menu';
    const cursorClass = item.isSeparator ? 'cursor-default' : 'cursor-pointer';
    const dynamicClass = item.isDynamic ? 'text-gray-300' : '';
    const draftClass = item.isDraft && !item.isSeparator ? 'text-amber-400' : '';
    const separatorClass = item.isSeparator ? 'text-gray-500 text-sm font-bold' : '';
    const beforeClasses = 'before:absolute before:left-0 before:bottom-0 before:w-full before:h-[1px] before:bg-cyan-400 before:transform before:scale-x-0 before:transition-transform before:duration-300';
    const hoverClass = item.isSeparator ? '' : 'hover:before:scale-x-100';
    const activeClass = activeMenu === item.name && !item.isSeparator ? 'before:scale-x-100' : '';
    
    return `${baseClasses} ${cursorClass} ${dynamicClass} ${draftClass} ${separatorClass} ${beforeClasses} ${hoverClass} ${activeClass} group`;
  };

  // 展開アイコンを取得するヘルパー関数
  const getExpandIcon = (itemName: string) => expandedParents.has(itemName) ? '▼' : '►';
  
  return (
    <ul className="h-full flex flex-col items-start pl-12 gap-4 pt-[120px]">
      {menuItems.map((item, index) => (
        <React.Fragment key={item.name}>
          <AnimatedLi
            onClick={item.isSeparator ? undefined : () => handleMenuClick(item.name, item.isParent)}
            className={getMenuItemClassName(item)}
            style={springs[index]}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                {item.isParent && (
                  <span className="mr-2 text-gray-400 transform transition-transform">
                    {getExpandIcon(item.name)}
                  </span>
                )}
                <span>{item.label}</span>
              </div>

              {isAuthenticated && item.isDynamic && (
                <DeleteButton
                  label={item.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(item.name);
                  }}
                />
              )}
            </div>
            
            {confirmDelete === item.name && (
              <DeleteConfirmDialog
                label={item.label}
                isDeleting={isDeleting}
                onConfirm={(e) => handleDelete(e, item.name)}
                onCancel={handleCancelDelete}
              />
            )}
          </AnimatedLi>
          
          {item.isParent && item.children && expandedParents.has(item.name) && (
            <div className="ml-10 border-l-2 border-purple-500/30 pl-2 space-y-2">
              {item.children.map(childId => {
                const childItem = publishedPages.find(p => p.name === childId);
                if (!childItem) return null;
                
                return (
                  <ChildMenuItem
                    key={childId}
                    childItem={childItem}
                    childId={childId}
                    activeMenu={activeMenu}
                    isAuthenticated={isAuthenticated}
                    confirmDelete={confirmDelete}
                    isDeleting={isDeleting}
                    onMenuClick={() => handleMenuClick(childId)}
                    onDeleteClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(childId);
                    }}
                    onDeleteConfirm={(e) => handleDelete(e, childId)}
                    onDeleteCancel={handleCancelDelete}
                  />
                );
              })}
            </div>
          )}
        </React.Fragment>
      ))}
      
      {isAuthenticated && (
        <ParentMenuCreator
          showInput={showParentMenuInput}
          menuName={parentMenuName}
          isCreating={isCreatingParent}
          onMenuNameChange={setParentMenuName}
          onCreate={handleCreateParentMenu}
          onShowInput={() => setShowParentMenuInput(true)}
          onCancel={() => {
            setShowParentMenuInput(false);
            setParentMenuName('');
          }}
        />
      )}
      
      {isAuthenticated && (
        <li className="mt-8">
          <button
            onClick={logout}
            className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors"
          >
            LOGOUT
          </button>
        </li>
      )}
    </ul>
  );
};

export default NormalMenu;
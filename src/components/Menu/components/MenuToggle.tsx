import React from 'react';

interface MenuToggleProps {
  isOpen: boolean;
  onClick: () => void;
}

export const MenuToggle: React.FC<MenuToggleProps> = ({ isOpen, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="p-3 bg-black/30 rounded-md"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
    >
      <div className={`w-8 h-[3px] bg-white rounded-full transition-all duration-300 ${
        isOpen ? 'rotate-45 translate-y-[10px]' : ''
      }`} />
      <div className={`w-8 h-[3px] bg-white rounded-full my-[7px] transition-opacity ${
        isOpen ? 'opacity-0' : 'opacity-100'
      }`} />
      <div className={`w-8 h-[3px] bg-white rounded-full transition-all duration-300 ${
        isOpen ? '-rotate-45 -translate-y-[10px]' : ''
      }`} />
    </button>
  );
};

export default MenuToggle;
import React from 'react';

interface ActionButtonsProps {
  isLoading: boolean;
  onSubmit: (status: 'draft' | 'published') => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ isLoading, onSubmit }) => (
  <div className="flex gap-4">
    <button
      type="button"
      onClick={() => onSubmit('draft')}
      disabled={isLoading}
      className="flex-1 bg-gray-500 text-white px-4 py-2 rounded disabled:bg-gray-700"
    >
      {isLoading ? 'Saving...' : 'Save as Draft'}
    </button>
    <button
      type="button"
      onClick={() => onSubmit('published')}
      disabled={isLoading}
      className="flex-1 bg-cyan-500 text-white px-4 py-2 rounded disabled:bg-gray-700"
    >
      {isLoading ? 'Publishing...' : 'Publish'}
    </button>
  </div>
);
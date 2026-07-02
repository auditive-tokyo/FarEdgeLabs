import { useState } from 'react';
import { useSubmitContent } from './useSubmitContent';

interface UseCreateContentReturn {
  title: string;
  content: string;
  isLoading: boolean;
  setTitle: (title: string) => void;
  setContent: (content: string) => void;
  handleSubmit: (status: 'draft' | 'published') => Promise<void>;
}

export const useCreateContent = (): UseCreateContentReturn => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { handleSubmit } = useSubmitContent({
    title,
    content,
    setTitle,
    setContent,
    setIsLoading
  });

  return {
    title,
    content,
    isLoading,
    setTitle,
    setContent,
    handleSubmit
  };
};
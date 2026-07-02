import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { getAdminContent } from "@/api/Content";
import { getContent as getPublicContent } from "@/api/public";
import { Content } from "@/types";
import { useAuth } from "@/auth/AuthContext";
import { markdownComponents } from "../shared/markdownComponents";
const EditContent = lazy(() => import("../EditContent/EditContent"));

interface ShowContentProps {
  id: string;
  onNotFound?: () => void;
}

const ShowContent: React.FC<ShowContentProps> = ({ id, onNotFound }) => {
  const [content, setContent] = useState<Content | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false); // 編集モードの状態管理
  const { isAuthenticated, isAuthLoading } = useAuth();
  const onNotFoundRef = useRef(onNotFound);
  useEffect(() => {
    onNotFoundRef.current = onNotFound;
  }, [onNotFound]);

  useEffect(() => {
    if (isAuthLoading) return; // auth初期化完了まで待つ

    const fetchContent = async () => {
      setIsLoading(true);
      setContent(null);
      try {
        const data = isAuthenticated
          ? await getAdminContent(id)
          : await getPublicContent(id);
        setContent(data);
      } catch (error) {
        if (
          !isAuthenticated &&
          error instanceof Error &&
          error.message.includes("404")
        ) {
          // DRAFT content is not publicly available - fall back silently
          onNotFoundRef.current?.();
        } else {
          console.error("Error fetching content:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [id, isAuthenticated, isAuthLoading]);

  // 編集モードの切り替え
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
  };

  // 編集完了後のコールバック
  const handleEditComplete = (updatedContent: Content) => {
    setContent(updatedContent);
    setIsEditing(false);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!content) {
    return <div>Content not found</div>;
  }

  // 編集モードの場合は編集フォームを表示
  if (isEditing) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <EditContent
          content={content}
          onComplete={handleEditComplete}
          onCancel={() => setIsEditing(false)}
        />
      </Suspense>
    );
  }

  return (
    <div className="content-wrapper">
      {/* タイトルとボタンを含むコンテナ */}
      <div className="relative text-center mb-6">
        <h1 className="inline-block">{content.title}</h1>

        {/* 認証済みの場合のみ編集ボタンを表示（右上に配置） */}
        {isAuthenticated && (
          <button
            onClick={toggleEditMode}
            className="absolute right-0 top-0 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      <div className="prose prose-invert max-w-none">
        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {content.content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default ShowContent;

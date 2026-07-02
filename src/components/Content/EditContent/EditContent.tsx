import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { updateContent } from "@/api/Content";
import { Content } from "@/types";
import { markdownComponents, checkForH1 } from "../shared/markdownComponents";

interface EditContentProps {
  content: Content;
  onComplete: (updatedContent: Content) => void;
  onCancel: () => void;
}

const EditContent: React.FC<EditContentProps> = ({
  content,
  onComplete,
  onCancel,
}) => {
  const [title, setTitle] = useState(content.title);
  const [contentText, setContentText] = useState(content.content || "");
  const [preview, setPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContentText(newContent);
    setShowWarning(checkForH1(newContent));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // 現在のステータスを維持
      const status = content.status || "PUBLISHED";
      const updatedContent = await updateContent(
        content.id,
        contentText,
        status,
        title,
      );
      onComplete(updatedContent);
    } catch (error) {
      console.error("Error updating content:", error);
      alert("Failed to update content");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="content-wrapper">
      <h2 className="mb-4">Edit Page</h2>
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setPreview(false)}
          className={`px-4 py-2 rounded ${
            preview ? "bg-gray-700" : "bg-cyan-500"
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setPreview(true)}
          className={`px-4 py-2 rounded ${
            preview ? "bg-cyan-500" : "bg-gray-700"
          }`}
        >
          Preview
        </button>
      </div>

      {preview ? (
        <div className="flex flex-col gap-4">
          <div className="preview-content bg-gray-800 p-4 rounded">
            <h1 className="mb-4">{title}</h1>
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {contentText}
              </ReactMarkdown>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 bg-cyan-500 text-white px-4 py-2 rounded disabled:bg-gray-700"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded disabled:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page Title"
            className="p-2 bg-gray-800 text-white rounded"
            required
          />
          <div className="relative">
            <textarea
              value={contentText}
              onChange={handleContentChange}
              placeholder="Content (Markdown supported)"
              className="p-2 bg-gray-800 text-white rounded min-h-[400px] font-mono w-full"
              required
            />
            {showWarning && (
              <div className="absolute top-0 right-0 bg-red-500 text-white px-3 py-1 rounded m-2 text-sm">
                Please use the title field for main headings instead of # or
                &lt;h1&gt;
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 bg-cyan-500 text-white px-4 py-2 rounded disabled:bg-gray-700"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded disabled:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditContent;

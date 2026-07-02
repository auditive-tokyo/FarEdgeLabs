import { useCallback } from "react";
import { createContent } from "@/api/Content";

interface UseSubmitContentProps {
  title: string;
  content: string;
  setTitle: (title: string) => void;
  setContent: (content: string) => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const useSubmitContent = ({
  title,
  content,
  setTitle,
  setContent,
  setIsLoading,
}: UseSubmitContentProps) => {
  const handleSubmit = useCallback(
    async (status: "draft" | "published") => {
      setIsLoading(true);
      try {
        await createContent(title, content, status);
        alert(
          `Content ${
            status === "draft" ? "saved as draft" : "published"
          } successfully!`,
        );
        setTitle("");
        setContent("");
      } catch (error) {
        console.error("Error creating content:", error);
        alert("Failed to create content");
      } finally {
        setIsLoading(false);
      }
    },
    [title, content, setTitle, setContent, setIsLoading],
  );

  return { handleSubmit };
};

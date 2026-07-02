import { Content } from "@/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const getContent = async (id: string): Promise<Content> => {
  // contents/{id}.md は markdown をそのまま返すため text として読む
  // メタデータ（title など）は contents-list.json から取得
  const [mdRes, listRes] = await Promise.all([
    fetch(`${BASE_URL}/contents/${id}`),
    fetch(`${BASE_URL}/contents`),
  ]);
  if (!mdRes.ok) throw new Error(`Failed to fetch content: ${mdRes.status}`);
  if (!listRes.ok)
    throw new Error(`Failed to fetch contents list: ${listRes.status}`);

  const markdown = await mdRes.text();
  const list = (await listRes.json()) as Content[];
  const meta = list.find((c) => c.id === id);

  return {
    id,
    title: meta?.title ?? "",
    content: markdown,
    status: meta?.status ?? "PUBLISHED",
    createdAt: meta?.createdAt,
    updatedAt: meta?.updatedAt,
  };
};

export const getAllContents = async (): Promise<Content[]> => {
  const res = await fetch(`${BASE_URL}/contents`);
  if (!res.ok) throw new Error(`Failed to fetch contents: ${res.status}`);
  return (await res.json()) as Content[];
};

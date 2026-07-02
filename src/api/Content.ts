import { Content } from "@/types";
import { requireAuthHeaders } from "./auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const createContent = async (
  title: string,
  content: string,
  status: "draft" | "published" = "draft",
): Promise<Content> => {
  const headers = await requireAuthHeaders();
  const res = await fetch(`${BASE_URL}/admin/contents`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title, content, status: status.toUpperCase() }),
  });
  if (!res.ok) throw new Error(`Failed to create content: ${res.status}`);
  return (await res.json()) as Content;
};

export const updateContent = async (
  id: string,
  content: string,
  status: string,
  title: string,
): Promise<Content> => {
  const headers = await requireAuthHeaders();
  const res = await fetch(`${BASE_URL}/admin/contents/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ content, status, title }),
  });
  if (!res.ok) throw new Error(`Failed to update content: ${res.status}`);
  return (await res.json()) as Content;
};

export const deleteContent = async (id: string): Promise<string> => {
  const headers = await requireAuthHeaders();
  const res = await fetch(`${BASE_URL}/admin/contents/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`Failed to delete content: ${res.status}`);
  return id;
};

export const getAdminContent = async (id: string): Promise<Content> => {
  const headers = await requireAuthHeaders();
  const res = await fetch(`${BASE_URL}/admin/contents/${id}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch content: ${res.status}`);
  return (await res.json()) as Content;
};

export const getAdminContents = async (): Promise<Content[]> => {
  const headers = await requireAuthHeaders();
  const res = await fetch(`${BASE_URL}/admin/contents`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch contents: ${res.status}`);
  return (await res.json()) as Content[];
};

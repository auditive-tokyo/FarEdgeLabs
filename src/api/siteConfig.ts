import { SiteConfig } from "@/types";
import { requireAuthHeaders } from "./auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const getSiteConfig = async (): Promise<SiteConfig> => {
  const res = await fetch(`${BASE_URL}/site-config`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to fetch site config: ${res.status}`);
  return (await res.json()) as SiteConfig;
};

export const updateSiteConfig = async (
  id: string,
  defaultPageId?: string,
  menuOrder?: string[],
): Promise<SiteConfig> => {
  const body: { id: string; defaultPageId?: string; menuOrder?: string[] } = {
    id,
  };
  if (defaultPageId !== undefined) body.defaultPageId = defaultPageId;
  if (menuOrder !== undefined) body.menuOrder = menuOrder;

  const headers = await requireAuthHeaders();
  const res = await fetch(`${BASE_URL}/admin/site-config`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to update site config: ${res.status}`);
  return (await res.json()) as SiteConfig;
};

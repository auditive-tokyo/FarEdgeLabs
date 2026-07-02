import { useState, useEffect, useCallback } from "react";
import { SiteConfig } from "@/types";
import {
  getSiteConfig,
  updateSiteConfig as updateSiteConfigApi,
} from "@/api/siteConfig";

export const useSiteSettings = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [defaultPageId, setDefaultPageId] = useState<string | null>(null); // nullで開始

  // サイト設定を更新する（内部用）
  const updateSiteConfigInternal = useCallback(
    async (id: string, newDefaultPageId?: string, newMenuOrder?: string[]) => {
      const updated = await updateSiteConfigApi(
        id,
        newDefaultPageId,
        newMenuOrder,
      );
      setSiteConfig(updated);
      if (newDefaultPageId !== undefined) {
        setDefaultPageId(newDefaultPageId);
      }
      return updated;
    },
    [],
  );

  // サイト設定を取得する
  const fetchSiteConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getSiteConfig();
      setSiteConfig(data);
      if (data.defaultPageId) {
        setDefaultPageId(data.defaultPageId);
      }
    } catch (error) {
      console.error("Error fetching site config:", error);
      // エラー時は初期設定を作成
      try {
        await updateSiteConfigInternal("siteConfig", "contact", []);
      } catch (createError) {
        console.error("Error creating initial site config:", createError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [updateSiteConfigInternal]);

  // ページ読み込み時にサイト設定を取得
  useEffect(() => {
    fetchSiteConfig();
  }, [fetchSiteConfig]);

  // サイト設定を更新する（外部API用）
  const updateSiteConfig = useCallback(
    async (id: string, newDefaultPageId?: string, newMenuOrder?: string[]) => {
      try {
        await updateSiteConfigInternal(id, newDefaultPageId, newMenuOrder);
        return true;
      } catch (error) {
        console.error("Error updating site config:", error);
        return false;
      }
    },
    [updateSiteConfigInternal],
  );

  // デフォルトページIDを設定する
  const setDefaultPage = useCallback(
    async (pageId: string) => {
      return await updateSiteConfig("siteConfig", pageId);
    },
    [updateSiteConfig],
  );

  // メニュー順序を設定する
  const setMenuOrder = useCallback(
    async (menuOrder: string[]) => {
      return await updateSiteConfig("siteConfig", undefined, menuOrder);
    },
    [updateSiteConfig],
  );

  return {
    isLoading,
    defaultPageId,
    menuOrder: siteConfig?.menuOrder || [],
    setDefaultPage,
    setMenuOrder,
  };
};

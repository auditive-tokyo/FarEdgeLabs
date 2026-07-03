import React, { useState, useEffect } from "react";
import Footer from "./components/Footer";
import Header from "./components/Header";
import MainContent from "./components/MainContent";
import { Menu, VALID_MENU_OPTIONS } from "./components/Menu/Menu";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import PrivateRoute from "./auth/PrivateRoute";
import Login from "./components/Content/Login/Login";
import CyberCursor from "./components/CyberCursor/CyberCursor";
import { useSiteSettings } from "./hooks/useSiteSettings";
import { getAllContents } from "./api/public";
import { useT } from "@/i18n";
import { useDocumentMeta } from "@/i18n/useDocumentMeta";

const SECRET_LOGIN_HASH = "#fxxking-login";

const STATIC_MENUS = new Set(VALID_MENU_OPTIONS.filter((m) => m !== "login"));

const AppContent: React.FC = () => {
  useDocumentMeta();
  const t = useT();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { defaultPageId, isLoading } = useSiteSettings();
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);
  const [showSecretLogin, setShowSecretLogin] = useState(false);
  // 非認証かつdynamic IDの場合のみ、公開一覧で検証した結果を保持
  const [asyncValidatedId, setAsyncValidatedId] = useState<string | null>(null);

  // ハッシュ変更を監視
  useEffect(() => {
    const checkHash = () => {
      if (globalThis.location.hash === SECRET_LOGIN_HASH) {
        setShowSecretLogin(true);
        globalThis.history.replaceState(null, "", globalThis.location.pathname);
      }
    };
    checkHash();
    globalThis.addEventListener("hashchange", checkHash);
    return () => globalThis.removeEventListener("hashchange", checkHash);
  }, []);

  // 非認証かつdynamic IDの場合のみ公開一覧を取得して検証（非同期のみ）
  useEffect(() => {
    if (isAuthLoading || !defaultPageId) return;
    if (isAuthenticated || STATIC_MENUS.has(defaultPageId)) return;

    getAllContents()
      .then((contents) => {
        const publishedIds = new Set(contents.map((c) => c.id));
        setAsyncValidatedId(
          publishedIds.has(defaultPageId) ? defaultPageId : "contact",
        );
      })
      .catch(() => setAsyncValidatedId("contact"));
  }, [defaultPageId, isAuthenticated, isAuthLoading]);

  // defaultPageIdの検証（同期ケースはレンダー時に直接計算）
  const validatedDefaultPageId = (() => {
    if (isAuthLoading || !defaultPageId) return null;
    if (isAuthenticated) return defaultPageId;
    if (STATIC_MENUS.has(defaultPageId)) return defaultPageId;
    return asyncValidatedId; // 非同期検証完了まではnull（ローディング表示）
  })();

  const activeMenu: string = selectedMenu ?? validatedDefaultPageId ?? "";

  const handleMenuClick = (menu: string) => {
    setSelectedMenu(menu);
    setShowSecretLogin(false);
  };

  const handleContentNotFound = () => {
    setSelectedMenu("contact");
  };

  if ((isLoading || isAuthLoading) && !activeMenu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/70">
        <div className="text-white text-xl">{t("common.loading")}</div>
      </div>
    );
  }

  const renderContent = () => {
    if (showSecretLogin) {
      return <Login onLoginSuccess={() => setShowSecretLogin(false)} />;
    }
    if (activeMenu === "create") {
      return (
        <PrivateRoute>
          <MainContent
            activeMenu={activeMenu}
            onContentNotFound={handleContentNotFound}
          />
        </PrivateRoute>
      );
    }
    return (
      <MainContent
        activeMenu={activeMenu}
        onContentNotFound={handleContentNotFound}
      />
    );
  };

  return (
    <div className="app-layout">
      <CyberCursor />
      <Header />
      <Menu activeMenu={activeMenu} onMenuClick={handleMenuClick} />
      {renderContent()}
      <Footer />
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;

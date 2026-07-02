import React, { Suspense, lazy } from "react";

// mermaid(600KB+)を初期バンドルから除外して遅延ロード
const MermaidBlock = lazy(() => import("./MermaidBlock"));

// ReactMarkdown用の共通コンポーネント定義
export const markdownComponents = {
  // divやiframeなどのHTMLをそのまま扱えるようにする
  p: ({ children }: { children?: React.ReactNode }) => {
    if (
      typeof children === "string" &&
      (children.includes("<h") ||
        children.includes("<a") ||
        children.includes("<iframe") ||
        children.includes("<div") ||
        children.includes("<span"))
    ) {
      return <div dangerouslySetInnerHTML={{ __html: children }} />;
    }
    return <p>{children}</p>;
  },

  // <pre>レベルでmermaidをインターセプト → <pre>ラッパーなしで直接MermaidBlockを返す
  pre: ({ children }: { children?: React.ReactNode }) => {
    const child = React.Children.toArray(children)[0];
    if (React.isValidElement(child)) {
      const { className, children: code } = child.props as {
        className?: string;
        children?: unknown;
      };
      if (className === "language-mermaid") {
        const chart = Array.isArray(code)
          ? (code as unknown[]).join("")
          : String(code ?? "");
        if (chart.trim())
          return (
            <Suspense fallback={<div />}>
              <MermaidBlock chart={chart} />
            </Suspense>
          );
      }
    }
    return <pre>{children}</pre>;
  },
};

// h1タグまたは#で始まる行があるかチェックするユーティリティ
export const checkForH1 = (content: string): boolean => {
  return (
    content.toLowerCase().includes("<h1") ||
    content.split("\n").some((line) => line.trim().startsWith("# "))
  );
};

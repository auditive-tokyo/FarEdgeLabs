import React, { useEffect, useId, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

const MermaidBlock: React.FC<{ chart: string }> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const mermaidId = `mermaid${reactId.replaceAll(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    let cancelled = false;

    mermaid
      .render(mermaidId, chart)
      .then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error("Mermaid render failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [chart, mermaidId]);

  return <div ref={ref} />;
};

export default MermaidBlock;

import React, { useEffect, useRef, useState } from "react";

// 動画の元サイズ
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

// 初期グリッドサイズを計算
const getInitialGrid = () => ({
  cols: Math.ceil(window.innerWidth / VIDEO_WIDTH),
  rows: Math.ceil(window.innerHeight / VIDEO_HEIGHT),
});

const BackgroundVideo: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [grid, setGrid] = useState(getInitialGrid);

  // リサイズ時にグリッドを再計算
  useEffect(() => {
    const handleResize = () => {
      setGrid({
        cols: Math.ceil(window.innerWidth / VIDEO_WIDTH),
        rows: Math.ceil(window.innerHeight / VIDEO_HEIGHT),
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 全ての動画を同期再生
  useEffect(() => {
    const videos = videoRefs.current.filter((v): v is HTMLVideoElement => v !== null);

    videos.forEach((video) => {
      video.muted = true;
      video.play().catch((error) => {
        console.error("Failed to play video:", error);
      });
    });

    // 同期のため、最初の動画の時間に合わせる
    const syncVideos = () => {
      if (videos.length > 1 && videos[0]) {
        const masterTime = videos[0].currentTime;
        videos.slice(1).forEach((video) => {
          if (Math.abs(video.currentTime - masterTime) > 0.1) {
            video.currentTime = masterTime;
          }
        });
      }
    };

    const syncInterval = setInterval(syncVideos, 1000);
    return () => clearInterval(syncInterval);
  }, [grid]);

  const totalVideos = grid.cols * grid.rows;
  const videoSrc = import.meta.env.BASE_URL + "videos/bg_noise.mp4";

  // Generate mask for seamless tile edges (gradual fade)
  const FADE_SIZE = 80; // Fade distance in px
  const EDGE_OPACITY = 0.85; // Opacity at the very edge (0.85 = 15% transparent)
  const getMaskStyle = (index: number) => {
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);

    // Gradual fade from edge opacity to fully opaque
    const fadeLeft =
      col > 0
        ? `linear-gradient(to right, rgba(0,0,0,${EDGE_OPACITY}), black ${FADE_SIZE}px)`
        : null;
    const fadeRight =
      col < grid.cols - 1
        ? `linear-gradient(to left, rgba(0,0,0,${EDGE_OPACITY}), black ${FADE_SIZE}px)`
        : null;
    const fadeTop =
      row > 0
        ? `linear-gradient(to bottom, rgba(0,0,0,${EDGE_OPACITY}), black ${FADE_SIZE}px)`
        : null;
    const fadeBottom =
      row < grid.rows - 1
        ? `linear-gradient(to top, rgba(0,0,0,${EDGE_OPACITY}), black ${FADE_SIZE}px)`
        : null;

    const masks = [fadeLeft, fadeRight, fadeTop, fadeBottom].filter(Boolean);

    if (masks.length === 0) return {};

    return {
      maskImage: masks.join(", "),
      maskComposite: "intersect",
      WebkitMaskImage: masks.join(", "),
      WebkitMaskComposite: "source-in",
    };
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0 w-full h-full overflow-hidden z-[-1]"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, ${VIDEO_WIDTH}px)`,
          gridTemplateRows: `repeat(${grid.rows}, ${VIDEO_HEIGHT}px)`,
        }}
      >
        {Array.from({ length: totalVideos }).map((_, index) => {
          const row = Math.floor(index / grid.cols);
          const col = index % grid.cols;
          return (
            <video
              key={`video-${row}-${col}`}
              ref={(el) => {
                videoRefs.current[index] = el;
              }}
              autoPlay
              loop
              muted
              playsInline
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              className="block"
              style={getMaskStyle(index)}
            >
              <source src={videoSrc} type="video/mp4" />
            </video>
          );
        })}
      </div>
    </div>
  );
};

export default BackgroundVideo;

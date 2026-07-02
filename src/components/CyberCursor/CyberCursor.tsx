import React, { useEffect, useRef } from "react";

const { sin, cos, PI, hypot, min, max } = Math;

// ユーティリティ関数
function rnd(x = 1, dx = 0) {
  return Math.random() * x + dx;
}

function many<T>(n: number, f: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => f(i));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function noise(x: number, y: number, t = 101) {
  const w0 = sin(0.3 * x + 1.4 * t + 2 + 2.5 * sin(0.4 * y + -1.3 * t + 1));
  const w1 = sin(0.2 * y + 1.5 * t + 2.8 + 2.3 * sin(0.5 * x + -1.2 * t + 0.5));
  return w0 + w1;
}

// 描画ヘルパー関数
function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius, 0, 0, PI * 2);
  ctx.fill();
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);

  many(100, (i) => {
    const t = (i + 1) / 100;
    const lx = lerp(x0, x1, t);
    const ly = lerp(y0, y1, t);
    const k = noise(lx / 5 + x0, ly / 5 + y0) * 2;
    ctx.lineTo(lx + k, ly + k);
  });

  ctx.stroke();
}

interface PaintPtParams {
  ctx: CanvasRenderingContext2D;
  pt: Point;
  pts2: AnchorPoint[];
  x: number;
  y: number;
  r: number;
}

function paintPt({ ctx, pt, pts2, x, y, r }: PaintPtParams) {
  pts2.forEach((pt2) => {
    if (!pt.len) return;
    drawLine(
      ctx,
      lerp(x + pt2.x * r, pt.x, pt.len * pt.len),
      lerp(y + pt2.y * r, pt.y, pt.len * pt.len),
      x + pt2.x * r,
      y + pt2.y * r,
    );
  });
  drawCircle(ctx, pt.x, pt.y, pt.r);
}

interface Point {
  x: number;
  y: number;
  len: number;
  r: number;
}

interface AnchorPoint {
  x: number;
  y: number;
}

interface Spider {
  follow: (x: number, y: number) => void;
  tick: (t: number) => void;
}

// Spider を生成する関数
function createSpider(ctx: CanvasRenderingContext2D): Spider {
  const pts: Point[] = many(333, () => ({
    x: rnd(globalThis.innerWidth),
    y: rnd(globalThis.innerHeight),
    len: 0,
    r: 0,
  }));

  const pts2: AnchorPoint[] = many(9, (i) => ({
    x: cos((i / 9) * PI * 2),
    y: sin((i / 9) * PI * 2),
  }));

  const seed = rnd(100);
  let tx = rnd(globalThis.innerWidth);
  let ty = rnd(globalThis.innerHeight);
  let x = rnd(globalThis.innerWidth);
  let y = rnd(globalThis.innerHeight);
  const kx = rnd(0.8, 0.8);
  const ky = rnd(0.8, 0.8);
  const walkRadius = { x: rnd(50, 50), y: rnd(50, 50) };
  const r = globalThis.innerWidth / rnd(100, 150);

  return {
    follow(newX: number, newY: number) {
      tx = newX;
      ty = newY;
    },

    tick(t: number) {
      const selfMoveX = cos(t * kx + seed) * walkRadius.x;
      const selfMoveY = sin(t * ky + seed) * walkRadius.y;
      const fx = tx + selfMoveX;
      const fy = ty + selfMoveY;

      x += min(globalThis.innerWidth / 100, (fx - x) / 10);
      y += min(globalThis.innerWidth / 100, (fy - y) / 10);

      let i = 0;
      pts.forEach((pt) => {
        const dx = pt.x - x;
        const dy = pt.y - y;
        const len = hypot(dx, dy);
        let radius = min(2, globalThis.innerWidth / len / 5);
        const increasing = len < globalThis.innerWidth / 10 && i++ < 8;
        const dir = increasing ? 0.1 : -0.1;
        if (increasing) {
          radius *= 1.5;
        }
        pt.r = radius;
        pt.len = max(0, min(pt.len + dir, 1));
        paintPt({ ctx, pt, pts2, x, y, r });
      });
    },
  };
}

const InteractiveSpider: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spidersRef = useRef<Spider[]>([]);
  const mouseRef = useRef({
    x: globalThis.innerWidth / 2,
    y: globalThis.innerHeight / 2,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;

    // Spider を2体生成
    spidersRef.current = many(2, () => createSpider(ctx));

    // アニメーションループ
    let animationId: number;
    function animate(t: number) {
      if (w !== globalThis.innerWidth) w = canvas!.width = globalThis.innerWidth; // NOSONAR
      if (h !== globalThis.innerHeight) h = canvas!.height = globalThis.innerHeight; // NOSONAR

      ctx!.fillStyle = "transparent"; // NOSONAR
      ctx!.clearRect(0, 0, w, h); // NOSONAR
      ctx!.fillStyle = ctx!.strokeStyle = "#00f0ff"; // NOSONAR

      const time = t / 1000;
      spidersRef.current.forEach((spider) => {
        spider.follow(mouseRef.current.x, mouseRef.current.y);
        spider.tick(time);
      });

      animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);

    // マウス移動イベント
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    globalThis.addEventListener("pointermove", handleMouseMove);

    // クリーンアップ
    return () => {
      cancelAnimationFrame(animationId);
      globalThis.removeEventListener("pointermove", handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
};

export default InteractiveSpider;

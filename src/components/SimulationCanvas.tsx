"use client";

import { useEffect, useRef } from "react";
import { agentColor, phiToRgba, toCanvasPoint } from "@/lib/coverage/render";
import type { StoredFrame } from "@/lib/coverage/runResult";
import type { PhiGrid } from "@/lib/coverage/types";

/** canvas の横幅（画素）。縦はグリッドの縦横比に合わせる */
const CANVAS_WIDTH = 640;

type Props = {
  grid: PhiGrid;
  /** 描画するフレーム列。空なら Φ だけを描く */
  frames?: StoredFrame[];
  /** frames のうち何番目までを描くか（軌跡はここまで、現在位置はこの番目） */
  frameIndex?: number;
  /** 軌跡を描くか */
  showTrails?: boolean;
  className?: string;
};

/**
 * Φ のヒートマップの上に、ロボットの軌跡と現在位置を描く canvas。
 * Φ だけを渡せばヒートマップのプレビューとしても使える。
 */
export function SimulationCanvas({
  grid,
  frames = [],
  frameIndex,
  showTrails = true,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<{ key: PhiGrid; canvas: HTMLCanvasElement } | null>(null);

  const cell = CANVAS_WIDTH / grid.width;
  const height = Math.round(grid.height * cell);
  const index = Math.min(frames.length - 1, frameIndex ?? frames.length - 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Φ のヒートマップはグリッド解像度の小さな canvas に一度描き、拡大して貼る
    if (!heatRef.current || heatRef.current.key !== grid) {
      const heat = document.createElement("canvas");
      heat.width = grid.width;
      heat.height = grid.height;
      const hctx = heat.getContext("2d");
      if (hctx) {
        const image = hctx.createImageData(grid.width, grid.height);
        image.data.set(phiToRgba(grid));
        hctx.putImageData(image, 0, 0);
      }
      heatRef.current = { key: grid, canvas: heat };
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(heatRef.current.canvas, 0, 0, canvas.width, canvas.height);

    if (frames.length === 0 || index < 0) return;
    const agents = frames[0].positions.length;

    // 軌跡
    if (showTrails && index > 0) {
      ctx.lineWidth = 1.5;
      for (let a = 0; a < agents; a++) {
        ctx.strokeStyle = agentColor(a);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        for (let k = 0; k <= index; k++) {
          const [x, y] = frames[k].positions[a];
          const [cx, cy] = toCanvasPoint(x, y, cell);
          if (k === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // 現在位置
    const radius = Math.max(4, Math.min(8, cell * 0.6));
    for (let a = 0; a < agents; a++) {
      const [x, y] = frames[index].positions[a];
      const [cx, cy] = toCanvasPoint(x, y, cell);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = agentColor(a);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }, [grid, frames, index, showTrails, cell]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={height}
      className={`h-auto w-full max-w-full rounded border border-neutral-200 bg-black dark:border-neutral-800 ${className ?? ""}`}
      style={{ aspectRatio: `${grid.width} / ${grid.height}` }}
      role="img"
      aria-label="Φ のヒートマップとロボットの位置"
    />
  );
}

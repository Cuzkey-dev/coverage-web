"use client";

import { useEffect, useRef } from "react";
import { phiToRgba } from "@/lib/coverage/render";
import type { PhiGrid } from "@/lib/coverage/types";

/**
 * 一覧カードに出す豆ヒートマップ。
 *
 * 元画像ではなく Φ を描く。公開すると保存物は誰からも見えるので、
 * アップロードされた絵を他人の画面に出さないため。
 * Φ なら「どんな重み付けの実行か」が一目で分かり、こちらの方が中身に近い。
 */
export function PhiThumb({ grid, className }: { grid: PhiGrid; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const image = ctx.createImageData(grid.width, grid.height);
    image.data.set(phiToRgba(grid));
    ctx.putImageData(image, 0, 0);
  }, [grid]);

  return (
    <canvas
      ref={ref}
      width={grid.width}
      height={grid.height}
      // canvas は object-fit が効かないので、幅だけ決めて高さは縦横比なりにする。
      // 拡大するとぼけるので、セルの境目が見えるよう pixelated にする
      style={{ imageRendering: "pixelated", aspectRatio: `${grid.width} / ${grid.height}` }}
      className={`h-auto shrink-0 rounded bg-black ${className ?? "w-12"}`}
      aria-hidden
    />
  );
}

import type { PhiGrid } from "./types";

/**
 * 描画のための純粋な補助関数。canvas に依存しないので、Φ→画素の変換をテストできる。
 */

/**
 * 0〜1 の値を暖色系のヒートマップ色にする（黒 → 紫 → 橙 → 黄）。
 * 区間ごとの線形補間で、ライブラリ無しで inferno に近い見え方にしている。
 */
export function heatColor(v: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, v));
  const stops: [number, [number, number, number]][] = [
    [0.0, [0, 0, 4]],
    [0.25, [87, 16, 110]],
    [0.5, [188, 55, 84]],
    [0.75, [249, 142, 9]],
    [1.0, [252, 255, 164]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (t <= t1) {
      const [t0, c0] = stops[i - 1];
      const u = (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * u),
        Math.round(c0[1] + (c1[1] - c0[1]) * u),
        Math.round(c0[2] + (c1[2] - c0[2]) * u),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/** PhiGrid を RGBA の画素列にする（ImageData にそのまま流し込める） */
export function phiToRgba(grid: PhiGrid): Uint8ClampedArray {
  const out = new Uint8ClampedArray(grid.width * grid.height * 4);
  for (let i = 0; i < grid.width * grid.height; i++) {
    const [r, g, b] = heatColor(grid.phi[i]);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** ロボットごとの色。台数が多いときは巡回する */
const AGENT_COLORS = [
  "#38bdf8",
  "#4ade80",
  "#f472b6",
  "#facc15",
  "#a78bfa",
  "#fb923c",
  "#2dd4bf",
  "#f87171",
  "#c084fc",
  "#a3e635",
];

export function agentColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length];
}

/**
 * グリッド座標（セル中心が整数）を canvas の画素座標へ写す。
 * セル (x, y) は canvas 上の [x*s, (x+1)*s) を占めるので、中心は (x + 0.5) * s。
 */
export function toCanvasPoint(
  x: number,
  y: number,
  cellSize: number,
): [number, number] {
  return [(x + 0.5) * cellSize, (y + 0.5) * cellSize];
}

import type { PhiGrid, Point } from "./types";
import { SiteIndex } from "./spatial";

/** 2点間のユークリッド距離の2乗。平方根を取らないのは比較にしか使わないため */
export function squaredDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * 点 p にいちばん近いサイトの添字を返す（＝ Voronoi 分割の担当決め）。
 * 距離が同じ場合は添字の小さい方を返し、結果が実行ごとにぶれないようにする。
 */
export function nearestSiteIndex(p: Point, sites: readonly Point[]): number {
  if (sites.length === 0) {
    throw new Error("sites must not be empty");
  }

  let best = 0;
  let bestDistance = squaredDistance(p, sites[0]);

  for (let i = 1; i < sites.length; i++) {
    const d = squaredDistance(p, sites[i]);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  }

  return best;
}

/**
 * 各サイトが担当するセルの、Φで重み付けした重心を求める。
 * 担当セルが無い／重みの合計が 0 のサイトは、動かす根拠が無いので現在地を保つ。
 */
export function weightedCentroids(
  sites: readonly Point[],
  grid: PhiGrid,
): Point[] {
  const massSum = new Array<number>(sites.length).fill(0);
  const xSum = new Array<number>(sites.length).fill(0);
  const ySum = new Array<number>(sites.length).fill(0);
  if (sites.length === 0) return [];
  const index = new SiteIndex(sites);

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const weight = grid.phi[y * grid.width + x];
      if (weight <= 0) continue;

      const owner = index.nearest(x, y);
      massSum[owner] += weight;
      xSum[owner] += x * weight;
      ySum[owner] += y * weight;
    }
  }

  return sites.map((site, i) =>
    massSum[i] > 0
      ? { x: xSum[i] / massSum[i], y: ySum[i] / massSum[i] }
      : { ...site },
  );
}

/**
 * Lloyd 法の1ステップ。各サイトを担当領域の重心へ移動させる。
 * これを繰り返すと重心ボロノイ分割に収束し、被覆制御の基本則になる。
 */
export function lloydStep(sites: readonly Point[], grid: PhiGrid): Point[] {
  return weightedCentroids(sites, grid);
}

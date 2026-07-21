import { describe, expect, it } from "vitest";
import { lloydStep, nearestSiteIndex, weightedCentroids } from "./geometry";
import type { PhiGrid } from "./types";

/** 全セルの重みが等しいグリッド */
function uniformGrid(width: number, height: number): PhiGrid {
  return { width, height, phi: new Array(width * height).fill(1) };
}

describe("nearestSiteIndex", () => {
  it("いちばん近いサイトを選ぶ", () => {
    const sites = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(nearestSiteIndex({ x: 1, y: 0 }, sites)).toBe(0);
    expect(nearestSiteIndex({ x: 9, y: 0 }, sites)).toBe(1);
  });

  it("等距離のときは添字の小さい方を選ぶ", () => {
    const sites = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(nearestSiteIndex({ x: 5, y: 0 }, sites)).toBe(0);
  });

  it("サイトが空なら例外を投げる", () => {
    expect(() => nearestSiteIndex({ x: 0, y: 0 }, [])).toThrow();
  });
});

describe("weightedCentroids", () => {
  it("一様なΦでは、単一サイトは領域の中心へ移動する", () => {
    const grid = uniformGrid(5, 5);
    const [centroid] = weightedCentroids([{ x: 0, y: 0 }], grid);
    expect(centroid.x).toBeCloseTo(2);
    expect(centroid.y).toBeCloseTo(2);
  });

  it("Φが1点に集中していれば、その点へ移動する", () => {
    const grid: PhiGrid = { width: 3, height: 3, phi: new Array(9).fill(0) };
    grid.phi[3 * 2 + 1] = 1; // (x, y) = (1, 2)

    const [centroid] = weightedCentroids([{ x: 0, y: 0 }], grid);
    expect(centroid.x).toBeCloseTo(1);
    expect(centroid.y).toBeCloseTo(2);
  });

  it("担当セルが無いサイトは現在地に留まる", () => {
    // Φは左上の1セルのみ。2つ目のサイトは何も担当しない
    const grid: PhiGrid = { width: 4, height: 1, phi: [1, 0, 0, 0] };
    const sites = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ];

    const moved = weightedCentroids(sites, grid);
    expect(moved[1]).toEqual({ x: 3, y: 0 });
  });

  it("重心ボロノイ配置は不動点になる", () => {
    const grid = uniformGrid(5, 5);
    const centered = [{ x: 2, y: 2 }];

    const once = lloydStep(centered, grid);
    const twice = lloydStep(once, grid);

    expect(twice[0].x).toBeCloseTo(once[0].x);
    expect(twice[0].y).toBeCloseTo(once[0].y);
  });
});

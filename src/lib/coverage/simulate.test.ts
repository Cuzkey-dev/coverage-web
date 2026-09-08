import { describe, expect, it } from "vitest";
import {
  coverageCost,
  createRandom,
  initialPositions,
  sanitizeSimulationOptions,
  simulate,
  simulateStepwise,
} from "./simulate";
import type { PhiGrid } from "./types";

function uniformGrid(width: number, height: number): PhiGrid {
  return { width, height, phi: new Array(width * height).fill(1) };
}

describe("createRandom", () => {
  it("同じシードなら同じ列を返す", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it("違うシードなら違う列になる", () => {
    const a = createRandom(1)();
    const b = createRandom(2)();
    expect(a).not.toBe(b);
  });

  it("0 以上 1 未満を返す", () => {
    const r = createRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("initialPositions", () => {
  it("台数ぶんの点をグリッドの範囲内に置く", () => {
    const grid = uniformGrid(20, 10);
    const p = initialPositions(grid, 5, 3);
    expect(p).toHaveLength(5);
    for (const q of p) {
      expect(q.x).toBeGreaterThanOrEqual(0);
      expect(q.x).toBeLessThanOrEqual(19);
      expect(q.y).toBeGreaterThanOrEqual(0);
      expect(q.y).toBeLessThanOrEqual(9);
    }
  });

  it("同じシードなら同じ配置になる", () => {
    const grid = uniformGrid(20, 10);
    expect(initialPositions(grid, 4, 9)).toEqual(initialPositions(grid, 4, 9));
  });
});

describe("coverageCost", () => {
  it("Φ が集中したセルの上にロボットがいればコストは 0", () => {
    const grid: PhiGrid = { width: 3, height: 3, phi: new Array(9).fill(0) };
    grid.phi[4] = 1; // (1, 1)
    expect(coverageCost([{ x: 1, y: 1 }], grid)).toBe(0);
    // 1 セル離れると距離の2乗 × Φ = 1
    expect(coverageCost([{ x: 2, y: 1 }], grid)).toBe(1);
  });

  it("重み付きで足し上げる", () => {
    // 1行3セル: Φ = [2, 0, 1]、ロボットは x=0
    const grid: PhiGrid = { width: 3, height: 1, phi: [2, 0, 1] };
    // セル0: 距離0 → 0、セル2: 距離2の2乗 × 1 = 4
    expect(coverageCost([{ x: 0, y: 0 }], grid)).toBe(4);
  });

  it("ロボットが増えるとコストは増えない", () => {
    const grid = uniformGrid(10, 10);
    const one = coverageCost([{ x: 2, y: 2 }], grid);
    const two = coverageCost(
      [
        { x: 2, y: 2 },
        { x: 7, y: 7 },
      ],
      grid,
    );
    expect(two).toBeLessThan(one);
  });
});

describe("simulate", () => {
  it("steps + 1 個の配置と評価値を返す", () => {
    const grid = uniformGrid(10, 10);
    const result = simulate(grid, { agents: 3, steps: 5, seed: 1 });
    expect(result.positions).toHaveLength(6);
    expect(result.costs).toHaveLength(6);
    for (const frame of result.positions) expect(frame).toHaveLength(3);
  });

  it("評価値は単調に減る（Lloyd 法は H を減らす）", () => {
    const grid = uniformGrid(16, 12);
    const { costs } = simulate(grid, { agents: 4, steps: 20, seed: 5 });
    for (let k = 1; k < costs.length; k++) {
      expect(costs[k]).toBeLessThanOrEqual(costs[k - 1] + 1e-9);
    }
    expect(costs[costs.length - 1]).toBeLessThan(costs[0]);
  });

  it("同じ入力なら同じ結果になる", () => {
    const grid = uniformGrid(12, 8);
    const a = simulate(grid, { agents: 3, steps: 10, seed: 123 });
    const b = simulate(grid, { agents: 3, steps: 10, seed: 123 });
    expect(a).toEqual(b);
  });

  it("シードが違えば初期配置が違う", () => {
    const grid = uniformGrid(12, 8);
    const a = simulate(grid, { agents: 3, steps: 1, seed: 1 });
    const b = simulate(grid, { agents: 3, steps: 1, seed: 2 });
    expect(a.positions[0]).not.toEqual(b.positions[0]);
  });

  it("1台なら一様な Φ で中心へ寄る", () => {
    const grid = uniformGrid(9, 9);
    const { positions } = simulate(grid, { agents: 1, steps: 3, seed: 1 });
    const last = positions[positions.length - 1][0];
    expect(last.x).toBeCloseTo(4);
    expect(last.y).toBeCloseTo(4);
  });

  it("逐次版は最初に step 0 を返し、順番に進む", () => {
    const grid = uniformGrid(8, 8);
    const steps = Array.from(simulateStepwise(grid, { agents: 2, steps: 3, seed: 1 }));
    expect(steps.map((s) => s.step)).toEqual([0, 1, 2, 3]);
  });
});

describe("sanitizeSimulationOptions", () => {
  it("範囲外を丸め、整数にする", () => {
    const o = sanitizeSimulationOptions({ agents: 9999, steps: 0.4, seed: 1.6 });
    expect(o.agents).toBe(1200);
    expect(o.steps).toBe(1);
    expect(o.seed).toBe(2);
  });

  it("欠けた項目は既定値で補う", () => {
    expect(sanitizeSimulationOptions({})).toEqual({ agents: 8, steps: 60, seed: 1 });
  });
});

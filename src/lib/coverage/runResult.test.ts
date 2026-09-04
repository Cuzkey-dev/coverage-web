import { describe, expect, it } from "vitest";
import {
  buildRunResult,
  framePoints,
  MAX_STORED_FRAMES,
  parseRunResult,
  thinFrames,
} from "./runResult";
import { simulate } from "./simulate";
import type { PhiGrid, Point } from "./types";

function uniformGrid(width: number, height: number): PhiGrid {
  return { width, height, phi: new Array(width * height).fill(1) };
}

function history(steps: number, agents: number): Point[][] {
  const out: Point[][] = [];
  for (let k = 0; k <= steps; k++) {
    out.push(Array.from({ length: agents }, (_, i) => ({ x: k + i * 0.123, y: i })));
  }
  return out;
}

describe("thinFrames", () => {
  it("短い履歴はそのまま全部残す", () => {
    const frames = thinFrames(history(10, 2));
    expect(frames.map((f) => f.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("長い履歴は上限枚数に抑え、最初と最後を必ず残す", () => {
    const frames = thinFrames(history(300, 3));
    expect(frames.length).toBeLessThanOrEqual(MAX_STORED_FRAMES);
    expect(frames[0].step).toBe(0);
    expect(frames[frames.length - 1].step).toBe(300);
  });

  it("位置は小数 2 桁に丸める", () => {
    const [frame] = thinFrames(history(0, 2));
    expect(frame.positions[1][0]).toBe(0.12);
  });

  it("空の履歴は空", () => {
    expect(thinFrames([])).toEqual([]);
  });
});

describe("buildRunResult / parseRunResult", () => {
  it("往復しても同じ内容になる", () => {
    const grid = uniformGrid(6, 4);
    const simulation = simulate(grid, { agents: 2, steps: 5, seed: 1 });
    const result = buildRunResult({ grid, seed: 1, simulation, imageName: "a.png" });

    expect(result.finalCost).toBe(result.costs[5]);
    expect(result.frames).toHaveLength(6);

    const parsed = parseRunResult(JSON.parse(JSON.stringify(result)));
    expect(parsed).toEqual(result);
    expect(framePoints(parsed!.frames[0])).toHaveLength(2);
  });

  it("形が違う JSON は null にする", () => {
    expect(parseRunResult(null)).toBeNull();
    expect(parseRunResult({ version: 99 })).toBeNull();
    expect(parseRunResult({ version: 1, grid: { width: 1 } })).toBeNull();
  });
});

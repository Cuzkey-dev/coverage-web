import { describe, expect, it } from "vitest";
import { createSampleImage } from "./sampleImage";
import { DEFAULT_PHI_CONFIG, phiFromImage, toGrayscale } from "./phi";
import { simulate } from "./simulate";

describe("createSampleImage", () => {
  it("RGBA の不透明な画像を返す", () => {
    const img = createSampleImage();
    expect(img.data).toHaveLength(img.width * img.height * 4);
    expect(img.data[3]).toBe(255);
    // 背景は明るい
    expect(img.data[0]).toBeGreaterThan(200);
  });

  it("図形の線が背景より暗い", () => {
    const img = createSampleImage();
    const gray = toGrayscale(img);
    const at = (x: number, y: number) => gray.data[y * img.width + x];
    // 円の左端（中心 150,170・半径 90）
    expect(at(60, 170)).toBeLessThan(at(150, 170));
    // 三角形の内側は塗りつぶし
    expect(at(400, 310)).toBeLessThan(at(10, 10));
  });

  it("何度呼んでも同じ画像になる", () => {
    expect(Array.from(createSampleImage().data)).toEqual(
      Array.from(createSampleImage().data),
    );
  });

  it("この画像から Φ を作ると、エッジのセルと下駄のセルが両方できる", () => {
    const phi = phiFromImage(createSampleImage(), {
      ...DEFAULT_PHI_CONFIG,
      gridWidth: 48,
      gridHeight: 36,
    });
    const floor = DEFAULT_PHI_CONFIG.floor;
    expect(phi.phi.some((v) => v > floor + 0.5)).toBe(true);
    expect(phi.phi.some((v) => Math.abs(v - floor) < 1e-6)).toBe(true);
  });

  it("この Φ で回すと評価値が下がる（seed のお手本が意味のある結果になる）", () => {
    const phi = phiFromImage(createSampleImage(), {
      ...DEFAULT_PHI_CONFIG,
      gridWidth: 48,
      gridHeight: 36,
    });
    const { costs } = simulate(phi, { agents: 8, steps: 30, seed: 1 });
    expect(costs[costs.length - 1]).toBeLessThan(costs[0] * 0.6);
  });
});

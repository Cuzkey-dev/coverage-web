import { describe, expect, it } from "vitest";
import { agentColor, heatColor, phiToRgba, toCanvasPoint } from "./render";

describe("heatColor", () => {
  it("0 は暗く、1 は明るい", () => {
    const [r0, g0, b0] = heatColor(0);
    const [r1, g1, b1] = heatColor(1);
    expect(r0 + g0 + b0).toBeLessThan(r1 + g1 + b1);
  });

  it("範囲外は端に丸める", () => {
    expect(heatColor(-5)).toEqual(heatColor(0));
    expect(heatColor(7)).toEqual(heatColor(1));
  });

  it("中間値は補間される", () => {
    const [r] = heatColor(0.125);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(87);
  });
});

describe("phiToRgba", () => {
  it("セルごとに RGBA 4 バイトを出し、不透明にする", () => {
    const rgba = phiToRgba({ width: 2, height: 1, phi: [0, 1] });
    expect(rgba).toHaveLength(8);
    expect(rgba[3]).toBe(255);
    expect(rgba[7]).toBe(255);
    expect(Array.from(rgba.slice(4, 7))).toEqual(heatColor(1));
  });
});

describe("agentColor", () => {
  it("台数が多くても色を返す", () => {
    expect(agentColor(0)).toMatch(/^#/);
    expect(agentColor(1000)).toMatch(/^#/);
  });
});

describe("toCanvasPoint", () => {
  it("セル中心を画素の中心へ写す", () => {
    expect(toCanvasPoint(0, 0, 10)).toEqual([5, 5]);
    expect(toCanvasPoint(2, 1, 10)).toEqual([25, 15]);
  });
});

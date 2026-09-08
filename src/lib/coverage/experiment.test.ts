import { describe, expect, it } from "vitest";
import {
  assignCells,
  executeExperiment,
  geometryQuality,
  INITIAL_MODES,
  makeInitialPositions,
  storedFrameLimit,
  type ExperimentInput,
  type InitialMode,
} from "./experiment";
import { SiteIndex } from "./spatial";
import { nearestSiteIndex, weightedCentroids } from "./geometry";
import { coverageCost, createRandom } from "./simulate";
import { createCatalogImage, SAMPLES } from "./samples";
import { DEFAULT_PHI_CONFIG, toGrayscale } from "./phi";
import { parseRunResult } from "./runResult";

const input: ExperimentInput = {
  image: createCatalogImage("bird"),
  imageName: "bird",
  phiConfig: {
    ...DEFAULT_PHI_CONFIG,
    gridWidth: 128,
    gridHeight: 128,
    bandSigma: 1,
    floor: 0,
  },
  options: { agents: 120, steps: 200, seed: 7 },
  initialMode: "weighted",
};

describe("exact spatial assignment", () => {
  it("matches exhaustive nearest-neighbor search including ties", () => {
    const rng = createRandom(17),
      sites = Array.from({ length: 1200 }, () => ({
        x: rng() * 256,
        y: rng() * 256,
      }));
    sites.push({ ...sites[0] });
    const index = new SiteIndex(sites);
    for (let i = 0; i < 1000; i++) {
      const p = { x: rng() * 256, y: rng() * 256 };
      expect(index.nearest(p.x, p.y)).toBe(nearestSiteIndex(p, sites));
    }
    expect(
      new SiteIndex([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]).nearest(1, 0),
    ).toBe(0);
    expect(index.nearest(sites[0].x, sites[0].y)).toBe(0);
  });
  it("keeps the original centroid and H definitions", () => {
    const grid = {
        width: 7,
        height: 5,
        phi: Array.from({ length: 35 }, (_, i) => i % 5),
      },
      sites = [
        { x: 1, y: 2 },
        { x: 3, y: 3 },
        { x: 5, y: 0 },
      ];
    const result = assignCells(sites, grid);
    expect(result.centroids).toEqual(weightedCentroids(sites, grid));
    expect(result.cost).toBe(coverageCost(sites, grid));
  });
});

describe("experiment output", () => {
  it("has deterministic, bounded initial conditions for all six modes", () => {
    const grid = { width: 128, height: 96, phi: new Array(128 * 96).fill(1) };
    for (const mode of Object.keys(INITIAL_MODES) as InitialMode[]) {
      const a = makeInitialPositions(grid, 1200, 7, mode);
      expect(a).toEqual(makeInitialPositions(grid, 1200, 7, mode));
      expect(
        a.every((p) => p.x >= 0 && p.y >= 0 && p.x <= 127 && p.y <= 95),
      ).toBe(true);
    }
  });
  it("produces distinct, useful edges for every original sample", () => {
    const images = SAMPLES.map((s) => createCatalogImage(s.id, 80));
    expect(new Set(images.map((i) => Array.from(i.data).join(","))).size).toBe(
      6,
    );
    for (const s of SAMPLES) {
      const result = executeExperiment({
        ...input,
        image: createCatalogImage(s.id),
        options: { ...input.options, steps: 80 },
      });
      expect(result.quality!.at(-1)!.edgeCoverage).toBeGreaterThan(0.8);
      expect(result.quality!.at(-1)!.meanEdgeDistance).toBeLessThan(1);
    }
  });
  it("monotonically lowers H and retains actual steps through serialization", () => {
    const result = executeExperiment(input);
    for (let i = 1; i < result.costs.length; i++)
      expect(result.costs[i]).toBeLessThanOrEqual(result.costs[i - 1] + 0.001);
    expect(result.settings!.stopReason).toBe("converged");
    expect(result.frames[0].step).toBe(0);
    expect(result.frames.at(-1)!.step).toBe(result.costs.length - 1);
    expect(parseRunResult(JSON.parse(JSON.stringify(result)))).toEqual(result);
    expect(executeExperiment(input)).toEqual(result);
  });
  it("fits 1,200 robots and the maximum grid inside the save request budget", () => {
    const result = executeExperiment({
      ...input,
      phiConfig: {
        ...input.phiConfig,
        gridWidth: 256,
        gridHeight: 256,
        floor: 0.001,
      },
      options: { agents: 1200, steps: 3000, seed: 7 },
    });
    expect(result.frames.every((f) => f.positions.length === 1200)).toBe(true);
    expect(result.frames.length).toBeLessThanOrEqual(storedFrameLimit(1200));
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(1_800_000);
    expect(parseRunResult(JSON.parse(JSON.stringify(result)))).not.toBeNull();
  }, 30000);
  it("rejects empty images and malformed saved results", () => {
    expect(() =>
      executeExperiment({
        ...input,
        image: {
          width: 32,
          height: 32,
          data: new Uint8ClampedArray(32 * 32 * 4).fill(255),
        },
      }),
    ).toThrow("輪郭");
    const result = executeExperiment(input);
    expect(
      parseRunResult({ ...result, grid: { ...result.grid, phi: [1] } }),
    ).toBeNull();
    expect(parseRunResult({ ...result, costs: [NaN] })).toBeNull();
    expect(
      parseRunResult({
        ...result,
        frames: [{ step: 0, positions: [[Infinity, 0]] }],
      }),
    ).toBeNull();
    expect(
      parseRunResult({
        ...result,
        quality: [{ step: 0, meanEdgeDistance: 0, edgeCoverage: 2 }],
      }),
    ).toBeNull();
  });
  it("uses a known geometric definition and composites transparency on white", () => {
    expect(
      geometryQuality(
        [{ x: 0, y: 0 }],
        [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
        ],
      ),
    ).toEqual({ meanEdgeDistance: 0, edgeCoverage: 0.5 });
    expect(
      geometryQuality(
        [{ x: 3, y: 0 }],
        [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
        ],
      ),
    ).toEqual({ meanEdgeDistance: 3, edgeCoverage: 1 });
    expect(
      toGrayscale({ width: 1, height: 1, data: [0, 0, 0, 0] }).data[0],
    ).toBe(1);
  });
});

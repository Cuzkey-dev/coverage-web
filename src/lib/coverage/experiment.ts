import {
  createRandom,
  MAX_AGENTS,
  MAX_STEPS,
  sanitizeSimulationOptions,
  type SimulationOptions,
} from "./simulate";
import { SiteIndex } from "./spatial";
import {
  detectEdges,
  downsampleToGrid,
  phiFromImage,
  sanitizePhiConfig,
  type ImageLike,
  type PhiConfig,
} from "./phi";
import type { PhiGrid, Point } from "./types";
import type { RunResult, StoredFrame } from "./runResult";

export const INITIAL_MODES = {
  weighted: "輪郭近くに分散",
  uniform: "全域にランダム",
  corner: "左下に集合",
  half: "左半分",
  boundary: "外周に集合",
  lattice: "格子状",
} as const;
export type InitialMode = keyof typeof INITIAL_MODES;
export type ExperimentSettings = {
  initialMode: InitialMode;
  maxSteps: number;
  algorithm: "lloyd" | "server-v1";
  stopReason: "converged" | "limit" | "budget";
  executedSteps?: number;
  sizeMode?: "auto" | "fixed";
};
export type QualitySample = {
  step: number;
  meanEdgeDistance: number;
  edgeCoverage: number;
  f1?: number;
};
export type ExperimentInput = {
  image: ImageLike;
  imageName: string;
  phiConfig: PhiConfig;
  options: SimulationOptions;
  initialMode: InitialMode;
  sizeMode?: "auto" | "fixed";
};
export type ExperimentProgress = {
  step: number;
  maxSteps: number;
  frame: StoredFrame;
  cost: number;
};
export const QUALITY_RADIUS = 3; // Grid cells; fixed for comparable geometry measurements.

export function makeInitialPositions(
  grid: PhiGrid,
  count: number,
  seed: number,
  mode: InitialMode,
): Point[] {
  const rng = createRandom(seed),
    w = grid.width - 1,
    h = grid.height - 1;
  const columns = Math.ceil(Math.sqrt((count * grid.width) / grid.height));
  const cumulative = new Float64Array(grid.phi.length);
  let total = 0;
  if (mode === "weighted")
    grid.phi.forEach((v, i) => {
      total += Math.max(0, v);
      cumulative[i] = total;
    });
  return Array.from({ length: count }, (_, i) => {
    let x = rng(),
      y = rng();
    if (mode === "weighted" && total > 0) {
      const target = x * total;
      let lo = 0,
        hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] <= target) lo = mid + 1;
        else hi = mid;
      }
      return {
        x: Math.max(0, Math.min(w, (lo % grid.width) + y - 0.5)),
        y: Math.max(0, Math.min(h, Math.floor(lo / grid.width) + rng() - 0.5)),
      };
    }
    if (mode === "corner") {
      x = 0.04 + x * 0.22;
      y = 0.74 + y * 0.22;
    }
    if (mode === "half") x *= 0.5;
    if (mode === "boundary") {
      const side = i % 4;
      if (side < 2) y = side === 0 ? y * 0.08 : 1 - y * 0.08;
      else x = side === 2 ? x * 0.08 : 1 - x * 0.08;
    }
    if (mode === "lattice") {
      x = ((i % columns) + 0.5) / columns;
      y = (Math.floor(i / columns) + 0.5) / Math.ceil(count / columns);
    }
    return { x: x * w, y: y * h };
  });
}

/** One exact Voronoi assignment provides both H and the next Lloyd centroids. */
export function assignCells(sites: Point[], grid: PhiGrid) {
  const index = new SiteIndex(sites),
    mass = new Float64Array(sites.length),
    sx = mass.slice(),
    sy = mass.slice();
  let cost = 0;
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) {
      const weight = grid.phi[y * grid.width + x];
      if (weight <= 0) continue;
      const i = index.nearest(x, y),
        p = sites[i];
      mass[i] += weight;
      sx[i] += x * weight;
      sy[i] += y * weight;
      cost += ((x - p.x) ** 2 + (y - p.y) ** 2) * weight;
    }
  return {
    cost,
    centroids: sites.map((p, i) =>
      mass[i] > 0 ? { x: sx[i] / mass[i], y: sy[i] / mass[i] } : { ...p },
    ),
  };
}

/** Public geometric diagnostics, independent of any research-specific F1 / occupancy definition. */
export function geometryQuality(
  sites: Point[],
  edges: Point[],
  edgeIndex = new SiteIndex(edges),
): Omit<QualitySample, "step"> {
  if (!edges.length || !sites.length)
    return { meanEdgeDistance: 0, edgeCoverage: 0 };
  let distance = 0,
    covered = 0;
  for (const p of sites) {
    const q = edges[edgeIndex.nearest(p.x, p.y)];
    distance += Math.hypot(p.x - q.x, p.y - q.y);
  }
  const index = new SiteIndex(sites);
  for (const q of edges) {
    const p = sites[index.nearest(q.x, q.y)];
    if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 <= QUALITY_RADIUS ** 2) covered++;
  }
  return {
    meanEdgeDistance: distance / sites.length,
    edgeCoverage: covered / edges.length,
  };
}

export function storedFrameLimit(agents: number): number {
  return Math.min(121, Math.max(12, Math.floor(24000 / agents)));
}

export function executeExperiment(
  input: ExperimentInput,
  progress?: (p: ExperimentProgress) => void,
): RunResult {
  const options = sanitizeSimulationOptions(input.options),
    config = sanitizePhiConfig(input.phiConfig);
  const grid = phiFromImage(input.image, config);
  const coarse = downsampleToGrid(
    detectEdges(input.image, config),
    grid.width,
    grid.height,
  );
  const edges: Point[] = [];
  coarse.phi.forEach((v, i) => {
    if (v > 0) edges.push({ x: i % grid.width, y: Math.floor(i / grid.width) });
  });
  if (!edges.length)
    throw new Error(
      "輪郭が検出されませんでした。別の画像か、低い閾値を試してください。",
    );
  const edgeIndex = new SiteIndex(edges);
  let positions = makeInitialPositions(
    grid,
    options.agents,
    options.seed,
    input.initialMode,
  );
  const frames: StoredFrame[] = [],
    costs: number[] = [],
    quality: QualitySample[] = [];
  const frameLimit = storedFrameLimit(options.agents);
  let stride = 1,
    settled = 0,
    stopReason: ExperimentSettings["stopReason"] = "limit",
    lastSent = -Infinity;
  for (let step = 0; step <= options.steps; step++) {
    const assignment = assignCells(positions, grid);
    costs.push(Math.round(assignment.cost * 1000) / 1000);
    let maxMovement = 0;
    positions.forEach((p, i) => {
      maxMovement = Math.max(
        maxMovement,
        Math.hypot(
          p.x - assignment.centroids[i].x,
          p.y - assignment.centroids[i].y,
        ),
      );
    });
    settled = maxMovement < 0.001 ? settled + 1 : 0;
    const converged = step >= 10 && settled >= 5;
    const done = converged || step === options.steps;
    if (step % 10 === 0 || done)
      quality.push({ step, ...geometryQuality(positions, edges, edgeIndex) });
    const frame: StoredFrame = {
      step,
      positions: positions.map((p) => [
        Math.round(p.x * 100) / 100,
        Math.round(p.y * 100) / 100,
      ]),
    };
    if (step % stride === 0 || done) {
      if (frames.length >= frameLimit) {
        const compact = frames.filter(
          (f, i) => i === 0 || f.step % (stride * 2) === 0,
        );
        frames.splice(0, frames.length, ...compact);
        stride *= 2;
      }
      frames.push(frame);
    }
    if (performance.now() - lastSent > 100 || done) {
      progress?.({
        step,
        maxSteps: options.steps,
        frame,
        cost: assignment.cost,
      });
      lastSent = performance.now();
    }
    if (done) {
      if (converged) stopReason = "converged";
      break;
    }
    positions = assignment.centroids;
  }
  return {
    version: 1,
    seed: options.seed,
    imageName: input.imageName,
    grid: {
      ...grid,
      phi: grid.phi.map((v) => Math.round(v * 100000) / 100000),
    },
    frames,
    costs,
    finalCost: costs.at(-1) ?? 0,
    settings: {
      initialMode: input.initialMode,
      maxSteps: options.steps,
      algorithm: "lloyd",
      stopReason,
    },
    quality,
  };
}

export const EXPERIMENT_LIMITS = { agents: MAX_AGENTS, steps: MAX_STEPS };

import type { PhiGrid, Point } from "./types";
import type { SimulationResult } from "./simulate";
import type { ExperimentSettings, QualitySample } from "./experiment";

/**
 * 保存済みバージョン1と互換の実行結果。元画像ファイルは含まないが、Φから輪郭は読み取れる。
 * 旧seedの履歴はthinFramesで最大121枚へ、新規実行はexperiment.tsで台数に応じて間引く。
 * いずれも先頭・最終フレームと全ステップのHを保持する。
 */

export const RUN_RESULT_VERSION = 1;
export const MAX_STORED_FRAMES = 121;

/** 位置は [x, y] のタプルで持つ（キー名の分だけ JSON が小さくなる） */
export type StoredFrame = { step: number; positions: [number, number][] };

export type RunResult = {
  version: typeof RUN_RESULT_VERSION;
  seed: number;
  grid: PhiGrid;
  frames: StoredFrame[];
  costs: number[];
  finalCost: number;
  /** 元画像のファイル名（表示用）。画像そのものは保存しない */
  imageName?: string;
  settings?: ExperimentSettings;
  quality?: QualitySample[];
};

function round(v: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}

/** 位置履歴を間引く。step 0 と最終 step は必ず含める */
export function thinFrames(positions: Point[][]): StoredFrame[] {
  const last = positions.length - 1;
  if (last < 0) return [];
  const stride = Math.max(1, Math.ceil(last / (MAX_STORED_FRAMES - 1)));

  const frames: StoredFrame[] = [];
  for (let k = 0; k <= last; k += stride) {
    frames.push(toStoredFrame(k, positions[k]));
  }
  if (frames[frames.length - 1].step !== last) {
    frames.push(toStoredFrame(last, positions[last]));
  }
  return frames;
}

function toStoredFrame(step: number, positions: Point[]): StoredFrame {
  return {
    step,
    positions: positions.map((p) => [round(p.x, 2), round(p.y, 2)]),
  };
}

export function buildRunResult(input: {
  grid: PhiGrid;
  seed: number;
  simulation: SimulationResult;
  imageName?: string;
}): RunResult {
  const { grid, seed, simulation } = input;
  const costs = simulation.costs.map((c) => round(c, 3));
  return {
    version: RUN_RESULT_VERSION,
    seed,
    grid: {
      width: grid.width,
      height: grid.height,
      phi: grid.phi.map((v) => round(v, 3)),
    },
    frames: thinFrames(simulation.positions),
    costs,
    finalCost: costs.length > 0 ? costs[costs.length - 1] : 0,
    imageName: input.imageName,
  };
}

/** 保存済み JSON を読む。形が違えば null を返し、画面側で「結果なし」として扱う */
export function parseRunResult(json: unknown): RunResult | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Record<string, unknown>;
  const grid = r.grid as Record<string, unknown> | undefined;
  if (
    r.version !== RUN_RESULT_VERSION ||
    !grid ||
    typeof grid.width !== "number" ||
    typeof grid.height !== "number" ||
    !Array.isArray(grid.phi) ||
    !Array.isArray(r.frames) ||
    !Array.isArray(r.costs)
  ) {
    return null;
  }
  const finite = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  const serverModel =
    (r.settings as Record<string, unknown> | undefined)?.algorithm ===
    "server-v1";
  if (
    !Number.isInteger(grid.width) ||
    !Number.isInteger(grid.height) ||
    grid.width < 1 ||
    grid.height < 1 ||
    grid.width > 256 ||
    grid.height > 256 ||
    grid.phi.length !== grid.width * grid.height ||
    !grid.phi.every((v) => finite(v) && v >= 0)
  )
    return null;
  if (
    !r.costs.length ||
    r.costs.length > 3001 ||
    !r.costs.every((v) => finite(v) && v >= 0) ||
    !r.frames.length ||
    r.frames.length > 121
  )
    return null;
  let previous = -1,
    agents = 0;
  for (const frame of r.frames) {
    if (
      !frame ||
      !Number.isInteger(frame.step) ||
      frame.step <= previous ||
      frame.step >= r.costs.length ||
      !Array.isArray(frame.positions) ||
      !frame.positions.length ||
      frame.positions.length > 1200
    )
      return null;
    if (agents && agents !== frame.positions.length) return null;
    agents = frame.positions.length;
    if (
      !frame.positions.every(
        (p: unknown) =>
          Array.isArray(p) &&
          p.length === 2 &&
          finite(p[0]) &&
          finite(p[1]) &&
          p[0] >= (serverModel ? -(grid.width as number) : -0.01) &&
          p[1] >= (serverModel ? -(grid.height as number) : -0.01) &&
          p[0] <= (grid.width as number) * (serverModel ? 2 : 1) &&
          p[1] <= (grid.height as number) * (serverModel ? 2 : 1),
      )
    )
      return null;
    previous = frame.step;
  }
  if (r.frames[0].step !== 0 || previous !== r.costs.length - 1) return null;
  const settings = r.settings as ExperimentSettings | undefined;
  if (
    settings &&
    (!["lloyd", "server-v1"].includes(settings.algorithm) ||
      ![
        "weighted",
        "uniform",
        "corner",
        "half",
        "boundary",
        "lattice",
      ].includes(settings.initialMode) ||
      !Number.isInteger(settings.maxSteps) ||
      settings.maxSteps < previous ||
      settings.maxSteps > 3000 ||
      !["converged", "limit", "budget"].includes(settings.stopReason) ||
      (settings.sizeMode !== undefined &&
        !["auto", "fixed"].includes(settings.sizeMode)) ||
      (settings.executedSteps !== undefined &&
        (!Number.isInteger(settings.executedSteps) ||
          settings.executedSteps < previous ||
          settings.executedSteps > settings.maxSteps)))
  )
    return null;
  const quality = r.quality as QualitySample[] | undefined;
  if (quality) {
    if (!Array.isArray(quality) || quality.length > 302) return null;
    let last = -1;
    for (const q of quality) {
      if (
        !q ||
        !Number.isInteger(q.step) ||
        q.step <= last ||
        q.step > previous ||
        !finite(q.meanEdgeDistance) ||
        q.meanEdgeDistance < 0 ||
        !finite(q.edgeCoverage) ||
        q.edgeCoverage < 0 ||
        q.edgeCoverage > 1 ||
        (q.f1 !== undefined && (!finite(q.f1) || q.f1 < 0 || q.f1 > 1))
      )
        return null;
      last = q.step;
    }
  }
  return {
    version: RUN_RESULT_VERSION,
    seed: finite(r.seed) ? r.seed : 0,
    grid: { width: grid.width, height: grid.height, phi: grid.phi as number[] },
    frames: r.frames as StoredFrame[],
    costs: r.costs as number[],
    finalCost: (r.costs as number[]).at(-1) ?? 0,
    imageName: typeof r.imageName === "string" ? r.imageName : undefined,
    ...(settings
      ? {
          settings: {
            algorithm: settings.algorithm,
            initialMode: settings.initialMode,
            maxSteps: settings.maxSteps,
            stopReason: settings.stopReason,
            ...(settings.executedSteps !== undefined
              ? { executedSteps: settings.executedSteps }
              : {}),
            ...(settings.sizeMode !== undefined
              ? { sizeMode: settings.sizeMode }
              : {}),
          },
        }
      : {}),
    ...(quality
      ? {
          quality: quality.map((q) => ({
            step: q.step,
            meanEdgeDistance: q.meanEdgeDistance,
            edgeCoverage: q.edgeCoverage,
            ...(q.f1 !== undefined ? { f1: q.f1 } : {}),
          })),
        }
      : {}),
  };
}

/** 保存済みフレームを Point 配列に戻す */
export function framePoints(frame: StoredFrame): Point[] {
  return frame.positions.map(([x, y]) => ({ x, y }));
}

import type { PhiGrid, Point } from "./types";
import type { SimulationResult } from "./simulate";

/**
 * Run.result（JSON カラム）に入れる形。
 *
 * 再生と比較に必要なものだけを持つ:
 *   - Φ そのもの（元画像は保存しないので、これが無いと再生できない）
 *   - 間引いた位置履歴
 *   - 全ステップの評価値
 *
 * 元画像は縮小版もサムネイルも保存しない。公開すると保存物は誰からも見えるので、
 * アップロードされた絵が他人の画面に出ないようにするため。
 * 一覧に出す豆ヒートマップは、保存済みの Φ から都度作る（downsamplePhi）。
 *
 * 間引きの方針:
 *   位置履歴は台数 × ステップ数 × 2 で膨らむので、保存するフレームを
 *   最大 MAX_STORED_FRAMES 枚に抑える。step 0 と最終 step は必ず残し、
 *   間は等間隔に抜く（stride = ceil(steps / (MAX_STORED_FRAMES - 1))）。
 *   評価値は 1 ステップ 1 数値で軽いので全ステップ残す。
 *   数値は小数 3 桁（位置は 2 桁）に丸める。40 台 × 300 ステップでも 200KB 弱に収まる。
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
  return {
    version: RUN_RESULT_VERSION,
    seed: typeof r.seed === "number" ? r.seed : 0,
    grid: { width: grid.width, height: grid.height, phi: grid.phi as number[] },
    frames: r.frames as StoredFrame[],
    costs: r.costs as number[],
    finalCost:
      typeof r.finalCost === "number"
        ? r.finalCost
        : ((r.costs as number[]).at(-1) ?? 0),
    imageName: typeof r.imageName === "string" ? r.imageName : undefined,
  };
}

/** 保存済みフレームを Point 配列に戻す */
export function framePoints(frame: StoredFrame): Point[] {
  return frame.positions.map(([x, y]) => ({ x, y }));
}

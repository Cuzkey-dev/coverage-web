import { lloydStep } from "./geometry";
import { SiteIndex } from "./spatial";
import type { PhiGrid, Point } from "./types";

/**
 * 被覆制御シミュレーション。
 *
 * PhiGrid とロボット台数・ステップ数・シードを受け取り、既存の lloydStep を
 * 繰り返して各ステップの全ロボット位置と評価値を返す。React や DB には依存しない。
 */

export type SimulationOptions = {
  /** ロボット台数 */
  agents: number;
  /** ステップ数（lloydStep を回す回数） */
  steps: number;
  /** 初期配置を決める疑似乱数のシード。同じシードなら同じ初期配置になる */
  seed: number;
};

export type SimulationResult = {
  /** positions[k] は k ステップ後の全ロボット位置。positions[0] が初期配置。長さは steps + 1 */
  positions: Point[][];
  /** costs[k] は positions[k] での評価値 H。長さは steps + 1 */
  costs: number[];
};

/** UI・保存検証で共通の上限。大台数のUI実行はexperiment.worker.tsを使う。 */
export const MAX_AGENTS = 1200;
export const MAX_STEPS = 3000;
export const MIN_AGENTS = 1;
export const MIN_STEPS = 1;

export const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
  agents: 8,
  steps: 60,
  seed: 1,
};

/** 入力を安全な範囲に丸める。UI の入力や保存済み JSON をそのまま通せるようにする */
export function sanitizeSimulationOptions(
  input: Partial<SimulationOptions>,
): SimulationOptions {
  const c = { ...DEFAULT_SIMULATION_OPTIONS, ...input };
  const clampInt = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : lo;
  return {
    agents: clampInt(c.agents, MIN_AGENTS, MAX_AGENTS),
    steps: clampInt(c.steps, MIN_STEPS, MAX_STEPS),
    seed: Number.isFinite(c.seed) ? Math.round(c.seed) : 0,
  };
}

/**
 * シード付き疑似乱数（mulberry32）。0 以上 1 未満を返す。
 * Math.random はシードを指定できないので、再現性のために自前で持つ。
 */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 初期配置。グリッド全域 [0, width-1] × [0, height-1] に一様乱数で散らす。
 * セルの座標系は geometry.ts と同じで、セル (x, y) の中心が (x, y)。
 */
export function initialPositions(
  grid: PhiGrid,
  agents: number,
  seed: number,
): Point[] {
  const random = createRandom(seed);
  const positions: Point[] = [];
  for (let i = 0; i < agents; i++) {
    positions.push({
      x: random() * Math.max(0, grid.width - 1),
      y: random() * Math.max(0, grid.height - 1),
    });
  }
  return positions;
}

/**
 * 被覆制御の標準的なコスト関数（位置関数・locational cost）。
 *
 *   H(p) = Σ_q  min_i ‖q − p_i‖²  Φ(q)
 *
 * 各セル q について、担当ロボット（いちばん近いサイト）までの距離の2乗に
 * そのセルの重要度 Φ(q) を掛けて足し上げる。重要な場所の近くにロボットがいるほど小さくなり、
 * Lloyd 法はこの H を単調に減らす勾配法にあたる。
 * 距離の2乗は geometry.ts の squaredDistance と同じく平方根を取らない値そのもの。
 */
export function coverageCost(sites: readonly Point[], grid: PhiGrid): number {
  if (sites.length === 0) return 0;
  const index = new SiteIndex(sites);
  let cost = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const weight = grid.phi[y * grid.width + x];
      if (weight <= 0) continue;
      const owner = index.nearest(x, y);
      const dx = x - sites[owner].x;
      const dy = y - sites[owner].y;
      cost += (dx * dx + dy * dy) * weight;
    }
  }
  return cost;
}

/**
 * 1ステップずつ進められる形のシミュレーション。
 * UI では requestAnimationFrame などの合間に next() を呼び、長い実行でも画面を固めない。
 * 最初の yield が初期配置（step 0）、以降が各ステップの結果。
 */
export function* simulateStepwise(
  grid: PhiGrid,
  options: SimulationOptions,
): Generator<{ step: number; positions: Point[]; cost: number }, void> {
  const { agents, steps, seed } = sanitizeSimulationOptions(options);
  let positions = initialPositions(grid, agents, seed);
  yield { step: 0, positions, cost: coverageCost(positions, grid) };

  for (let k = 1; k <= steps; k++) {
    positions = lloydStep(positions, grid);
    yield { step: k, positions, cost: coverageCost(positions, grid) };
  }
}

/** 最後まで一気に回す。テストや小さな実行向け */
export function simulate(
  grid: PhiGrid,
  options: SimulationOptions,
): SimulationResult {
  const positions: Point[][] = [];
  const costs: number[] = [];
  for (const frame of simulateStepwise(grid, options)) {
    positions.push(frame.positions);
    costs.push(frame.cost);
  }
  return { positions, costs };
}

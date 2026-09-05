import "server-only";
import { prisma } from "@/lib/db";
import { downsamplePhi, sanitizePhiConfig, type PhiConfig } from "@/lib/coverage/phi";
import { parseRunResult, type RunResult } from "@/lib/coverage/runResult";
import type { RunParams } from "@/lib/coverage/params";
import type { PhiGrid } from "@/lib/coverage/types";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Run テーブルへの読み書き。サーバー側だけで使う。
 * JSON カラムの中身はここで型を付け直し、画面側には RunSummary / RunDetail だけを渡す。
 */

/**
 * 保存しておく実行の上限。公開すると誰でも保存できるので、無制限だと
 * 無料枠のデータベースが埋まる。上限を超えたら、訪問者が作った古いものから消す。
 * seed で入れたお手本（ownerToken が無い実行）は消さない。
 */
export const MAX_RUNS = 200;

/** 一覧カードに出す豆ヒートマップの長辺（セル数）。一覧の転送量を抑えるため小さくする */
const THUMB_GRID_SIDE = 16;

/** 一覧カード用。result のうち軽い項目だけを取り出す */
export type RunSummary = {
  id: string;
  title: string;
  agents: number;
  steps: number;
  seed: number;
  method: PhiConfig["method"];
  gridWidth: number;
  gridHeight: number;
  finalCost: number | null;
  imageName?: string;
  /** 一覧カードに出す豆ヒートマップ用の、小さくした Φ */
  thumb: PhiGrid | null;
  createdAt: string;
  /** seed で入れたお手本かどうか（削除ボタンを出さない） */
  isSample: boolean;
};

/** 詳細・比較用 */
export type RunDetail = {
  id: string;
  title: string;
  createdAt: string;
  params: RunParams;
  result: RunResult | null;
  isSample: boolean;
};

type RunRow = {
  id: string;
  title: string;
  agents: number;
  steps: number;
  phiConfig: Prisma.JsonValue;
  result: Prisma.JsonValue | null;
  ownerToken: string | null;
  createdAt: Date;
};

function summarize(run: RunRow): RunSummary {
  const phiConfig = sanitizePhiConfig(run.phiConfig as Partial<PhiConfig>);
  const result = parseRunResult(run.result);
  return {
    id: run.id,
    title: run.title,
    agents: run.agents,
    steps: run.steps,
    seed: result?.seed ?? 0,
    method: phiConfig.method,
    gridWidth: phiConfig.gridWidth,
    gridHeight: phiConfig.gridHeight,
    finalCost: result?.finalCost ?? null,
    imageName: result?.imageName,
    thumb: result ? downsamplePhi(result.grid, THUMB_GRID_SIDE) : null,
    createdAt: run.createdAt.toISOString(),
    isSample: run.ownerToken === null,
  };
}

export async function listRuns(limit = 100): Promise<RunSummary[]> {
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return runs.map(summarize);
}

export async function getRun(id: string): Promise<RunDetail | null> {
  const run = await prisma.run.findUnique({ where: { id } });
  if (!run) return null;
  const phiConfig = sanitizePhiConfig(run.phiConfig as Partial<PhiConfig>);
  const result = parseRunResult(run.result);
  return {
    id: run.id,
    title: run.title,
    createdAt: run.createdAt.toISOString(),
    params: {
      agents: run.agents,
      steps: run.steps,
      seed: result?.seed ?? 0,
      phiConfig,
    },
    result,
    isSample: run.ownerToken === null,
  };
}

export async function createRun(input: {
  title: string;
  agents: number;
  steps: number;
  phiConfig: PhiConfig;
  result: RunResult;
  /** null で作ると「お手本」になり、画面からは削除できなくなる（seed 用） */
  ownerToken: string | null;
}): Promise<string> {
  const run = await prisma.run.create({
    data: {
      title: input.title,
      agents: input.agents,
      steps: input.steps,
      phiConfig: input.phiConfig as unknown as Prisma.InputJsonValue,
      result: input.result as unknown as Prisma.InputJsonValue,
      ownerToken: input.ownerToken,
    },
    select: { id: true },
  });
  await pruneOldRuns();
  return run.id;
}

/**
 * 上限を超えた分を、訪問者が作った古いものから消す。
 * 保存のたびに1回だけ走らせるので、超過分は1件ずつ減っていく。
 */
async function pruneOldRuns(): Promise<void> {
  const total = await prisma.run.count();
  const excess = total - MAX_RUNS;
  if (excess <= 0) return;

  const oldest = await prisma.run.findMany({
    where: { ownerToken: { not: null } },
    orderBy: { createdAt: "asc" },
    take: excess,
    select: { id: true },
  });
  if (oldest.length === 0) return;
  await prisma.run.deleteMany({ where: { id: { in: oldest.map((r) => r.id) } } });
}

/**
 * 削除。ownerToken が一致する実行だけを消す。
 * お手本（ownerToken が null）はここでは決して消えない。
 * 消せたかどうかを返し、他人の実行を指定したときは「消せなかった」として扱う。
 */
export async function deleteOwnRun(id: string, ownerToken: string): Promise<boolean> {
  const { count } = await prisma.run.deleteMany({ where: { id, ownerToken } });
  return count > 0;
}

/** 渡した id のうち、この ownerToken が作ったものだけを返す */
export async function filterOwnRunIds(
  ids: string[],
  ownerToken: string,
): Promise<string[]> {
  const rows = await prisma.run.findMany({
    where: { id: { in: ids }, ownerToken },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** 死活監視から呼ぶ。DB に届くかどうかだけを見る */
export async function countRuns(): Promise<number> {
  return prisma.run.count();
}

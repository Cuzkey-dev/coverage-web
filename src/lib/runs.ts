import "server-only";
import { prisma } from "@/lib/db";
import { sanitizePhiConfig, type PhiConfig } from "@/lib/coverage/phi";
import { parseRunResult, type RunResult } from "@/lib/coverage/runResult";
import type { RunParams } from "@/lib/coverage/params";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Run テーブルへの読み書き。サーバー側だけで使う。
 * JSON カラムの中身はここで型を付け直し、画面側には RunSummary / RunDetail だけを渡す。
 */

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
  imageThumb?: string;
  createdAt: string;
};

/** 詳細・比較用 */
export type RunDetail = {
  id: string;
  title: string;
  createdAt: string;
  params: RunParams;
  result: RunResult | null;
};

function summarize(run: {
  id: string;
  title: string;
  agents: number;
  steps: number;
  phiConfig: Prisma.JsonValue;
  result: Prisma.JsonValue | null;
  createdAt: Date;
}): RunSummary {
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
    imageThumb: result?.imageThumb,
    createdAt: run.createdAt.toISOString(),
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
  };
}

export async function createRun(input: {
  title: string;
  agents: number;
  steps: number;
  phiConfig: PhiConfig;
  result: RunResult;
}): Promise<string> {
  const run = await prisma.run.create({
    data: {
      title: input.title,
      agents: input.agents,
      steps: input.steps,
      phiConfig: input.phiConfig as unknown as Prisma.InputJsonValue,
      result: input.result as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return run.id;
}

export async function deleteRun(id: string): Promise<void> {
  await prisma.run.delete({ where: { id } });
}

"use server";

import { revalidatePath } from "next/cache";
import { sanitizePhiConfig, type PhiConfig } from "@/lib/coverage/phi";
import { parseRunResult } from "@/lib/coverage/runResult";
import { sanitizeSimulationOptions } from "@/lib/coverage/simulate";
import { createRun, deleteRun } from "@/lib/runs";

/**
 * 画面から呼ぶ Server Action。
 * 入力は信用せず、純粋関数側の sanitize / parse を通してから DB に入れる。
 */

export type SaveRunInput = {
  title: string;
  agents: number;
  steps: number;
  phiConfig: PhiConfig;
  result: unknown;
};

export type SaveRunOutput =
  | { ok: true; id: string }
  | { ok: false; error: string };

const MAX_TITLE_LENGTH = 100;

export async function saveRun(input: SaveRunInput): Promise<SaveRunOutput> {
  const title = String(input.title ?? "").trim();
  if (!title) return { ok: false, error: "タイトルを入力してください" };
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `タイトルは ${MAX_TITLE_LENGTH} 文字までです` };
  }

  const result = parseRunResult(input.result);
  if (!result) return { ok: false, error: "結果の形式が不正です" };

  const options = sanitizeSimulationOptions({
    agents: input.agents,
    steps: input.steps,
    seed: result.seed,
  });
  const phiConfig = sanitizePhiConfig(input.phiConfig);

  try {
    const id = await createRun({
      title,
      agents: options.agents,
      steps: options.steps,
      phiConfig,
      result,
    });
    revalidatePath("/");
    revalidatePath("/runs");
    return { ok: true, id };
  } catch (e) {
    console.error("saveRun failed", e);
    return { ok: false, error: "保存に失敗しました。DB に接続できているか確認してください" };
  }
}

export async function removeRun(id: string): Promise<SaveRunOutput> {
  try {
    await deleteRun(id);
    revalidatePath("/");
    revalidatePath("/runs");
    return { ok: true, id };
  } catch (e) {
    console.error("removeRun failed", e);
    return { ok: false, error: "削除に失敗しました" };
  }
}

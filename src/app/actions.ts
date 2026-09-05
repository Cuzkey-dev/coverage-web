"use server";

import { revalidatePath } from "next/cache";
import { isOwnerToken } from "@/lib/coverage/ownerToken";
import { sanitizePhiConfig, type PhiConfig } from "@/lib/coverage/phi";
import { parseRunResult } from "@/lib/coverage/runResult";
import { sanitizeSimulationOptions } from "@/lib/coverage/simulate";
import { createRun, deleteOwnRun, filterOwnRunIds } from "@/lib/runs";

/**
 * 画面から呼ぶ Server Action。
 *
 * Server Action は画面を通さず直接 POST できるので、入力は一切信用せず、
 * 純粋関数側の sanitize / parse を通してから DB に入れる。
 */

export type SaveRunInput = {
  title: string;
  agents: number;
  steps: number;
  phiConfig: PhiConfig;
  result: unknown;
  ownerToken: string;
};

export type SaveRunOutput =
  | { ok: true; id: string }
  | { ok: false; error: string };

const MAX_TITLE_LENGTH = 100;

/**
 * result の大きさの上限（文字数）。
 * 上限いっぱいの設定（128×128 のΦ・40台・300ステップ）でも 300KB 程度なので、
 * その倍を上限にしておく。Server Action 自体の上限は 1MB。
 */
const MAX_RESULT_CHARS = 600_000;

export async function saveRun(input: SaveRunInput): Promise<SaveRunOutput> {
  const title = String(input.title ?? "").trim();
  if (!title) return { ok: false, error: "タイトルを入力してください" };
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `タイトルは ${MAX_TITLE_LENGTH} 文字までです` };
  }

  if (!isOwnerToken(input.ownerToken)) {
    return { ok: false, error: "ブラウザの識別子が不正です。再読み込みしてください" };
  }

  // 大きすぎる JSON は parse する前に弾く
  let size = 0;
  try {
    size = JSON.stringify(input.result ?? null).length;
  } catch {
    return { ok: false, error: "結果の形式が不正です" };
  }
  if (size > MAX_RESULT_CHARS) {
    return { ok: false, error: "結果が大きすぎます。グリッドかステップ数を小さくしてください" };
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
      ownerToken: input.ownerToken,
    });
    revalidatePath("/");
    revalidatePath("/runs");
    return { ok: true, id };
  } catch (e) {
    console.error("saveRun failed", e);
    return {
      ok: false,
      error: "保存に失敗しました。しばらく置いてもう一度お試しください",
    };
  }
}

/** 自分のブラウザで保存した実行だけを削除する */
export async function removeRun(
  id: string,
  ownerToken: string,
): Promise<SaveRunOutput> {
  if (!isOwnerToken(ownerToken)) {
    return { ok: false, error: "この実行は削除できません" };
  }
  try {
    const deleted = await deleteOwnRun(id, ownerToken);
    if (!deleted) {
      return { ok: false, error: "この実行は削除できません（別のブラウザで保存されたものです）" };
    }
    revalidatePath("/");
    revalidatePath("/runs");
    return { ok: true, id };
  } catch (e) {
    console.error("removeRun failed", e);
    return { ok: false, error: "削除に失敗しました" };
  }
}

/**
 * 渡した id のうち、このブラウザが保存したものだけを返す。
 * 一覧で「削除できる実行にだけ削除ボタンを出す」ために使う。
 * ownerToken を画面へ配らないよう、突き合わせはサーバー側で行う。
 */
export async function listOwnRunIds(
  ids: string[],
  ownerToken: string,
): Promise<string[]> {
  if (!isOwnerToken(ownerToken) || !Array.isArray(ids) || ids.length === 0) {
    return [];
  }
  try {
    return await filterOwnRunIds(ids.slice(0, 200), ownerToken);
  } catch (e) {
    console.error("listOwnRunIds failed", e);
    return [];
  }
}

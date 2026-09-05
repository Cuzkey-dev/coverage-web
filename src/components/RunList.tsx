"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { listOwnRunIds, removeRun } from "@/app/actions";
import { formatCost, formatDate } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/coverage/params";
import { getOwnerToken } from "@/lib/coverage/ownerToken";
import type { RunSummary } from "@/lib/runs";

type Props = {
  runs: RunSummary[];
  /** 最初から選択しておく id（詳細画面から「比較相手を選ぶ」で来たとき） */
  preselect?: string;
};

/**
 * 保存済み実行のカード一覧。2 件までチェックして比較へ進む。
 * 削除ボタンは、このブラウザが保存した実行にだけ出す（認証が無いので他人の実行は消せない）。
 */
export function RunList({ runs, preselect }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    preselect && runs.some((r) => r.id === preselect) ? [preselect] : [],
  );
  const [ownIds, setOwnIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 自分が保存した実行を、サーバーに突き合わせて聞く（トークンは画面へ配らない）
  useEffect(() => {
    const ids = runs.filter((r) => !r.isSample).map((r) => r.id);
    let alive = true;
    const load =
      ids.length === 0
        ? Promise.resolve<string[]>([])
        : listOwnRunIds(ids, getOwnerToken());
    void load.then((mine) => {
      if (alive) setOwnIds(new Set(mine));
    });
    return () => {
      alive = false;
    };
  }, [runs]);

  const toggle = (id: string) => {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      // 3 つ目を選んだら古い方を外す
      return [...s.slice(-1), id];
    });
  };

  const onDelete = (run: RunSummary) => {
    if (!window.confirm(`「${run.title}」を削除します。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await removeRun(run.id, getOwnerToken());
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelected((s) => s.filter((x) => x !== run.id));
      setOwnIds((s) => {
        const next = new Set(s);
        next.delete(run.id);
        return next;
      });
      router.refresh();
    });
  };

  if (runs.length === 0) {
    return (
      <div className="rounded border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
        保存された実行はまだありません。
        <Link href="/new" className="ml-2 underline">
          新規実行へ
        </Link>
      </div>
    );
  }

  const [a, b] = selected;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">
          比較したい実行を 2 件チェックしてください（{selected.length} / 2）
        </span>
        {a && b ? (
          <Link
            href={`/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`}
            className="rounded bg-sky-600 px-3 py-1.5 font-medium text-white hover:bg-sky-700"
          >
            比較する
          </Link>
        ) : (
          <span className="rounded bg-neutral-200 px-3 py-1.5 text-neutral-500 dark:bg-neutral-800">
            比較する
          </span>
        )}
        {error && <span className="text-red-600">{error}</span>}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {runs.map((run) => {
          const checked = selected.includes(run.id);
          return (
            <li
              key={run.id}
              className={`flex flex-col gap-2 rounded border p-3 ${
                checked
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(run.id)}
                  aria-label={`${run.title} を比較対象にする`}
                  className="mt-1"
                />
                <Link href={`/runs/${run.id}`} className="flex-1 font-medium hover:underline">
                  {run.title}
                </Link>
                {run.imageThumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={run.imageThumb}
                    alt=""
                    className="h-12 w-12 rounded object-cover"
                  />
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                <dt>台数</dt>
                <dd className="font-mono">{run.agents}</dd>
                <dt>ステップ数</dt>
                <dd className="font-mono">{run.steps}</dd>
                <dt>最終評価値</dt>
                <dd className="font-mono">{formatCost(run.finalCost)}</dd>
                <dt>エッジ検出</dt>
                <dd>
                  {METHOD_LABELS[run.method]} / {run.gridWidth}×{run.gridHeight}
                </dd>
                <dt>作成</dt>
                <dd>{formatDate(run.createdAt)}</dd>
              </dl>
              <div className="flex items-center justify-between">
                {run.isSample ? (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    お手本
                  </span>
                ) : (
                  <span />
                )}
                {ownIds.has(run.id) && (
                  <button
                    type="button"
                    onClick={() => onDelete(run)}
                    disabled={pending}
                    className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-40"
                  >
                    削除
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

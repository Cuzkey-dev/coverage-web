import Link from "next/link";
import { notFound } from "next/navigation";
import { ParamTable } from "@/components/ParamTable";
import { ExperimentResult } from "@/components/ExperimentResult";
import { listParams } from "@/lib/coverage/params";
import { formatCost, formatDate } from "@/lib/format";
import { getRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  const serverModel = run.result?.settings?.algorithm === "server-v1";
  const rows = listParams(run.params).filter(
    (row) =>
      !serverModel ||
      ["agents", "steps", "seed", "gridWidth", "gridHeight"].includes(row.key),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <Link href="/runs" className="text-sm text-sky-600 hover:underline">
          ← 保存した実行
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{run.title}</h1>
        <p className="text-sm text-neutral-500">
          {formatDate(run.createdAt)}
          {run.result?.imageName && ` ・ 画像: ${run.result.imageName}`}
        </p>
        <div>
          <Link
            href={`/runs?with=${encodeURIComponent(run.id)}`}
            className="inline-block rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            この実行と比較する相手を選ぶ
          </Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">再生</h2>
          {run.result ? (
            <ExperimentResult
              result={run.result}
              label={run.title}
              config={run.params.phiConfig}
            />
          ) : (
            <p className="text-sm text-neutral-500">
              結果が保存されていません。
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold">パラメータ</h2>
            <ParamTable rows={rows} />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">
              {serverModel ? "最終輪郭誤差" : "最終評価値 H"}
            </span>
            <span className="font-mono text-xl tabular-nums">
              {formatCost(run.result?.finalCost)}
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            {serverModel
              ? "参照輪郭・実行条件・配置結果・評価値を保存しています。"
              : "元画像は保存していません。保存されるのは Φ とパラメータと結果だけです。"}
          </p>
        </aside>
      </div>
    </main>
  );
}

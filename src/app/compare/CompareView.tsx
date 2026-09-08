"use client";

import Link from "next/link";
import { CostChart } from "@/components/CostChart";
import { ParamTable } from "@/components/ParamTable";
import { PhiThumb } from "@/components/PhiThumb";
import { SimulationCanvas } from "@/components/SimulationCanvas";
import { diffParams } from "@/lib/coverage/params";
import { downsamplePhi } from "@/lib/coverage/phi";
import { formatCost, formatDate } from "@/lib/format";
import type { RunDetail } from "@/lib/runs";

const COLOR_A = "#38bdf8";
const COLOR_B = "#fb923c";

type Props = { a: RunDetail; b: RunDetail };

/**
 * 2 件を左右に並べる。パラメータは変わった行だけ強調し、評価値の推移は同じ軸に重ねる。
 */
export function CompareView({ a, b }: Props) {
  const rows = diffParams(a.params, b.params);
  const changed = rows.filter((r) => r.changed);

  const finalA = a.result?.finalCost ?? null;
  const finalB = b.result?.finalCost ?? null;
  const delta = finalA !== null && finalB !== null ? finalB - finalA : null;
  const ratio =
    delta !== null && finalA ? ((delta / finalA) * 100).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          { run: a, color: COLOR_A, tag: "A" },
          { run: b, color: COLOR_B, tag: "B" },
        ].map(({ run, color, tag }) => (
          <div
            key={run.id}
            className="flex min-w-0 items-start gap-3 rounded border p-3"
            style={{ borderColor: color }}
          >
            <span
              className="rounded px-2 py-0.5 text-xs font-bold text-black"
              style={{ background: color }}
            >
              {tag}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/runs/${run.id}`} className="truncate font-medium hover:underline">
                {run.title}
              </Link>
              <span className="break-all text-xs text-neutral-500">
                {formatDate(run.createdAt)}
                {run.result?.imageName && ` ・ ${run.result.imageName}`}
              </span>
            </div>
            {run.result && (
              <PhiThumb grid={downsamplePhi(run.result.grid, 16)} className="w-14" />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">
            パラメータの差分
            <span className="ml-2 text-sm font-normal text-neutral-500">
              {changed.length === 0
                ? "違いはありません"
                : `${changed.length} 項目が違います: ${changed.map((r) => r.label).join("、")}`}
            </span>
          </h2>
          <ParamTable rows={rows} headA="A" headB="B" />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">最終評価値 H</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-neutral-500">A</span>
              <span className="break-all font-mono text-xl tabular-nums" style={{ color: COLOR_A }}>
                {formatCost(finalA)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-neutral-500">B</span>
              <span className="break-all font-mono text-xl tabular-nums" style={{ color: COLOR_B }}>
                {formatCost(finalB)}
              </span>
            </div>
            <div className="col-span-2 flex min-w-0 flex-col sm:col-span-1">
              <span className="text-neutral-500">B − A</span>
              <span className="break-all font-mono text-xl tabular-nums">
                {delta === null ? "—" : `${delta > 0 ? "+" : ""}${formatCost(delta)}`}
                {ratio !== null && (
                  <span className="block text-sm text-neutral-500">({ratio}%)</span>
                )}
              </span>
            </div>
          </div>
          <p className="break-all text-xs text-neutral-500">
            H は各セルの「担当ロボットまでの距離の2乗 × Φ」の総和。小さいほど重要な場所を近くで覆えている。
            グリッド解像度が違う実行どうしは絶対値をそのまま比べられないので、推移の形で見る。
          </p>
          <CostChart
            series={[
              { label: `A: ${a.title}`, color: COLOR_A, values: a.result?.costs ?? [] },
              { label: `B: ${b.title}`, color: COLOR_B, values: b.result?.costs ?? [] },
            ]}
          />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">最終配置</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[a, b].map((run, i) => (
            <div key={run.id} className="flex flex-col gap-1">
              <span className="text-sm text-neutral-500">
                {i === 0 ? "A" : "B"}: {run.title}
              </span>
              {run.result ? (
                <SimulationCanvas
                  grid={run.result.grid}
                  frames={run.result.frames}
                  frameIndex={run.result.frames.length - 1}
                  showTrails
                />
              ) : (
                <p className="text-sm text-neutral-500">結果が保存されていません。</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

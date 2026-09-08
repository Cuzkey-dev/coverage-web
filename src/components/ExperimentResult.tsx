"use client";

import { useRef } from "react";
import { SimulationPlayer } from "./SimulationPlayer";
import { INITIAL_MODES, QUALITY_RADIUS } from "@/lib/coverage/experiment";
import type { RunResult } from "@/lib/coverage/runResult";
import type { PhiConfig } from "@/lib/coverage/phi";
import { QualityChart } from "./QualityChart";

export function downloadFile(
  name: string,
  content: string | Blob,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(
    typeof content === "string"
      ? new Blob([type.startsWith("text/csv") ? "\ufeff" : "", content], {
          type,
        })
      : content,
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadComparisonFigure(
  entries: { label: string; result: RunResult }[],
) {
  const width = 1200,
    panel = 560,
    gap = 40,
    header = 100,
    rows = Math.ceil(entries.length / 2);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = header + rows * (panel + 104);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("Coverage Web | 最終配置の比較", 24, 40);
  ctx.font = "16px sans-serif";
  ctx.fillText("各条件の領域全体を表示 / 実行モデルは保存結果に記録", 24, 72);
  entries.forEach(({ label, result: r }, i) => {
    const left = 20 + (i % 2) * (panel + gap),
      top = header + Math.floor(i / 2) * (panel + 104),
      frame = r.frames.at(-1)!;
    ctx.fillStyle = "#111827";
    ctx.font = "bold 21px sans-serif";
    ctx.fillText(label, left, top + 24, panel);
    ctx.font = "15px sans-serif";
    ctx.fillText(
      `N=${frame.positions.length} / seed=${r.seed} / step=${frame.step} / ${r.settings ? INITIAL_MODES[r.settings.initialMode] : "一様"}`,
      left,
      top + 49,
      panel,
    );
    const scale = Math.min(panel / r.grid.width, panel / r.grid.height),
      ox = left + (panel - r.grid.width * scale) / 2,
      oy = top + 64 + (panel - r.grid.height * scale) / 2;
    ctx.strokeStyle = "#d1d5db";
    ctx.strokeRect(ox, oy, r.grid.width * scale, r.grid.height * scale);
    const radius = Math.max(
      1.2,
      Math.min(3.6, 30 / Math.sqrt(frame.positions.length)),
    );
    for (const [x, y] of frame.positions) {
      ctx.beginPath();
      ctx.arc(
        ox + (x + 0.5) * scale,
        oy + (y + 0.5) * scale,
        radius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const q = r.quality?.at(-1);
    ctx.font = "15px sans-serif";
    if (q)
      ctx.fillText(
        `輪郭充足率 ${(q.edgeCoverage * 100).toFixed(1)}% / 平均輪郭距離 ${q.meanEdgeDistance.toFixed(2)}セル`,
        left,
        top + panel + 88,
        panel,
      );
  });
  canvas.toBlob((blob) => {
    if (blob) downloadFile("coverage-comparison.png", blob);
  });
}

export function ExperimentResult({
  result,
  label = "実行結果",
  config,
}: {
  result: RunResult;
  label?: string;
  config?: PhiConfig;
}) {
  const figure = useRef<HTMLDivElement>(null);
  const final = result.frames.at(-1)!,
    quality = result.quality?.at(-1);
  const prefix = `coverage-${final.positions.length}-${result.seed}`;
  const serverModel = result.settings?.algorithm === "server-v1";
  const exportPng = () => {
    const source = figure.current?.querySelector("canvas");
    if (!source) return;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height + 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(label, 16, 26);
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `N=${final.positions.length} / seed=${result.seed} / ${result.grid.width}×${result.grid.height} / ${serverModel ? "研究モデル" : "Lloyd"}`,
      16,
      49,
    );
    ctx.drawImage(source, 0, 64);
    canvas.toBlob((blob) => {
      if (blob) downloadFile(`${prefix}.png`, blob);
    });
  };
  const exportCsv = () => {
    const settings = result.settings;
    const header = `step,${serverModel ? "outline_error" : "H"},mean_edge_distance_cells,edge_coverage_radius_3,agents,seed,initial_mode,grid_width,grid_height,algorithm,max_steps,stop_reason,F1,executed_steps,size_mode`;
    const rows = result.costs.map((cost, step) => {
      const q = result.quality?.find((q) => q.step === step);
      return [
        step,
        cost,
        q?.meanEdgeDistance ?? "",
        q?.edgeCoverage ?? "",
        final.positions.length,
        result.seed,
        settings?.initialMode ?? "uniform",
        result.grid.width,
        result.grid.height,
        settings?.algorithm ?? "lloyd",
        settings?.maxSteps ?? final.step,
        settings?.stopReason ?? "limit",
        q?.f1 ?? "",
        settings?.executedSteps ?? final.step,
        settings?.sizeMode ?? "",
      ].join(",");
    });
    downloadFile(`${prefix}-metrics.csv`, [header, ...rows].join("\n"));
  };
  const button =
    "rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";
  return (
    <div className="min-w-0 space-y-4" ref={figure}>
      <div className="text-sm text-neutral-500">
        {result.settings && (
          <>
            {INITIAL_MODES[result.settings.initialMode]} ·{" "}
            {result.settings.stopReason === "budget"
              ? "計算時間の上限に到達"
              : result.settings.stopReason === "converged"
                ? serverModel
                  ? "評価の改善が落ち着いたため終了"
                  : "位置変化が収束"
                : "指定ステップに到達"}{" "}
            ·{" "}
          </>
        )}
        {final.step}ステップ · シード {result.seed}
        {serverModel &&
          ` · 採用 ${final.step} / 実行 ${result.settings?.executedSteps ?? final.step}ステップ · 研究モデル · サイズ${result.settings?.sizeMode === "fixed" ? "固定" : "自動"}`}
      </div>
      {quality && (
        <div
          className={`grid ${quality.f1 !== undefined ? "grid-cols-3" : "grid-cols-2"} gap-3 rounded bg-neutral-100 p-3 dark:bg-neutral-900`}
        >
          {quality.f1 !== undefined && (
            <div>
              <div className="text-xs text-neutral-500">F1スコア ↑</div>
              <strong className="font-mono text-xl">
                {quality.f1.toFixed(3)}
              </strong>
            </div>
          )}
          <div>
            <div className="text-xs text-neutral-500">輪郭充足率 ↑</div>
            <strong className="font-mono text-xl">
              {(quality.edgeCoverage * 100).toFixed(1)}%
            </strong>
          </div>
          <div>
            <div className="text-xs text-neutral-500">平均輪郭距離 ↓</div>
            <strong className="font-mono text-xl">
              {quality.meanEdgeDistance.toFixed(2)}{" "}
              <span className="text-xs">セル</span>
            </strong>
          </div>
        </div>
      )}
      <SimulationPlayer
        grid={result.grid}
        frames={result.frames}
        costs={result.costs}
        plain={!!result.settings}
        serverModel={serverModel}
      />
      {result.quality && (
        <details>
          <summary className="cursor-pointer text-sm">輪郭充足率の推移</summary>
          <QualityChart
            series={[
              { label: "輪郭充足率", color: "#0284c7", values: result.quality },
            ]}
          />
        </details>
      )}
      {quality?.f1 !== undefined && (
        <details>
          <summary className="cursor-pointer text-sm">F1スコアの推移</summary>
          <QualityChart
            metric="f1"
            series={[
              { label: "F1", color: "#16a34a", values: result.quality! },
            ]}
          />
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={exportPng}>
          表示中の配置図 PNG
        </button>
        <button className={button} onClick={exportCsv}>
          評価値 CSV
        </button>
        <button
          className={button}
          onClick={() =>
            downloadFile(
              `${prefix}-positions.csv`,
              "robot,x_cell,y_cell\n" +
                final.positions
                  .map((p, i) => [i + 1, ...p].join(","))
                  .join("\n"),
            )
          }
        >
          最終座標 CSV
        </button>
        <button
          className={button}
          onClick={() =>
            downloadFile(
              `${prefix}-result.json`,
              JSON.stringify(
                serverModel ? { result } : { result, phiConfig: config },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          条件・結果 JSON
        </button>
      </div>
      {quality && (
        <p className="text-xs leading-relaxed text-neutral-500">
          輪郭充足率は、半径{QUALITY_RADIUS}
          セル以内にロボットがいる輪郭セルの割合。平均輪郭距離は、各ロボットから最寄り輪郭セルまでの距離の平均です。
          {serverModel
            ? "F1と輪郭誤差は同じ画像・解像度で比較してください。配置は評価に基づいて採用した時点を表示します。"
            : "Hは同じΦ・解像度の条件内で比較してください。"}
        </p>
      )}
    </div>
  );
}

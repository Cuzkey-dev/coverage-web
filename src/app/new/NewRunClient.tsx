"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { saveRun } from "@/app/actions";
import { CostChart } from "@/components/CostChart";
import {
  ExperimentResult,
  downloadFile,
  downloadComparisonFigure,
} from "@/components/ExperimentResult";
import { QualityChart } from "@/components/QualityChart";
import { ImageCanvas } from "@/components/ImageCanvas";
import { SimulationCanvas } from "@/components/SimulationCanvas";
import {
  INITIAL_MODES,
  type ExperimentInput,
  type ExperimentProgress,
  type InitialMode,
} from "@/lib/coverage/experiment";
import { getOwnerToken } from "@/lib/coverage/ownerToken";
import {
  DEFAULT_PHI_CONFIG,
  EDGE_METHODS,
  MAX_GRID_SIZE,
  phiFromImage,
  sanitizePhiConfig,
  type ImageLike,
  type PhiConfig,
} from "@/lib/coverage/phi";
import type { RunResult } from "@/lib/coverage/runResult";
import { createCatalogImage, SAMPLES } from "@/lib/coverage/samples";
import {
  MAX_AGENTS,
  MAX_STEPS,
  sanitizeSimulationOptions,
} from "@/lib/coverage/simulate";

const samples = SAMPLES.map((s) => ({ ...s, image: createCatalogImage(s.id) }));
const initialConfig: PhiConfig = {
  ...DEFAULT_PHI_CONFIG,
  gridWidth: 128,
  gridHeight: 128,
  floor: 0,
  bandSigma: 1,
};
const button =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800";
const primary =
  "rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-40";
const field =
  "w-full min-w-0 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";
const colors = ["#0284c7", "#ea580c", "#16a34a", "#a855f7"];
type Entry = {
  label: string;
  result: RunResult;
  config: PhiConfig;
  id?: string;
};

async function readImage(file: File): Promise<ImageLike> {
  if (!file.type.startsWith("image/"))
    throw new Error("画像ファイルを選んでください。");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("20MB以下の画像を選んでください。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像を処理できません。");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      width: canvas.width,
      height: canvas.height,
      data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function NewRunClient() {
  const [source, setSource] = useState({ name: "鳥", image: samples[0].image });
  const [config, setConfig] = useState<PhiConfig>(initialConfig);
  const [options, setOptions] = useState({ agents: 120, steps: 600, seed: 7 });
  const [initialMode, setInitialMode] = useState<InitialMode>("weighted");
  const [results, setResults] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<
    (ExperimentProgress & { label: string; job: number; total: number }) | null
  >(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const workerRef = useRef<Worker | null>(null),
    rejectRef = useRef<((e: Error) => void) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const deferred = useDeferredValue(config);
  const grid = useMemo(
    () => phiFromImage(source.image, deferred),
    [source.image, deferred],
  );
  const busy = running || saving !== null;
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      rejectRef.current?.(new Error("cancelled"));
    },
    [],
  );

  const chooseImage = (name: string, image: ImageLike) => {
    setSource({ name, image });
    setError("");
    setProgress(null);
    setConfig((c) => ({
      ...c,
      gridHeight: Math.max(
        8,
        Math.min(
          MAX_GRID_SIZE,
          Math.round((c.gridWidth * image.height) / image.width),
        ),
      ),
    }));
  };
  const upload = async (file?: File) => {
    if (!file || busy) return;
    try {
      chooseImage(file.name, await readImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込めませんでした。");
    }
  };
  const patchConfig = (patch: Partial<PhiConfig>) =>
    setConfig((c) => sanitizePhiConfig({ ...c, ...patch }));

  const run = async (kind: "single" | "counts" | "initial") => {
    if (busy) return;
    const opts = sanitizeSimulationOptions(options);
    const jobs =
      kind === "counts"
        ? [120, 300, 600, 1200].map((agents) => ({
            agents,
            mode: initialMode,
            label: `${agents}台`,
          }))
        : kind === "initial"
          ? (["uniform", "corner", "half", "boundary"] as InitialMode[]).map(
              (mode) => ({
                agents: opts.agents,
                mode,
                label: INITIAL_MODES[mode],
              }),
            )
          : [
              {
                agents: opts.agents,
                mode: initialMode,
                label: `${opts.agents}台 · ${INITIAL_MODES[initialMode]}`,
              },
            ];
    setRunning(true);
    setResults([]);
    setError("");
    setProgress(null);
    try {
      for (let job = 0; job < jobs.length; job++) {
        const item = jobs[job];
        const input: ExperimentInput = {
          image: source.image,
          imageName: source.name,
          phiConfig: config,
          options: { ...opts, agents: item.agents },
          initialMode: item.mode,
        };
        const result = await new Promise<RunResult>((resolve, reject) => {
          rejectRef.current = reject;
          const worker = new Worker(
            new URL("../../lib/coverage/experiment.worker.ts", import.meta.url),
            { type: "module" },
          );
          workerRef.current = worker;
          worker.onmessage = (event) => {
            if (event.data.type === "progress")
              setProgress({
                ...event.data.progress,
                label: item.label,
                job: job + 1,
                total: jobs.length,
              });
            if (event.data.type === "complete") {
              worker.terminate();
              workerRef.current = null;
              rejectRef.current = null;
              resolve(event.data.result);
            }
            if (event.data.type === "error") {
              worker.terminate();
              reject(new Error(event.data.message));
            }
          };
          worker.onerror = () => {
            worker.terminate();
            reject(
              new Error(
                "計算を開始できませんでした。ページを再読み込みしてください。",
              ),
            );
          };
          worker.postMessage(input);
        });
        setResults((prev) => [
          ...prev,
          { label: `${source.name} / ${item.label}`, result, config },
        ]);
      }
    } catch (e) {
      if (!(e instanceof Error && e.message === "cancelled"))
        setError(e instanceof Error ? e.message : "計算に失敗しました。");
    } finally {
      workerRef.current = null;
      rejectRef.current = null;
      setRunning(false);
    }
  };
  const cancel = () => {
    workerRef.current?.terminate();
    rejectRef.current?.(new Error("cancelled"));
  };
  const save = async (index: number) => {
    if (busy) return;
    const entry = results[index];
    setSaving(index);
    setError("");
    try {
      const response = await saveRun({
        title:
          `${title.trim() ? title.trim() + " / " : ""}${entry.label}`.slice(
            0,
            100,
          ),
        agents: entry.result.frames[0].positions.length,
        steps: entry.result.costs.length - 1,
        phiConfig: entry.config,
        result: entry.result,
        ownerToken: getOwnerToken(),
      });
      if (!response.ok) setError(response.error);
      else
        setResults((prev) =>
          prev.map((e, i) => (i === index ? { ...e, id: response.id } : e)),
        );
    } catch {
      setError(
        "保存できませんでした。通信状態を確認し、もう一度お試しください。",
      );
    } finally {
      setSaving(null);
    }
  };
  const exportComparison = () => {
    const header =
      "agents,seed,initial_mode,steps,H,mean_edge_distance_cells,edge_coverage_radius_3";
    const rows = results.map(({ result: r }) =>
      [
        r.frames[0].positions.length,
        r.seed,
        r.settings?.initialMode,
        r.costs.length - 1,
        r.finalCost,
        r.quality?.at(-1)?.meanEdgeDistance,
        r.quality?.at(-1)?.edgeCoverage,
      ].join(","),
    );
    downloadFile("coverage-comparison.csv", [header, ...rows].join("\n"));
  };

  return (
    <div className="space-y-10">
      <fieldset disabled={busy} className="min-w-0 space-y-8">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">1. 画像を選ぶ</h2>
            <button className={button} onClick={() => fileRef.current?.click()}>
              画像をアップロード
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="画像ファイル"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {samples.map((s) => (
              <button
                key={s.id}
                aria-pressed={source.name === s.name}
                className={`overflow-hidden rounded-xl border-2 text-left ${source.name === s.name ? "border-sky-500" : "border-neutral-200 dark:border-neutral-800"}`}
                onClick={() => chooseImage(s.name, s.image)}
              >
                <ImageCanvas image={s.image} label={`サンプル ${s.name}`} />
                <div className="p-2">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="hidden text-xs text-neutral-500 sm:block">
                    {s.detail}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div
            className="grid items-start gap-5 md:grid-cols-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void upload(e.dataTransfer.files[0]);
            }}
          >
            <div className="min-w-0">
              <p className="mb-2 truncate text-sm text-neutral-500">
                入力：{source.name} · ここへ画像をドロップできます
              </p>
              <ImageCanvas
                image={source.image}
                label={`入力画像 ${source.name}`}
                className="max-h-72 rounded-lg border border-neutral-200 object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-sm text-neutral-500">
                重要度 Φ · {grid.width} × {grid.height} セル
                {config !== deferred ? " · 更新中" : ""}
              </p>
              <SimulationCanvas
                grid={grid}
                className="max-h-72 object-contain"
              />
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">2. 実行条件</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span>ロボット台数（最大1,200）</span>
              <input
                className={field}
                type="number"
                min={1}
                max={MAX_AGENTS}
                value={options.agents}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, agents: Number(e.target.value) }))
                }
                onBlur={() => setOptions(sanitizeSimulationOptions)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>最大ステップ数</span>
              <input
                className={field}
                type="number"
                min={1}
                max={MAX_STEPS}
                value={options.steps}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, steps: Number(e.target.value) }))
                }
                onBlur={() => setOptions(sanitizeSimulationOptions)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>初期配置</span>
              <select
                className={field}
                value={initialMode}
                onChange={(e) => setInitialMode(e.target.value as InitialMode)}
              >
                {Object.entries(INITIAL_MODES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>乱数シード</span>
              <input
                className={field}
                type="number"
                value={options.seed}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, seed: Number(e.target.value) }))
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-500">台数プリセット</span>
            {[40, 120, 300, 600, 1200].map((n) => (
              <button
                className={button}
                key={n}
                onClick={() => setOptions((o) => ({ ...o, agents: n }))}
              >
                {n}台
              </button>
            ))}
          </div>
          <details className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <summary className="cursor-pointer text-sm font-medium">
              画像処理・解像度の詳細
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                エッジ検出
                <select
                  className={field}
                  value={config.method}
                  onChange={(e) =>
                    patchConfig({
                      method: e.target.value as PhiConfig["method"],
                    })
                  }
                >
                  {EDGE_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  ["入力のぼかし σ", "blurSigma", 0, 5, 0.1],
                  ["輪郭帯のぼかし σ（セル）", "bandSigma", 0, 8, 0.1],
                  ["背景の重み", "floor", 0, 1, 0.001],
                  ["グリッド幅", "gridWidth", 8, 256, 1],
                  ["グリッド高さ", "gridHeight", 8, 256, 1],
                  ...(config.method === "canny"
                    ? [
                        ["下限閾値", "lowThreshold", 0, 1, 0.01],
                        ["上限閾値", "highThreshold", 0, 1, 0.01],
                      ]
                    : [["閾値", "threshold", 0, 1, 0.01]]),
                ] as [string, keyof PhiConfig, number, number, number][]
              ).map(([label, key, min, max, step]) => (
                <label key={key} className="space-y-1 text-sm">
                  {label}
                  <input
                    className={field}
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={config[key] ?? 0}
                    onChange={(e) =>
                      patchConfig({ [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          <p className="text-xs leading-relaxed text-neutral-500">
            公開版は点ロボットを重心へ移すLloyd法です。「輪郭近くに分散」はΦに比例して初期点を生成します。実機の旋回・衝突回避はモデル化していません。移動量が0.001セル未満で5回続くと終了します（最低10ステップ）。
          </p>
          <div className="flex flex-wrap gap-3">
            <button className={primary} onClick={() => void run("single")}>
              この条件で実行
            </button>
            <button className={button} onClick={() => void run("counts")}>
              120・300・600・1,200台を比較
            </button>
            <button className={button} onClick={() => void run("initial")}>
              4つの初期配置を比較
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            比較では画像・Φ・解像度・シードを固定します。台数が多い実行は時間がかかる場合があります。
          </p>
        </section>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {running && (
        <section
          role="status"
          aria-live="polite"
          className="space-y-3 rounded-xl border border-sky-300 p-4"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <p>
              {progress
                ? `${progress.job}/${progress.total} · ${progress.label} · ${progress.step}/${progress.maxSteps}ステップ`
                : "計算を準備中…"}
            </p>
            <button className={button} onClick={cancel}>
              計算を中止
            </button>
          </div>
          <progress
            className="w-full"
            value={progress?.step ?? 0}
            max={progress?.maxSteps ?? options.steps}
          />
          {progress && (
            <div className="mx-auto max-w-sm">
              <SimulationCanvas
                grid={grid}
                frames={[progress.frame]}
                showHeatmap={false}
                showTrails={false}
                monochrome
              />
            </div>
          )}
        </section>
      )}
      {results.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">実行結果</h2>
            {results.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  onClick={() => downloadComparisonFigure(results)}
                >
                  比較図 PNG
                </button>
                <button className={button} onClick={exportComparison}>
                  比較表 CSV
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            以下は実行時の条件による結果です。上の入力を変更した場合は、再実行すると更新されます。
          </p>
          {results.length > 1 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="p-2">条件</th>
                      <th className="p-2">輪郭充足率 ↑</th>
                      <th className="p-2">輪郭距離 ↓</th>
                      <th className="p-2">終了ステップ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((e, i) => (
                      <tr
                        key={i}
                        className="border-b border-neutral-200 dark:border-neutral-800"
                      >
                        <td className="p-2">{e.label}</td>
                        <td className="p-2 font-mono">
                          {(
                            (e.result.quality?.at(-1)?.edgeCoverage ?? 0) * 100
                          ).toFixed(1)}
                          %
                        </td>
                        <td className="p-2 font-mono">
                          {e.result.quality
                            ?.at(-1)
                            ?.meanEdgeDistance.toFixed(2)}
                          セル
                        </td>
                        <td className="p-2 font-mono">
                          {e.result.costs.length - 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mx-auto max-w-3xl">
                <h3 className="text-sm font-medium">輪郭充足率の推移</h3>
                <QualityChart
                  series={results.map((e, i) => ({
                    label: e.label,
                    color: colors[i % colors.length],
                    values: e.result.quality ?? [],
                  }))}
                />
                <h3 className="mt-4 text-sm font-medium">H の推移</h3>
                <CostChart
                  series={results.map((e, i) => ({
                    label: `${e.result.frames[0].positions.length}台 / ${INITIAL_MODES[e.result.settings!.initialMode]}`,
                    color: colors[i % colors.length],
                    values: e.result.costs,
                  }))}
                />
              </div>
            </>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              保存名の接頭辞
              <input
                maxLength={50}
                className={`${field} mt-1`}
                value={title}
                placeholder="任意：輪郭比較"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <p className="max-w-lg text-xs leading-relaxed text-neutral-500">
              「公開保存」でΦ・条件・座標・評価値を共有します。Φから画像の輪郭を読み取れるため、公開可能な画像だけを保存してください。画像ファイル自体は送信しません。
            </p>
          </div>
          <div
            className={`grid gap-8 ${results.length > 1 ? "xl:grid-cols-2" : "max-w-3xl"}`}
          >
            {results.map((entry, i) => (
              <article
                className="min-w-0 space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
                key={`${entry.label}-${i}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{entry.label}</h3>
                  {entry.id ? (
                    <Link
                      className="text-sm text-sky-600 underline"
                      href={`/runs/${entry.id}`}
                    >
                      保存済みの結果を開く
                    </Link>
                  ) : (
                    <button
                      disabled={busy}
                      className={primary}
                      onClick={() => void save(i)}
                    >
                      {saving === i ? "保存中…" : "この結果を公開保存"}
                    </button>
                  )}
                </div>
                <ExperimentResult
                  result={entry.result}
                  label={entry.label}
                  config={entry.config}
                />
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

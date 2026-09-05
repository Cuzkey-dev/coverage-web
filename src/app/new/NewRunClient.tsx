"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { saveRun } from "@/app/actions";
import { SimulationCanvas } from "@/components/SimulationCanvas";
import { SimulationPlayer } from "@/components/SimulationPlayer";
import { getOwnerToken } from "@/lib/coverage/ownerToken";
import { METHOD_LABELS } from "@/lib/coverage/params";
import {
  DEFAULT_PHI_CONFIG,
  EDGE_METHODS,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  phiFromImage,
  sanitizePhiConfig,
  type ImageLike,
  type PhiConfig,
} from "@/lib/coverage/phi";
import { buildRunResult, type StoredFrame } from "@/lib/coverage/runResult";
import { createSampleImage, SAMPLE_IMAGE_NAME } from "@/lib/coverage/sampleImage";
import {
  DEFAULT_SIMULATION_OPTIONS,
  MAX_AGENTS,
  MAX_STEPS,
  MIN_AGENTS,
  MIN_STEPS,
  sanitizeSimulationOptions,
  simulateStepwise,
  type SimulationOptions,
} from "@/lib/coverage/simulate";
import type { PhiGrid } from "@/lib/coverage/types";

/** 処理に使う画像の長辺（画素）。大きい画像はここまで縮めてからエッジ検出する */
const MAX_PROCESS_SIZE = 512;

type LoadedImage = {
  name: string;
  /** 表示用の URL（object URL か data URL） */
  url: string;
  /** エッジ検出に使う縮小画像 */
  data: ImageLike;
  originalWidth: number;
  originalHeight: number;
};

type RunOutput = {
  grid: PhiGrid;
  phiConfig: PhiConfig;
  options: SimulationOptions;
  frames: StoredFrame[];
  costs: number[];
};

/** 描画済みの画像要素から処理用データとサムネイルを作る */
function fromDrawable(
  name: string,
  source: CanvasImageSource,
  width: number,
  height: number,
  url: string,
): LoadedImage {
  const scale = Math.min(1, MAX_PROCESS_SIZE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas を使えません");
  ctx.drawImage(source, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  return {
    name,
    url,
    data: { width: w, height: h, data: imageData.data },
    originalWidth: width,
    originalHeight: height,
  };
}

function loadImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(fromDrawable(file.name, img, img.naturalWidth, img.naturalHeight, url));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("画像として読み込めませんでした"));
    img.src = url;
  });
}

/**
 * 画像を持っていなくても試せるサンプル。図形の輪郭がそのままエッジになる。
 * 画素は canvas 非依存の純粋関数（sampleImage.ts）で作り、表示用の URL を得るためだけに canvas へ描く。
 */
function makeSampleImage(): LoadedImage {
  const image = createSampleImage();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas を使えません");
  const imageData = ctx.createImageData(image.width, image.height);
  imageData.data.set(image.data);
  ctx.putImageData(imageData, 0, 0);
  return fromDrawable(
    SAMPLE_IMAGE_NAME,
    canvas,
    image.width,
    image.height,
    canvas.toDataURL("image/png"),
  );
}

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.round(Math.min(hi, Math.max(lo, v)));
}

const inputClass =
  "w-24 rounded border border-neutral-300 bg-transparent px-2 py-1 font-mono text-sm dark:border-neutral-700";
const primaryButton =
  "rounded bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton =
  "rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800";

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-neutral-500">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function NewRunClient() {
  const router = useRouter();

  // ---- 1. 画像と Φ ----
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [config, setConfig] = useState<PhiConfig>(DEFAULT_PHI_CONFIG);
  const [keepAspect, setKeepAspect] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // スライダーを速く動かしても入力が詰まらないよう、Φ の再計算は遅延値で行う
  const deferredConfig = useDeferredValue(config);
  const phi = useMemo(
    () => (image ? phiFromImage(image.data, deferredConfig) : null),
    [image, deferredConfig],
  );
  const phiStale = deferredConfig !== config;

  const applyImage = useCallback(
    (loaded: LoadedImage) => {
      setImage((prev) => {
        if (prev?.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
        return loaded;
      });
      setImageError(null);
      // グリッドの縦横比を画像に合わせる
      setConfig((c) => {
        if (!keepAspect) return c;
        const gridHeight = clampInt(
          (c.gridWidth * loaded.data.height) / loaded.data.width,
          MIN_GRID_SIZE,
          MAX_GRID_SIZE,
        );
        return { ...c, gridHeight };
      });
    },
    [keepAspect],
  );

  const onFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setImageError("画像ファイルを選んでください");
        return;
      }
      try {
        applyImage(await loadImageFile(file));
      } catch (e) {
        setImageError(e instanceof Error ? e.message : "画像を読み込めませんでした");
      }
    },
    [applyImage],
  );

  const updateConfig = (patch: Partial<PhiConfig>) =>
    setConfig((c) => sanitizePhiConfig({ ...c, ...patch }));

  const setGridWidth = (gridWidth: number) =>
    setConfig((c) => {
      const next = sanitizePhiConfig({ ...c, gridWidth });
      if (keepAspect && image) {
        next.gridHeight = clampInt(
          (next.gridWidth * image.data.height) / image.data.width,
          MIN_GRID_SIZE,
          MAX_GRID_SIZE,
        );
      }
      return next;
    });

  // ---- 2. シミュレーション ----
  const [options, setOptions] = useState<SimulationOptions>(DEFAULT_SIMULATION_OPTIONS);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<RunOutput | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

  const run = () => {
    if (!phi || running) return;
    const grid = phi;
    const phiConfig = deferredConfig;
    const opts = sanitizeSimulationOptions(options);
    const gen = simulateStepwise(grid, opts);
    const frames: StoredFrame[] = [];
    const costs: number[] = [];
    cancelRef.current = false;
    setRunning(true);
    setProgress(0);
    setOutput(null);

    // 1 フレームあたり最大 16ms だけ計算し、残りは次のフレームに回して画面を固めない
    const tick = () => {
      if (cancelRef.current) {
        setRunning(false);
        return;
      }
      const start = performance.now();
      while (performance.now() - start < 16) {
        const next = gen.next();
        if (next.done) {
          setOutput({ grid, phiConfig, options: opts, frames, costs });
          setRunning(false);
          setProgress(opts.steps);
          return;
        }
        frames.push({
          step: next.value.step,
          positions: next.value.positions.map((p) => [p.x, p.y]),
        });
        costs.push(next.value.cost);
      }
      setProgress(frames.length - 1);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const cancel = () => {
    cancelRef.current = true;
  };

  // ---- 3. 保存 ----
  const [title, setTitle] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const save = () => {
    if (!output || !image) return;
    setSaveError(null);
    const result = buildRunResult({
      grid: output.grid,
      seed: output.options.seed,
      simulation: {
        positions: output.frames.map((f) => f.positions.map(([x, y]) => ({ x, y }))),
        costs: output.costs,
      },
      imageName: image.name,
    });
    startSaving(async () => {
      const res = await saveRun({
        title: title.trim() || defaultTitle(image.name, output.options),
        agents: output.options.agents,
        steps: output.options.steps,
        phiConfig: output.phiConfig,
        result,
        ownerToken: getOwnerToken(),
      });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      router.push(`/runs/${res.id}`);
    });
  };

  const cells = config.gridWidth * config.gridHeight;
  const phiSummary = useMemo(() => {
    if (!phi) return null;
    const above = phi.phi.filter((v) => v > deferredConfig.floor + 1e-6).length;
    return { above, ratio: (above / phi.phi.length) * 100 };
  }, [phi, deferredConfig.floor]);

  return (
    <div className="flex flex-col gap-12">
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          <span className="mr-2 font-mono text-sm text-neutral-500">STEP 1</span>
          画像から Φ を作る
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void onFiles(e.dataTransfer.files);
              }}
              className={`flex min-h-40 flex-col items-center justify-center gap-2 rounded border-2 border-dashed p-4 text-center text-sm ${
                dragging
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40"
                  : "border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt={image.name}
                  className="max-h-64 max-w-full rounded object-contain"
                />
              ) : (
                <p className="text-neutral-500">ここに画像をドラッグ＆ドロップ</p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => fileInputRef.current?.click()}
                >
                  画像を選ぶ
                </button>
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => applyImage(makeSampleImage())}
                >
                  サンプル画像を使う
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onFiles(e.target.files)}
                />
              </div>
              {image && (
                <p className="text-xs text-neutral-500">
                  {image.name} ・ {image.originalWidth}×{image.originalHeight}
                  {image.originalWidth !== image.data.width &&
                    `（処理は ${image.data.width}×${image.data.height} に縮小）`}
                </p>
              )}
              {imageError && <p className="text-xs text-red-600">{imageError}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* label で囲むと最初のボタンがラベルの対象になり、読み上げ名が
                  「エッジ検出Sobel…」になってしまう。ボタン群は group として扱う */}
              <div
                role="group"
                aria-labelledby="edge-method-label"
                className="flex flex-col gap-1 text-sm sm:col-span-2"
              >
                <span id="edge-method-label">エッジ検出</span>
                <div className="flex gap-2">
                  {EDGE_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={config.method === m}
                      onClick={() => updateConfig({ method: m })}
                      className={`rounded border px-3 py-1 ${
                        config.method === m
                          ? "border-sky-500 bg-sky-600 text-white"
                          : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              <Slider
                label="ぼかしの強さ σ"
                value={config.blurSigma}
                min={0}
                max={5}
                step={0.1}
                onChange={(v) => updateConfig({ blurSigma: v })}
                format={(v) => v.toFixed(1)}
              />
              {config.method === "canny" ? (
                <>
                  <Slider
                    label="下限閾値"
                    value={config.lowThreshold}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => updateConfig({ lowThreshold: v })}
                    format={(v) => v.toFixed(2)}
                  />
                  <Slider
                    label="上限閾値"
                    value={config.highThreshold}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => updateConfig({ highThreshold: v })}
                    format={(v) => v.toFixed(2)}
                  />
                </>
              ) : (
                <Slider
                  label="閾値"
                  value={config.threshold}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateConfig({ threshold: v })}
                  format={(v) => v.toFixed(2)}
                />
              )}
              <Slider
                label="Φ の下駄（最小重み）"
                value={config.floor}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => updateConfig({ floor: v })}
                format={(v) => v.toFixed(2)}
              />

              <div className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="flex justify-between">
                  <span>グリッド解像度（セル数）</span>
                  <span className="font-mono text-neutral-500">
                    {cells.toLocaleString()} セル
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={MIN_GRID_SIZE}
                    max={MAX_GRID_SIZE}
                    value={config.gridWidth}
                    onChange={(e) => setGridWidth(Number(e.target.value))}
                    className={inputClass}
                    aria-label="グリッド幅"
                  />
                  <span>×</span>
                  <input
                    type="number"
                    min={MIN_GRID_SIZE}
                    max={MAX_GRID_SIZE}
                    value={config.gridHeight}
                    onChange={(e) => updateConfig({ gridHeight: Number(e.target.value) })}
                    className={inputClass}
                    aria-label="グリッド高さ"
                    disabled={keepAspect && !!image}
                  />
                  <label className="flex items-center gap-1 text-xs text-neutral-500">
                    <input
                      type="checkbox"
                      checked={keepAspect}
                      onChange={(e) => setKeepAspect(e.target.checked)}
                    />
                    画像の縦横比に合わせる
                  </label>
                </div>
                <p className="text-xs text-neutral-500">
                  1 辺 {MIN_GRID_SIZE}〜{MAX_GRID_SIZE}。細かいほど正確だが、毎ステップ全セルを走査するので実行が遅くなる。
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Φ のプレビュー</span>
              {phiSummary && (
                <span className="font-mono text-xs text-neutral-500">
                  エッジのあるセル {phiSummary.above.toLocaleString()} / {cells.toLocaleString()}（
                  {phiSummary.ratio.toFixed(1)}%）
                  {phiStale && " ・ 計算中…"}
                </span>
              )}
            </div>
            {phi ? (
              <SimulationCanvas grid={phi} />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded border border-dashed border-neutral-300 text-sm text-neutral-500 dark:border-neutral-700">
                画像を入れると Φ がここに出ます
              </div>
            )}
            <p className="text-xs text-neutral-500">
              明るいほど重要度が高い。ロボットは明るい場所の近くに集まる。
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          <span className="mr-2 font-mono text-sm text-neutral-500">STEP 2</span>
          被覆制御を実行する
        </h2>
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span>ロボット台数（{MIN_AGENTS}〜{MAX_AGENTS}）</span>
            <input
              type="number"
              min={MIN_AGENTS}
              max={MAX_AGENTS}
              value={options.agents}
              onChange={(e) => setOptions((o) => ({ ...o, agents: Number(e.target.value) }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>ステップ数（{MIN_STEPS}〜{MAX_STEPS}）</span>
            <input
              type="number"
              min={MIN_STEPS}
              max={MAX_STEPS}
              value={options.steps}
              onChange={(e) => setOptions((o) => ({ ...o, steps: Number(e.target.value) }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>初期配置のシード</span>
            <input
              type="number"
              value={options.seed}
              onChange={(e) => setOptions((o) => ({ ...o, seed: Number(e.target.value) }))}
              className={inputClass}
            />
          </label>
          {running ? (
            <button type="button" className={secondaryButton} onClick={cancel}>
              中止（{progress} / {sanitizeSimulationOptions(options).steps}）
            </button>
          ) : (
            <button
              type="button"
              className={primaryButton}
              onClick={run}
              disabled={!phi || phiStale}
            >
              実行
            </button>
          )}
          {!phi && <span className="text-neutral-500">先に画像を入れてください</span>}
        </div>

        {output && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-neutral-500">
              Φ: {METHOD_LABELS[output.phiConfig.method]} / {output.grid.width}×{output.grid.height}
              　台数 {output.options.agents} ・ {output.options.steps} ステップ ・ シード {output.options.seed}
            </p>
            <SimulationPlayer grid={output.grid} frames={output.frames} costs={output.costs} />
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          <span className="mr-2 font-mono text-sm text-neutral-500">STEP 3</span>
          保存する
        </h2>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-1 flex-col gap-1">
            <span>タイトル</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                output && image ? defaultTitle(image.name, output.options) : "実行してから保存できます"
              }
              maxLength={100}
              className="w-full max-w-md rounded border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700"
            />
          </label>
          <button
            type="button"
            className={primaryButton}
            onClick={save}
            disabled={!output || saving}
          >
            {saving ? "保存中…" : "保存"}
          </button>
          {saveError && <span className="text-red-600">{saveError}</span>}
        </div>
        <p className="text-xs text-neutral-500">
          保存されるのは Φ・パラメータ・位置履歴（最大 121 フレームに間引き）・評価値の推移・画像のファイル名。
          <strong>画像そのものは保存しません。</strong>保存した実行は誰からも見え、削除できるのはこのブラウザだけです。
        </p>
      </section>
    </div>
  );
}

function defaultTitle(imageName: string, options: SimulationOptions): string {
  const base = imageName.replace(/\.[^.]+$/, "");
  return `${base} / ${options.agents}台 ${options.steps}step seed${options.seed}`;
}

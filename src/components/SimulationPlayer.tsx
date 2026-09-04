"use client";

import { useEffect, useState } from "react";
import { CostChart } from "./CostChart";
import { SimulationCanvas } from "./SimulationCanvas";
import { formatCost } from "@/lib/format";
import type { StoredFrame } from "@/lib/coverage/runResult";
import type { PhiGrid } from "@/lib/coverage/types";

type Props = {
  grid: PhiGrid;
  frames: StoredFrame[];
  /** 全ステップの評価値（frames が間引かれていても costs は全ステップ分） */
  costs: number[];
};

/** 再生全体にかける時間の目安（ms）。フレーム数で割って 1 コマの長さを決める */
const PLAYBACK_DURATION_MS = 6000;
const MIN_FRAME_MS = 40;

/**
 * 実行結果の再生。再生／一時停止／ステップ送り／スライダーで動かし、
 * 評価値の折れ線に現在のステップを縦線で示す。
 */
export function SimulationPlayer({ grid, frames, costs }: Props) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(frames.length > 1);
  const [showTrails, setShowTrails] = useState(true);
  const last = frames.length - 1;

  // frames が差し替わったら先頭へ戻し、自動で再生を始める（描画中に状態を合わせる React の定石）
  const [trackedFrames, setTrackedFrames] = useState(frames);
  if (trackedFrames !== frames) {
    setTrackedFrames(frames);
    setIndex(0);
    setPlaying(frames.length > 1);
  }

  useEffect(() => {
    if (!playing) return;
    const interval = Math.max(MIN_FRAME_MS, PLAYBACK_DURATION_MS / Math.max(1, frames.length));
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i >= last) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [playing, frames.length, last]);

  if (frames.length === 0) return null;

  const step = frames[index]?.step ?? 0;
  const cost = costs[step];

  const button =
    "rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800";

  return (
    <div className="flex flex-col gap-3">
      <SimulationCanvas grid={grid} frames={frames} frameIndex={index} showTrails={showTrails} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} onClick={() => { setPlaying(false); setIndex(0); }} aria-label="最初へ">
          ⏮
        </button>
        <button
          type="button"
          className={button}
          onClick={() => { setPlaying(false); setIndex((i) => Math.max(0, i - 1)); }}
          disabled={index === 0}
          aria-label="1 ステップ戻る"
        >
          ◀
        </button>
        <button
          type="button"
          className={`${button} min-w-20`}
          onClick={() => {
            if (index >= last) setIndex(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "一時停止" : "再生"}
        </button>
        <button
          type="button"
          className={button}
          onClick={() => { setPlaying(false); setIndex((i) => Math.min(last, i + 1)); }}
          disabled={index >= last}
          aria-label="1 ステップ進む"
        >
          ▶
        </button>
        <button type="button" className={button} onClick={() => { setPlaying(false); setIndex(last); }} aria-label="最後へ">
          ⏭
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
          className="min-w-40 flex-1"
          aria-label="ステップ"
        />
        <span className="font-mono text-sm tabular-nums">
          step {step} / {frames[last]?.step ?? 0}
        </span>
        <label className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
          <input type="checkbox" checked={showTrails} onChange={(e) => setShowTrails(e.target.checked)} />
          軌跡
        </label>
      </div>

      <div className="flex items-baseline gap-3 text-sm">
        <span className="text-neutral-500">評価値 H</span>
        <span className="font-mono text-lg tabular-nums">{formatCost(cost)}</span>
        <span className="text-neutral-500">
          （最終 {formatCost(costs[costs.length - 1])}）
        </span>
      </div>

      <CostChart series={[{ label: "H", color: "#38bdf8", values: costs }]} marker={step} />
    </div>
  );
}

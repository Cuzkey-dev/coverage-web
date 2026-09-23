"use client";

import { useEffect, useRef, useState } from "react";
import {
  frameIndex,
  motionModels,
  parseMotionClip,
  type MotionClip,
  type MotionFrame,
  type MotionKind,
} from "@/lib/coverage/motion";

function Stage({
  frame,
  robots,
  overlay,
  trails,
  history,
}: {
  frame: MotionFrame;
  robots?: boolean;
  overlay?: boolean;
  trails?: boolean;
  history: MotionFrame[];
}) {
  return (
    <svg
      viewBox="0 0 256 256"
      role="img"
      aria-label={
        robots
          ? "入力の変化に追従するロボット群"
          : "時間とともに変形する入力の輪郭"
      }
      className="aspect-square w-full rounded-2xl bg-[#091525]"
    >
      {[32, 64, 96, 128, 160, 192, 224].map((v) => (
        <path
          key={v}
          d={`M ${v} 0 V 256 M 0 ${v} H 256`}
          stroke="#142438"
          strokeWidth=".4"
        />
      ))}
      {(!robots || overlay) &&
        frame.paths.map((p, i) => (
          <polyline
            key={i}
            points={p.map((v) => v.join(",")).join(" ")}
            fill="none"
            stroke={robots ? "#64748b" : "#f6c978"}
            strokeWidth={robots ? 0.8 : 1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={robots ? 0.55 : 1}
          />
        ))}
      {robots &&
        trails &&
        frame.positions.map((_, i) => (
          <polyline
            key={i}
            points={history.map((f) => f.positions[i].join(",")).join(" ")}
            fill="none"
            stroke="#58d9d0"
            strokeWidth=".45"
            opacity=".4"
          />
        ))}
      {robots &&
        frame.positions.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="1.3"
            fill={i % 12 === 0 ? "#f6c978" : "#7de4db"}
          />
        ))}
    </svg>
  );
}

const button =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800";

function Player({ kind }: { kind: MotionKind }) {
  const [clip, setClip] = useState<MotionClip | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [trails, setTrails] = useState(false);
  const clock = useRef(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/motion/${kind}.json`, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("再生データを取得できませんでした。");
        return r.json();
      })
      .then((d) => {
        if (abort.signal.aborted) return;
        setClip(parseMotionClip(d, kind));
        setPlaying(
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        );
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "読み込みに失敗しました。");
      });
    return () => abort.abort();
  }, [kind, retry]);

  useEffect(() => {
    if (!playing || !clip) return;
    let previous: number | null = null;
    let request = 0;
    const tick = (now: number) => {
      // Ignore long background gaps instead of skipping an unseen scene.
      if (previous !== null)
        clock.current += Math.min((now - previous) / 1000, 0.1) * speed;
      previous = now;
      if (clock.current >= clip.duration) {
        clock.current = loop ? clock.current % clip.duration : clip.duration;
        if (!loop) {
          setPlaying(false);
          setTime(clock.current);
          return;
        }
      }
      setTime(clock.current);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, clip, speed, loop]);

  if (error)
    return (
      <div role="alert" className="rounded-xl border border-rose-300 p-6">
        <p>{error}</p>
        <button
          className={`${button} mt-4`}
          onClick={() => {
            setError("");
            setRetry((v) => v + 1);
          }}
        >
          再読み込み
        </button>
      </div>
    );
  if (!clip)
    return (
      <div
        role="status"
        className="flex min-h-80 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
      >
        モデルを読み込んでいます…
      </div>
    );
  const index = frameIndex(time, clip),
    frame = clip.frames[index];
  const history = clip.frames.slice(Math.max(0, index - 12), index + 1);
  const seek = (t: number) => {
    clock.current = t;
    setTime(t);
  };
  const mood = Math.cos(frame.phase);
  const state =
    time < clip.settleDuration
      ? "ランダム配置から形をつくる"
      : kind === "face"
        ? mood > 0.3
          ? "笑顔"
          : mood < -0.3
            ? "不機嫌な顔"
            : "真顔へ変化"
        : kind === "bird"
          ? "翼の動きに追従"
          : "羽根の回転に追従";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
          {state}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {clip.agents}台 · 全域ランダム配置から開始
        </span>
      </div>
      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        <figure className="min-w-0">
          <figcaption className="mb-2 flex justify-between text-sm font-medium">
            <span>入力アニメーション</span>
            <span className="text-slate-500">目標の輪郭</span>
          </figcaption>
          <Stage frame={frame} history={history} />
        </figure>
        <figure className="min-w-0">
          <figcaption className="mb-2 flex justify-between text-sm font-medium">
            <span>ロボットの動き</span>
            <span className="text-slate-500">同じ時刻の計算結果</span>
          </figcaption>
          <Stage
            frame={frame}
            robots
            overlay={overlay}
            trails={trails}
            history={history}
          />
        </figure>
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <input
            aria-label="再生位置"
            type="range"
            min="0"
            max={clip.duration}
            step={1 / clip.fps}
            value={time}
            onChange={(e) => {
              setPlaying(false);
              seek(Number(e.target.value));
            }}
            className="min-w-0 flex-1 accent-teal-600"
          />
          <output className="whitespace-nowrap font-mono text-xs tabular-nums">
            {time.toFixed(1)} / {clip.duration} s
          </output>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="min-w-24 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            onClick={() => {
              if (time >= clip.duration) seek(0);
              setPlaying((v) => !v);
            }}
          >
            {playing ? "一時停止" : "再生"}
          </button>
          <button
            className={button}
            onClick={() => {
              seek(0);
              setPlaying(false);
            }}
          >
            最初へ
          </button>
          <label className="flex items-center gap-2 text-sm">
            再生速度
            <select
              aria-label="再生速度"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="rounded border border-slate-300 bg-transparent p-2 dark:border-slate-700"
            >
              {[0.5, 1, 1.5, 2].map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
            />
            繰り返す
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => setOverlay(e.target.checked)}
            />
            輪郭を重ねる
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trails}
              onChange={(e) => setTrails(e.target.checked)}
            />
            軌跡
          </label>
        </div>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          最初の4秒で形をつくり、続く20秒で入力が2周期変化します。事前計算した軌跡の再生です。速度の変更は再生だけに作用し、繰り返し時は初期配置に戻ります。金色の点は動きを追いやすくするための目印です。
        </p>
      </div>
    </div>
  );
}

export function MotionGallery() {
  const [kind, setKind] = useState<MotionKind>("bird");
  return (
    <section aria-label="動くモデルを選ぶ" className="space-y-7">
      <div className="grid gap-3 sm:grid-cols-3">
        {motionModels.map((m) => (
          <button
            key={m.id}
            aria-pressed={kind === m.id}
            onClick={() => setKind(m.id)}
            className={`rounded-2xl border p-5 text-left transition-colors ${kind === m.id ? "border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-950/50" : "border-slate-200 hover:border-teal-400 dark:border-slate-800"}`}
          >
            <span className="block font-mono text-[11px] tracking-widest text-teal-700 dark:text-teal-300">
              {m.en}
            </span>
            <span className="mt-2 block text-lg font-semibold">{m.name}</span>
            <span className="mt-2 block text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {m.description}
            </span>
          </button>
        ))}
      </div>
      <Player key={kind} kind={kind} />
    </section>
  );
}

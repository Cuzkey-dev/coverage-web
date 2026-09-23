"use client";
import { useEffect, useRef, useState } from "react";
import {
  frameIndex,
  motionModels,
  parseMotionClip,
  spriteStyle,
  type MotionClip,
  type MotionKind,
} from "@/lib/coverage/motion";

const button =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100";
function Player({ kind }: { kind: MotionKind }) {
  const [clip, setClip] = useState<MotionClip | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [loop, setLoop] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [trails, setTrails] = useState(false);
  const clock = useRef(0);
  useEffect(() => {
    const abort = new AbortController();
    const loadImage = async (layer: "input" | "edge") => {
      const image = new Image();
      image.src = `/motion/${kind}-${layer}.webp`;
      await image.decode();
      return image;
    };
    Promise.all([
      fetch(`/motion/${kind}.json`, { signal: abort.signal }).then((r) => {
        if (!r.ok) throw new Error("再生データを取得できませんでした。");
        return r.json();
      }),
      loadImage("input"),
      loadImage("edge"),
    ])
      .then(([data]) => {
        if (abort.signal.aborted) return;
        setClip(parseMotionClip(data, kind));
        setPlaying(
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        );
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "再生データを読み込めませんでした。再読み込みをお試しください。",
          );
      });
    return () => abort.abort();
  }, [kind, retry]);
  useEffect(() => {
    if (!playing || !clip) return;
    let previous: number | null = null;
    let request = 0;
    const tick = (now: number) => {
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
      <div role="alert" className="border border-red-200 p-5">
        <p>{error}</p>
        <button
          className={`${button} mt-3`}
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
      <p
        role="status"
        className="flex min-h-64 items-center justify-center bg-slate-50 text-slate-600"
      >
        モデルを読み込んでいます…
      </p>
    );
  const index = frameIndex(time, clip),
    frame = clip.frames[index];
  const history = clip.frames.slice(Math.max(0, index - 12), index + 1);
  const seek = (t: number) => {
    clock.current = t;
    setTime(t);
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-5 md:grid-cols-3">
        <figure className="min-w-0">
          <figcaption className="mb-2 font-medium">1. 入力画像</figcaption>
          <div
            role="img"
            aria-label="時間とともに変化する入力画像"
            className="aspect-square w-full border border-slate-200 bg-white"
            style={spriteStyle(kind, "input", index)}
          />
          <p className="mt-2 text-sm text-slate-600">
            塗りつぶした図形を画像として入力します。
          </p>
        </figure>
        <figure className="min-w-0">
          <figcaption className="mb-2 font-medium">
            2. 画像処理で抽出した輪郭
          </figcaption>
          <div
            role="img"
            aria-label="入力画像から実際に抽出した輪郭"
            className="aspect-square w-full border border-slate-200 bg-white"
            style={spriteStyle(kind, "edge", index)}
          />
          <p className="mt-2 text-sm text-slate-600">
            この輪郭を使い、各時刻の重要度を計算します。
          </p>
        </figure>
        <figure className="min-w-0">
          <figcaption className="mb-2 font-medium">
            3. ロボットの配置
          </figcaption>
          <div className="relative aspect-square border border-slate-200 bg-white">
            {overlay && (
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-20"
                style={spriteStyle(kind, "edge", index)}
              />
            )}
            <svg
              viewBox="0 0 256 256"
              role="img"
              aria-label="時変重要度に対するロボットの追従結果"
              className="relative h-full w-full"
            >
              {trails &&
                frame.positions.map((_, i) => (
                  <polyline
                    key={i}
                    points={history
                      .map((f) => f.positions[i].join(","))
                      .join(" ")}
                    fill="none"
                    stroke="#436580"
                    strokeWidth=".5"
                    opacity=".35"
                  />
                ))}
              {frame.positions.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="1.5" fill="#355b78" />
              ))}
            </svg>
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-[#355b78]"
            />
            青い点：ロボット1台（計{clip.agents}台）
          </p>
        </figure>
      </div>
      <div className="space-y-3 border-y border-slate-200 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">計算時刻</span>
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
            className="min-w-24 flex-1 accent-slate-600"
          />
          <output className="font-mono text-xs tabular-nums">
            {time.toFixed(1)} / {clip.duration} s
          </output>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={`${button} min-w-24`}
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
              className="rounded border border-slate-300 bg-white p-2"
            >
              {[0.5, 1, 1.5, 2].map((v) => (
                <option key={v} value={v}>
                  {v}倍{v === 2 ? "（標準）" : ""}
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
            配置に輪郭を重ねる
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trails}
              onChange={(e) => setTrails(e.target.checked)}
            />
            軌跡を表示
          </label>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          入力は開始時から動きます。ロボットの初期配置は全域ランダムです。24秒分の計算結果を標準2倍速（12秒）で再生します。再生速度を変えても計算結果は変わりません。
        </p>
      </div>
    </div>
  );
}
export function MotionGallery() {
  const [kind, setKind] = useState<MotionKind>("bird");
  return (
    <section aria-label="モデルの選択" className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {motionModels.map((m) => (
          <button
            key={m.id}
            aria-pressed={kind === m.id}
            onClick={() => setKind(m.id)}
            className={`rounded border px-4 py-3 text-left ${kind === m.id ? "border-slate-600 bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50"}`}
          >
            <span className="block font-medium">{m.name}</span>
            <span className="mt-1 block text-sm text-slate-600">
              {m.description}
            </span>
          </button>
        ))}
      </div>
      <Player key={kind} kind={kind} />
    </section>
  );
}

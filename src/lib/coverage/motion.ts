export const motionModels = [
  {
    id: "bird",
    name: "鳥の羽ばたき",
    description: "翼を広げて羽ばたく、横向きの鳥。",
  },
  {
    id: "windmill",
    name: "風車の回転",
    description: "軸を中心に回転する4枚の羽根。",
  },
  {
    id: "face",
    name: "顔の表情",
    description: "目・眉・口元で変わる表情。",
  },
] as const;
export type MotionKind = (typeof motionModels)[number]["id"];
export type Point = [number, number];
export type MotionFrame = {
  time: number;
  phase: number;
  positions: Point[];
  meanDistance: number;
};
export type MotionClip = {
  version: 2;
  kind: MotionKind;
  width: number;
  height: number;
  agents: number;
  fps: number;
  duration: number;
  settleDuration: 0;
  atlas: { columns: number; rows: number; tileSize: number };
  frames: MotionFrame[];
};
export function parseMotionClip(value: unknown, kind: MotionKind): MotionClip {
  const d = value as MotionClip;
  const point = (p: unknown): p is Point =>
    Array.isArray(p) &&
    p.length === 2 &&
    p.every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 256,
    );
  if (
    !d ||
    d.version !== 2 ||
    d.kind !== kind ||
    d.width !== 256 ||
    d.height !== 256 ||
    d.agents !== 240 ||
    d.fps !== 24 ||
    d.duration !== 24 ||
    d.settleDuration !== 0 ||
    d.atlas?.columns !== 12 ||
    d.atlas?.rows !== 49 ||
    d.atlas?.tileSize !== 128 ||
    !Array.isArray(d.frames) ||
    d.frames.length !== 577
  )
    throw new Error("再生データの形式を確認できませんでした。");
  const frames = d.frames.map((f, i) => {
    if (
      !f ||
      !Number.isFinite(f.time) ||
      Math.abs(f.time - i / d.fps) > 0.001 ||
      !Number.isFinite(f.phase) ||
      Math.abs(f.phase - (f.time / d.duration) * 4 * Math.PI) > 0.001 ||
      !Number.isFinite(f.meanDistance) ||
      f.meanDistance < 0 ||
      !Array.isArray(f.positions) ||
      f.positions.length !== d.agents ||
      !f.positions.every(point)
    )
      throw new Error("再生データが不完全です。");
    return {
      time: f.time,
      phase: f.phase,
      meanDistance: f.meanDistance,
      positions: f.positions.map(([x, y]) => [x, y] as Point),
    };
  });
  return {
    version: 2,
    kind,
    width: 256,
    height: 256,
    agents: d.agents,
    fps: d.fps,
    duration: d.duration,
    settleDuration: 0,
    atlas: { columns: 12, rows: 49, tileSize: 128 },
    frames,
  };
}
export function frameIndex(
  seconds: number,
  clip: Pick<MotionClip, "fps" | "frames">,
) {
  return Math.max(
    0,
    Math.min(clip.frames.length - 1, Math.floor(seconds * clip.fps + 1e-6)),
  );
}
export function spriteStyle(
  kind: MotionKind,
  layer: "input" | "edge",
  index: number,
) {
  return {
    backgroundImage: `url(/motion/${kind}-${layer}.webp)`,
    backgroundSize: "1200% 4900%",
    backgroundPosition: `${((index % 12) / 11) * 100}% ${(Math.floor(index / 12) / 48) * 100}%`,
  };
}

export const motionModels = [
  {
    id: "bird",
    name: "鳥の羽ばたき",
    en: "01 / WINGBEAT",
    description: "翼を広げて、折りたたむ。輪郭の変化を群れで描く。",
  },
  {
    id: "windmill",
    name: "風車の回転",
    en: "02 / ROTATION",
    description: "支柱と回転軸を残し、4枚の羽根がゆっくり回る。",
  },
  {
    id: "face",
    name: "顔の表情",
    en: "03 / EXPRESSION",
    description: "笑顔から真顔、不機嫌な顔へ。口と眉の動きに注目。",
  },
] as const;
export type MotionKind = (typeof motionModels)[number]["id"];
export type Point = [number, number];
export type MotionFrame = {
  time: number;
  phase: number;
  paths: Point[][];
  positions: Point[];
  meanDistance: number;
};
export type MotionClip = {
  version: 1;
  kind: MotionKind;
  width: number;
  height: number;
  agents: number;
  fps: number;
  duration: number;
  settleDuration: number;
  frames: MotionFrame[];
};

/** Only presentation data is accepted; internal engine fields never enter this format. */
export function parseMotionClip(value: unknown, kind: MotionKind): MotionClip {
  const d = value as MotionClip;
  const point = (p: unknown): p is Point =>
    Array.isArray(p) &&
    p.length === 2 &&
    p.every(
      (v) =>
        typeof v === "number" && Number.isFinite(v) && v >= -32 && v <= 288,
    );
  if (
    !d ||
    d.version !== 1 ||
    d.kind !== kind ||
    d.width !== 256 ||
    d.height !== 256 ||
    !Number.isInteger(d.agents) ||
    d.agents < 1 ||
    d.agents > 1200 ||
    d.fps !== 24 ||
    d.duration !== 24 ||
    d.settleDuration !== 4 ||
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
      !Number.isFinite(f.meanDistance) ||
      f.meanDistance < 0 ||
      !Array.isArray(f.positions) ||
      f.positions.length !== d.agents ||
      !f.positions.every(point) ||
      !Array.isArray(f.paths) ||
      f.paths.length < 1 ||
      f.paths.length > 12 ||
      !f.paths.every(
        (p) =>
          Array.isArray(p) &&
          p.length >= 2 &&
          p.length <= 200 &&
          p.every(point),
      )
    )
      throw new Error("再生データが不完全です。");
    return {
      time: f.time,
      phase: f.phase,
      paths: f.paths.map((p) => p.map(([x, y]) => [x, y] as Point)),
      positions: f.positions.map(([x, y]) => [x, y] as Point),
      meanDistance: f.meanDistance,
    };
  });
  return {
    version: 1,
    kind,
    width: d.width,
    height: d.height,
    agents: d.agents,
    fps: d.fps,
    duration: d.duration,
    settleDuration: d.settleDuration,
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

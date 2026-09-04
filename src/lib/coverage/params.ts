import type { PhiConfig } from "./phi";

/**
 * 実行のパラメータを「表示用の行」に並べる純粋関数。
 * 詳細画面の一覧表と、比較画面の差分表示（変わった項目だけ強調）で共用する。
 */

export type RunParams = {
  agents: number;
  steps: number;
  seed: number;
  phiConfig: PhiConfig;
};

export type ParamKey =
  | "agents"
  | "steps"
  | "seed"
  | "method"
  | "blurSigma"
  | "threshold"
  | "lowThreshold"
  | "highThreshold"
  | "gridWidth"
  | "gridHeight"
  | "floor";

export const PARAM_LABELS: Record<ParamKey, string> = {
  agents: "ロボット台数",
  steps: "ステップ数",
  seed: "初期配置のシード",
  method: "エッジ検出",
  blurSigma: "ぼかし σ",
  threshold: "閾値",
  lowThreshold: "下限閾値",
  highThreshold: "上限閾値",
  gridWidth: "グリッド幅",
  gridHeight: "グリッド高さ",
  floor: "Φ の下駄",
};

export const METHOD_LABELS: Record<PhiConfig["method"], string> = {
  sobel: "Sobel",
  scharr: "Scharr",
  canny: "Canny",
};

/** 検出方式ごとに意味のある項目。Canny では threshold が、Sobel/Scharr では下限・上限が使われない */
export function relevantKeys(method: PhiConfig["method"]): ParamKey[] {
  const common: ParamKey[] = ["agents", "steps", "seed", "method", "blurSigma"];
  const edge: ParamKey[] =
    method === "canny" ? ["lowThreshold", "highThreshold"] : ["threshold"];
  return [...common, ...edge, "gridWidth", "gridHeight", "floor"];
}

export function paramValue(params: RunParams, key: ParamKey): string {
  switch (key) {
    case "agents":
      return String(params.agents);
    case "steps":
      return String(params.steps);
    case "seed":
      return String(params.seed);
    case "method":
      return METHOD_LABELS[params.phiConfig.method] ?? params.phiConfig.method;
    case "gridWidth":
    case "gridHeight":
      return String(params.phiConfig[key]);
    default:
      return String(params.phiConfig[key]);
  }
}

export type ParamRow = {
  key: ParamKey;
  label: string;
  a: string;
  /** 比較相手が無いときは undefined */
  b?: string;
  /** a と b が違うか。単独表示では常に false */
  changed: boolean;
};

/** 1件分の一覧 */
export function listParams(params: RunParams): ParamRow[] {
  return relevantKeys(params.phiConfig.method).map((key) => ({
    key,
    label: PARAM_LABELS[key],
    a: paramValue(params, key),
    changed: false,
  }));
}

/**
 * 2件の差分。どちらかの方式で意味のある項目の和集合を、決まった順で並べる。
 * 片方でしか使わない項目は、使わない側を「—」にして「変わった」扱いにする。
 */
export function diffParams(a: RunParams, b: RunParams): ParamRow[] {
  const keysA = relevantKeys(a.phiConfig.method);
  const keysB = relevantKeys(b.phiConfig.method);
  const order = Object.keys(PARAM_LABELS) as ParamKey[];
  const union = order.filter((k) => keysA.includes(k) || keysB.includes(k));

  return union.map((key) => {
    const va = keysA.includes(key) ? paramValue(a, key) : "—";
    const vb = keysB.includes(key) ? paramValue(b, key) : "—";
    return { key, label: PARAM_LABELS[key], a: va, b: vb, changed: va !== vb };
  });
}

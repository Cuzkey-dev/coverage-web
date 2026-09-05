import type { PhiGrid } from "./types";

/**
 * 画像から重要度関数Φを作る。
 *
 * 流れ: 画像 → グレースケール → ガウシアンぼかし → 勾配（Sobel / Scharr）
 *       → エッジ強度（Sobel/Scharr は閾値処理、Canny は非最大抑制＋ヒステリシス）
 *       → グリッド解像度へ落とす（セル内平均） → 正規化 → 下駄を履かせて PhiGrid
 *
 * どの段も純粋関数で、同じ画像と同じ PhiConfig からは必ず同じ Φ ができる。
 * ブラウザの ImageData をそのまま渡せるが、DOM には依存しない（テストは配列で書ける）。
 */

export type EdgeMethod = "sobel" | "scharr" | "canny";

/** Φ生成のパラメータ。Run.phiConfig にそのまま JSON で保存する */
export type PhiConfig = {
  /** エッジ検出の方式 */
  method: EdgeMethod;
  /** ガウシアンぼかしの標準偏差（画素単位）。0 でぼかし無し */
  blurSigma: number;
  /** Sobel / Scharr 用の閾値（最大勾配を 1 とした相対値）。これ未満の勾配は 0 にする */
  threshold: number;
  /** Canny 用の下限閾値（相対値） */
  lowThreshold: number;
  /** Canny 用の上限閾値（相対値） */
  highThreshold: number;
  /** Φ のグリッドの横セル数 */
  gridWidth: number;
  /** Φ のグリッドの縦セル数 */
  gridHeight: number;
  /** Φ の下駄。エッジが無いセルにも与える最小重み（0〜1）。0 だと空白領域を誰も担当しなくなる */
  floor: number;
};

export const EDGE_METHODS: readonly EdgeMethod[] = ["sobel", "scharr", "canny"];

/** グリッドの1辺の上限。weightedCentroids が毎ステップ全セルを走査するため、UI もこれで制限する */
export const MAX_GRID_SIZE = 128;
export const MIN_GRID_SIZE = 8;

export const DEFAULT_PHI_CONFIG: PhiConfig = {
  method: "canny",
  blurSigma: 1.4,
  threshold: 0.2,
  lowThreshold: 0.1,
  highThreshold: 0.3,
  gridWidth: 64,
  gridHeight: 48,
  floor: 0.02,
};

/** ブラウザの ImageData と同じ形。RGBA が横→縦の順に並ぶ */
export type ImageLike = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array | number[];
};

/** 幅・高さ付きの浮動小数の画像。中間段はすべてこの形で受け渡す */
export type FloatImage = {
  width: number;
  height: number;
  data: Float32Array;
};

// ---------------------------------------------------------------------------
// 1. グレースケール
// ---------------------------------------------------------------------------

/** RGBA → 輝度（0〜1）。係数は Rec.601 */
export function toGrayscale(image: ImageLike): FloatImage {
  const { width, height, data } = image;
  const out = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    out[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return { width, height, data: out };
}

// ---------------------------------------------------------------------------
// 2. ガウシアンぼかし（分離フィルタ）
// ---------------------------------------------------------------------------

function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  return kernel;
}

/** 端は最寄りの画素を延長して埋める（clamp） */
export function gaussianBlur(image: FloatImage, sigma: number): FloatImage {
  const { width, height, data } = image;
  if (sigma <= 0) {
    return { width, height, data: Float32Array.from(data) };
  }
  const kernel = gaussianKernel(sigma);
  const radius = (kernel.length - 1) / 2;

  // 横方向
  const tmp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k));
        acc += data[y * width + xx] * kernel[k + radius];
      }
      tmp[y * width + x] = acc;
    }
  }

  // 縦方向
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k));
        acc += tmp[yy * width + x] * kernel[k + radius];
      }
      out[y * width + x] = acc;
    }
  }

  return { width, height, data: out };
}

// ---------------------------------------------------------------------------
// 3. 勾配
// ---------------------------------------------------------------------------

export type Gradient = {
  width: number;
  height: number;
  /** 勾配の大きさ（正規化前） */
  magnitude: Float32Array;
  /** x 方向成分 */
  gx: Float32Array;
  /** y 方向成分 */
  gy: Float32Array;
};

/** 3×3 の勾配オペレータ。Scharr は Sobel より回転に対して等方的 */
const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
const SCHARR_X = [-3, 0, 3, -10, 0, 10, -3, 0, 3];
const SCHARR_Y = [-3, -10, -3, 0, 0, 0, 3, 10, 3];

export function gradient(
  image: FloatImage,
  operator: "sobel" | "scharr",
): Gradient {
  const { width, height, data } = image;
  const kx = operator === "scharr" ? SCHARR_X : SOBEL_X;
  const ky = operator === "scharr" ? SCHARR_Y : SOBEL_Y;
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);
  const magnitude = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sx = 0;
      let sy = 0;
      for (let j = -1; j <= 1; j++) {
        const yy = Math.min(height - 1, Math.max(0, y + j));
        for (let i = -1; i <= 1; i++) {
          const xx = Math.min(width - 1, Math.max(0, x + i));
          const v = data[yy * width + xx];
          const k = (j + 1) * 3 + (i + 1);
          sx += v * kx[k];
          sy += v * ky[k];
        }
      }
      const idx = y * width + x;
      gx[idx] = sx;
      gy[idx] = sy;
      magnitude[idx] = Math.hypot(sx, sy);
    }
  }

  return { width, height, magnitude, gx, gy };
}

function maxOf(arr: Float32Array): number {
  let m = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

// ---------------------------------------------------------------------------
// 4a. Sobel / Scharr のエッジ強度: 正規化した勾配を閾値で切る（強さは残す）
// ---------------------------------------------------------------------------

export function thresholdEdges(grad: Gradient, threshold: number): FloatImage {
  const max = maxOf(grad.magnitude);
  const out = new Float32Array(grad.magnitude.length);
  if (max > 0) {
    for (let i = 0; i < out.length; i++) {
      const v = grad.magnitude[i] / max;
      out[i] = v >= threshold ? v : 0;
    }
  }
  return { width: grad.width, height: grad.height, data: out };
}

// ---------------------------------------------------------------------------
// 4b. Canny: 非最大抑制 → 2閾値のヒステリシス
// ---------------------------------------------------------------------------

/**
 * 非最大抑制。勾配方向を 4 方向（0°, 45°, 90°, 135°）に量子化し、
 * その方向の両隣より小さい画素を 0 にして、エッジを1画素幅に細らせる。
 */
export function nonMaximumSuppression(grad: Gradient): FloatImage {
  const { width, height, magnitude, gx, gy } = grad;
  const out = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const m = magnitude[idx];
      if (m === 0) continue;

      // 方向を 0〜180° に折り畳んで 4 方向へ量子化する
      let angle = (Math.atan2(gy[idx], gx[idx]) * 180) / Math.PI;
      if (angle < 0) angle += 180;

      let dx = 1;
      let dy = 0;
      if (angle >= 22.5 && angle < 67.5) {
        dx = 1;
        dy = 1;
      } else if (angle >= 67.5 && angle < 112.5) {
        dx = 0;
        dy = 1;
      } else if (angle >= 112.5 && angle < 157.5) {
        dx = -1;
        dy = 1;
      }

      const n1 = sample(magnitude, width, height, x + dx, y + dy);
      const n2 = sample(magnitude, width, height, x - dx, y - dy);
      out[idx] = m >= n1 && m >= n2 ? m : 0;
    }
  }

  return { width, height, data: out };
}

function sample(
  arr: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return arr[y * width + x];
}

/**
 * ヒステリシス閾値処理。上限以上を「強いエッジ」として種にし、
 * 8近傍でつながる下限以上の画素を「弱いエッジ」として拾う。結果は 0 / 1 の2値。
 * 閾値は最大勾配を 1 とした相対値で受け取る。
 */
export function hysteresis(
  nms: FloatImage,
  lowThreshold: number,
  highThreshold: number,
): FloatImage {
  const { width, height, data } = nms;
  const max = maxOf(data);
  const out = new Float32Array(width * height);
  if (max === 0) return { width, height, data: out };

  const low = Math.min(lowThreshold, highThreshold) * max;
  const high = Math.max(lowThreshold, highThreshold) * max;

  // 強いエッジからスタックで伸ばす（再帰だと大きな画像で深さが溢れる）
  const stack: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= high) {
      out[i] = 1;
      stack.push(i);
    }
  }

  while (stack.length > 0) {
    const idx = stack.pop() as number;
    const x = idx % width;
    const y = (idx - x) / width;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        if (i === 0 && j === 0) continue;
        const xx = x + i;
        const yy = y + j;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const n = yy * width + xx;
        if (out[n] === 0 && data[n] >= low) {
          out[n] = 1;
          stack.push(n);
        }
      }
    }
  }

  return { width, height, data: out };
}

// ---------------------------------------------------------------------------
// 5. エッジ画像を PhiGrid へ
// ---------------------------------------------------------------------------

/**
 * 画素単位のエッジ強度をグリッド解像度に落とす。
 * 各セルは自分の受け持つ画素範囲の平均をとる（面積平均なので細い線は薄まる）。
 */
export function downsampleToGrid(
  edges: FloatImage,
  gridWidth: number,
  gridHeight: number,
): PhiGrid {
  const { width, height, data } = edges;
  const phi = new Array<number>(gridWidth * gridHeight).fill(0);

  for (let gy = 0; gy < gridHeight; gy++) {
    const y0 = Math.floor((gy * height) / gridHeight);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / gridHeight));
    for (let gx = 0; gx < gridWidth; gx++) {
      const x0 = Math.floor((gx * width) / gridWidth);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / gridWidth));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        for (let x = x0; x < x1 && x < width; x++) {
          sum += data[y * width + x];
          count++;
        }
      }
      phi[gy * gridWidth + gx] = count > 0 ? sum / count : 0;
    }
  }

  return { width: gridWidth, height: gridHeight, phi };
}

/**
 * 最大値が 1 になるよう正規化し、下駄を履かせる。
 * Φ = floor + (1 - floor) * v なので、エッジの最も濃いセルが 1、何も無いセルが floor になる。
 * エッジが1つも無い画像では全セル floor（一様分布）になる。
 */
export function normalizeWithFloor(grid: PhiGrid, floor: number): PhiGrid {
  const f = Math.min(1, Math.max(0, floor));
  let max = 0;
  for (const v of grid.phi) if (v > max) max = v;
  const phi = grid.phi.map((v) => {
    const n = max > 0 ? v / max : 0;
    return f + (1 - f) * n;
  });
  return { width: grid.width, height: grid.height, phi };
}

// ---------------------------------------------------------------------------
// まとめ
// ---------------------------------------------------------------------------

/** 設定値を安全な範囲に丸める。UI の入力や保存済み JSON をそのまま通せるようにする */
export function sanitizePhiConfig(input: Partial<PhiConfig>): PhiConfig {
  const c = { ...DEFAULT_PHI_CONFIG, ...input };
  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  return {
    method: EDGE_METHODS.includes(c.method) ? c.method : "canny",
    blurSigma: clamp(c.blurSigma, 0, 5),
    threshold: clamp(c.threshold, 0, 1),
    lowThreshold: clamp(c.lowThreshold, 0, 1),
    highThreshold: clamp(c.highThreshold, 0, 1),
    gridWidth: Math.round(clamp(c.gridWidth, MIN_GRID_SIZE, MAX_GRID_SIZE)),
    gridHeight: Math.round(clamp(c.gridHeight, MIN_GRID_SIZE, MAX_GRID_SIZE)),
    floor: clamp(c.floor, 0, 1),
  };
}

/** 画像からエッジ強度画像（画素単位・0〜1）を作る。プレビュー用に単独でも使う */
export function detectEdges(image: ImageLike, config: PhiConfig): FloatImage {
  const gray = toGrayscale(image);
  const blurred = gaussianBlur(gray, config.blurSigma);

  if (config.method === "canny") {
    const grad = gradient(blurred, "sobel");
    const nms = nonMaximumSuppression(grad);
    return hysteresis(nms, config.lowThreshold, config.highThreshold);
  }

  const grad = gradient(blurred, config.method);
  return thresholdEdges(grad, config.threshold);
}

/** 画像と設定から Φ を作る。同じ入力なら同じ Φ になる */
export function phiFromImage(image: ImageLike, config: PhiConfig): PhiGrid {
  const edges = detectEdges(image, config);
  const coarse = downsampleToGrid(edges, config.gridWidth, config.gridHeight);
  return normalizeWithFloor(coarse, config.floor);
}

/**
 * Φ を小さなΦに縮める（一覧のカードに出す豆ヒートマップ用）。
 * 縦横比は保ったまま、長辺が maxSide になるようにする。
 * 画像そのものではなく Φ を配るので、アップロードされた絵が他人に見えることはない。
 */
export function downsamplePhi(grid: PhiGrid, maxSide: number): PhiGrid {
  const scale = Math.min(1, maxSide / Math.max(grid.width, grid.height));
  const w = Math.max(1, Math.round(grid.width * scale));
  const h = Math.max(1, Math.round(grid.height * scale));
  const small = downsampleToGrid(
    { width: grid.width, height: grid.height, data: Float32Array.from(grid.phi) },
    w,
    h,
  );
  // 一覧に載せる数値なので、桁を落として転送量を減らす
  return { ...small, phi: small.phi.map((v) => Math.round(v * 100) / 100) };
}

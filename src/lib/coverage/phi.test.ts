import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHI_CONFIG,
  downsamplePhi,
  downsampleToGrid,
  gaussianBlur,
  gradient,
  hysteresis,
  nonMaximumSuppression,
  normalizeWithFloor,
  phiFromImage,
  sanitizePhiConfig,
  thresholdEdges,
  toGrayscale,
  type FloatImage,
  type ImageLike,
  type PhiConfig,
} from "./phi";

/** 輝度の配列（0〜255）から RGBA 画像を作る */
function grayImage(width: number, height: number, values: number[]): ImageLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = values[i];
    data[i * 4 + 1] = values[i];
    data[i * 4 + 2] = values[i];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** 左半分が黒・右半分が白の画像。縦の境界線が1本だけある */
function halfImage(width: number, height: number): ImageLike {
  const values: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      values.push(x < width / 2 ? 0 : 255);
    }
  }
  return grayImage(width, height, values);
}

function floatImage(width: number, height: number, values: number[]): FloatImage {
  return { width, height, data: Float32Array.from(values) };
}

describe("toGrayscale", () => {
  it("白は 1、黒は 0 になる", () => {
    const img = grayImage(2, 1, [255, 0]);
    const gray = toGrayscale(img);
    expect(gray.data[0]).toBeCloseTo(1);
    expect(gray.data[1]).toBeCloseTo(0);
  });

  it("赤・緑・青は Rec.601 の係数で混ぜる", () => {
    const img: ImageLike = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255]),
    };
    expect(toGrayscale(img).data[0]).toBeCloseTo(0.299);
  });
});

describe("gaussianBlur", () => {
  it("sigma が 0 なら何も変えない", () => {
    const img = floatImage(3, 1, [0, 1, 0]);
    expect(Array.from(gaussianBlur(img, 0).data)).toEqual([0, 1, 0]);
  });

  it("一様な画像はぼかしても一様のまま", () => {
    const img = floatImage(5, 5, new Array(25).fill(0.5));
    for (const v of gaussianBlur(img, 1.5).data) {
      expect(v).toBeCloseTo(0.5);
    }
  });

  it("ぼかすと山が低くなり、周りに広がる", () => {
    const values = new Array(25).fill(0);
    values[12] = 1; // 中央
    const blurred = gaussianBlur(floatImage(5, 5, values), 1);
    expect(blurred.data[12]).toBeLessThan(1);
    expect(blurred.data[11]).toBeGreaterThan(0);
  });
});

describe("gradient", () => {
  it("縦の境界線で x 方向の勾配が立つ", () => {
    const gray = toGrayscale(halfImage(8, 4));
    const grad = gradient(gray, "sobel");
    // 境界（x=3,4）の勾配は、遠く離れた場所（x=0）より大きい
    expect(grad.magnitude[1 * 8 + 3]).toBeGreaterThan(0);
    expect(grad.magnitude[1 * 8 + 0]).toBe(0);
    expect(Math.abs(grad.gx[1 * 8 + 3])).toBeGreaterThan(Math.abs(grad.gy[1 * 8 + 3]));
  });

  it("Scharr は Sobel より係数が大きいので勾配も大きい", () => {
    const gray = toGrayscale(halfImage(8, 4));
    const sobel = gradient(gray, "sobel");
    const scharr = gradient(gray, "scharr");
    expect(scharr.magnitude[1 * 8 + 3]).toBeGreaterThan(sobel.magnitude[1 * 8 + 3]);
  });
});

describe("thresholdEdges", () => {
  it("閾値未満は 0 に落とし、以上は正規化した強さを残す", () => {
    const gray = toGrayscale(halfImage(8, 4));
    const edges = thresholdEdges(gradient(gray, "sobel"), 0.5);
    expect(edges.data[1 * 8 + 3]).toBeCloseTo(1);
    expect(edges.data[1 * 8 + 0]).toBe(0);
  });
});

describe("Canny", () => {
  it("非最大抑制で境界が 1 画素幅に細る", () => {
    const gray = gaussianBlur(toGrayscale(halfImage(12, 4)), 1);
    const grad = gradient(gray, "sobel");
    const nms = nonMaximumSuppression(grad);
    // 行ごとに 0 でない画素を数える。ぼかしで広がった勾配が1〜2画素に絞られている
    const row = Array.from(nms.data.slice(1 * 12, 2 * 12));
    const nonZero = row.filter((v) => v > 0).length;
    const gradNonZero = Array.from(grad.magnitude.slice(1 * 12, 2 * 12)).filter(
      (v) => v > 0,
    ).length;
    expect(nonZero).toBeGreaterThan(0);
    expect(nonZero).toBeLessThan(gradNonZero);
  });

  it("ヒステリシスは強いエッジにつながる弱いエッジだけを拾う", () => {
    // 1行: 強(1.0) 弱(0.4) 弱(0.4) 0 弱(0.4)
    const nms = floatImage(5, 1, [1, 0.4, 0.4, 0, 0.4]);
    const out = Array.from(hysteresis(nms, 0.3, 0.8).data);
    expect(out).toEqual([1, 1, 1, 0, 0]);
  });

  it("閾値の上下を逆に渡しても入れ替えて処理する", () => {
    const nms = floatImage(3, 1, [1, 0.4, 0]);
    expect(Array.from(hysteresis(nms, 0.8, 0.3).data)).toEqual([1, 1, 0]);
  });

  it("勾配が全く無い画像ではエッジも無い", () => {
    const nms = floatImage(3, 1, [0, 0, 0]);
    expect(Array.from(hysteresis(nms, 0.1, 0.3).data)).toEqual([0, 0, 0]);
  });
});

describe("downsampleToGrid", () => {
  it("セルは受け持ち範囲の平均になる", () => {
    const edges = floatImage(4, 2, [1, 1, 0, 0, 1, 1, 0, 0]);
    const grid = downsampleToGrid(edges, 2, 1);
    expect(grid.phi).toEqual([1, 0]);
  });

  it("画像より細かいグリッドでも全セルが埋まる", () => {
    const edges = floatImage(2, 2, [1, 0, 0, 1]);
    const grid = downsampleToGrid(edges, 4, 4);
    expect(grid.phi).toHaveLength(16);
    expect(grid.phi[0]).toBe(1);
    expect(grid.phi[3]).toBe(0);
  });
});

describe("normalizeWithFloor", () => {
  it("最大値が 1、最小値が floor になる", () => {
    const grid = normalizeWithFloor({ width: 3, height: 1, phi: [0, 2, 4] }, 0.1);
    expect(grid.phi[0]).toBeCloseTo(0.1);
    expect(grid.phi[1]).toBeCloseTo(0.55);
    expect(grid.phi[2]).toBeCloseTo(1);
  });

  it("エッジが無ければ全セル floor になる", () => {
    const grid = normalizeWithFloor({ width: 2, height: 1, phi: [0, 0] }, 0.3);
    expect(grid.phi).toEqual([0.3, 0.3]);
  });
});

describe("phiFromImage", () => {
  const config: PhiConfig = {
    ...DEFAULT_PHI_CONFIG,
    gridWidth: 8,
    gridHeight: 4,
  };

  it("エッジがある場所の Φ が高く、無い場所は floor になる", () => {
    const img = halfImage(64, 32);
    for (const method of ["sobel", "scharr", "canny"] as const) {
      const phi = phiFromImage(img, { ...config, method });
      expect(phi.width).toBe(8);
      expect(phi.height).toBe(4);
      // 境界のセル（x=3 か 4）が最大
      const row = phi.phi.slice(8, 16);
      const maxIdx = row.indexOf(Math.max(...row));
      expect([3, 4]).toContain(maxIdx);
      expect(Math.max(...row)).toBeCloseTo(1);
      // 端は floor
      expect(row[0]).toBeCloseTo(config.floor);
      expect(row[7]).toBeCloseTo(config.floor);
    }
  });

  it("同じ画像と設定からは同じ Φ が再現できる", () => {
    const img = halfImage(40, 30);
    const a = phiFromImage(img, config);
    const b = phiFromImage(img, JSON.parse(JSON.stringify(config)));
    expect(a).toEqual(b);
  });

  it("真っ白な画像では一様な Φ になる", () => {
    const img = grayImage(16, 16, new Array(256).fill(255));
    const phi = phiFromImage(img, config);
    for (const v of phi.phi) expect(v).toBeCloseTo(config.floor);
  });
});

describe("sanitizePhiConfig", () => {
  it("範囲外の値を丸め、未知の方式は既定に戻す", () => {
    const c = sanitizePhiConfig({
      method: "laplacian" as unknown as "sobel",
      gridWidth: 10000,
      gridHeight: 1,
      floor: -1,
      blurSigma: Number.NaN,
    });
    expect(c.method).toBe("canny");
    expect(c.gridWidth).toBe(128);
    expect(c.gridHeight).toBe(8);
    expect(c.floor).toBe(0);
    expect(c.blurSigma).toBe(0);
  });

  it("欠けた項目は既定値で補う", () => {
    expect(sanitizePhiConfig({})).toEqual(DEFAULT_PHI_CONFIG);
  });
});

describe("downsamplePhi", () => {
  it("長辺を指定した大きさに収め、縦横比を保つ", () => {
    const grid = { width: 64, height: 32, phi: new Array(64 * 32).fill(0.5) };
    const small = downsamplePhi(grid, 16);
    expect(small.width).toBe(16);
    expect(small.height).toBe(8);
    expect(small.phi).toHaveLength(128);
  });

  it("元より小さくない場合はそのままの大きさになる", () => {
    const grid = { width: 8, height: 8, phi: new Array(64).fill(1) };
    expect(downsamplePhi(grid, 16).width).toBe(8);
  });

  it("明るい所と暗い所の関係が保たれる", () => {
    // 左半分だけ 1、右半分 0
    const phi: number[] = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) phi.push(x < 8 ? 1 : 0);
    }
    const small = downsamplePhi({ width: 16, height: 16, phi }, 4);
    expect(small.phi[0]).toBeGreaterThan(small.phi[3]);
  });

  it("小数 2 桁に丸めて転送量を減らす", () => {
    const grid = { width: 4, height: 1, phi: [0.123456, 0.987654, 0, 1] };
    for (const v of downsamplePhi(grid, 4).phi) {
      expect(Math.round(v * 100) / 100).toBe(v);
    }
  });
});

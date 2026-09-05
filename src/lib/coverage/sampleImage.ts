import type { ImageLike } from "./phi";

/**
 * 手元に画像が無くても試せるサンプル画像を、canvas を使わずに作る。
 *
 * 画面の「サンプル画像を使う」と、DB にお手本を入れる seed スクリプトの両方から使う。
 * canvas に依存しないので Node でもそのまま動き、ユニットテストの対象にもできる。
 * 図形の輪郭がそのままエッジになるので、Φ がどう作られるかが一目で分かる。
 */

export const SAMPLE_IMAGE_NAME = "sample.png";
const WIDTH = 480;
const HEIGHT = 360;

const BACKGROUND = 244;
const STROKE = 34;
const FILL = 85;

type Canvas = { width: number; height: number; gray: Uint8ClampedArray };

function setPixel(c: Canvas, x: number, y: number, value: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= c.width || yi >= c.height) return;
  c.gray[yi * c.width + xi] = value;
}

/** 太さのある点を打つ。線幅を出すために周囲も塗る */
function stamp(c: Canvas, x: number, y: number, radius: number, value: number): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) setPixel(c, x + dx, y + dy, value);
    }
  }
}

function strokeLine(
  c: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
): void {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2;
  const r = Math.max(1, Math.round(width / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stamp(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, STROKE);
  }
}

function strokeCircle(
  c: Canvas,
  cx: number,
  cy: number,
  radius: number,
  width: number,
): void {
  const steps = Math.ceil(2 * Math.PI * radius) * 2;
  const r = Math.max(1, Math.round(width / 2));
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    stamp(c, cx + radius * Math.cos(a), cy + radius * Math.sin(a), r, STROKE);
  }
}

function strokeRect(
  c: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  width: number,
): void {
  strokeLine(c, x, y, x + w, y, width);
  strokeLine(c, x + w, y, x + w, y + h, width);
  strokeLine(c, x + w, y + h, x, y + h, width);
  strokeLine(c, x, y + h, x, y, width);
}

/** 三角形の塗りつぶし。重心座標で内外を判定する */
function fillTriangle(
  c: Canvas,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): void {
  const minX = Math.floor(Math.min(ax, bx, cx));
  const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (area === 0) return;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((bx - ax) * (y - ay) - (x - ax) * (by - ay)) / area;
      const w1 = ((x - ax) * (cy - ay) - (cx - ax) * (y - ay)) / area;
      if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) setPixel(c, x, y, FILL);
    }
  }
}

/** サンプル画像を RGBA で返す。ImageData と同じ形なので canvas にも流し込める */
export function createSampleImage(): ImageLike {
  const c: Canvas = {
    width: WIDTH,
    height: HEIGHT,
    gray: new Uint8ClampedArray(WIDTH * HEIGHT).fill(BACKGROUND),
  };

  strokeCircle(c, 150, 170, 90, 6);
  strokeRect(c, 290, 80, 140, 110, 6);
  strokeLine(c, 60, 320, 420, 250, 6);
  fillTriangle(c, 320, 330, 400, 230, 450, 330);

  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    const v = c.gray[i];
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: WIDTH, height: HEIGHT, data };
}

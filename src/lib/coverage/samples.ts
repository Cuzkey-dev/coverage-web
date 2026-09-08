import type { ImageLike } from "./phi";

/** Original geometric silhouettes. No research images or third-party assets. */
export const SAMPLES = [
  { id: "bird", name: "鳥", detail: "翼・細い先端" },
  { id: "butterfly", name: "蝶", detail: "曲線・左右対称" },
  { id: "star", name: "星", detail: "鋭角・凹凸" },
  { id: "city", name: "街並み", detail: "直線・高さの差" },
  { id: "rings", name: "リング", detail: "独立した輪郭" },
  { id: "leaf", name: "葉", detail: "曲線・内部の線" },
] as const;
export type SampleId = (typeof SAMPLES)[number]["id"];

function polygon(x: number, y: number, points: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i],
      [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function createCatalogImage(id: SampleId, size = 320): ImageLike {
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  const star = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI) / 5 - Math.PI / 2,
      r = i % 2 ? 0.18 : 0.39;
    return [0.5 + r * Math.cos(angle), 0.51 + r * Math.sin(angle)];
  });
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const x = (col + 0.5) / size,
        y = (row + 0.5) / size;
      let ink = false;
      if (id === "star") ink = polygon(x, y, star);
      if (id === "bird")
        ink = polygon(x, y, [
          [0.1, 0.19],
          [0.4, 0.36],
          [0.53, 0.41],
          [0.65, 0.32],
          [0.77, 0.34],
          [0.9, 0.42],
          [0.76, 0.44],
          [0.67, 0.5],
          [0.6, 0.63],
          [0.35, 0.83],
          [0.43, 0.62],
          [0.19, 0.65],
          [0.38, 0.5],
          [0.22, 0.4],
        ]);
      if (id === "butterfly") {
        const dx = Math.abs(x - 0.5);
        ink =
          ((dx - 0.18) / 0.2) ** 2 + ((y - 0.35) / 0.24) ** 2 < 1 ||
          ((dx - 0.14) / 0.15) ** 2 + ((y - 0.68) / 0.19) ** 2 < 1 ||
          (dx < 0.023 && y > 0.25 && y < 0.79);
        ink ||= y > 0.12 && y < 0.3 && Math.abs(dx - (0.3 - y) * 0.45) < 0.009;
      }
      if (id === "city") {
        const buildings = [
          [0.12, 0.31, 0.12],
          [0.27, 0.48, 0.1],
          [0.4, 0.16, 0.14],
          [0.57, 0.4, 0.12],
          [0.72, 0.24, 0.15],
        ];
        ink = buildings.some(
          ([left, top, w]) => x > left && x < left + w && y > top && y < 0.82,
        );
        ink ||= y > 0.8 && y < 0.84 && x > 0.08 && x < 0.92;
      }
      if (id === "rings")
        ink = [
          [0.32, 0.34, 0.2],
          [0.7, 0.38, 0.16],
          [0.52, 0.72, 0.15],
        ].some(
          ([cx, cy, r]) => Math.abs(Math.hypot(x - cx, y - cy) - r) < 0.025,
        );
      if (id === "leaf") {
        const u = (x + y - 1) / Math.SQRT2,
          v = (y - x) / Math.SQRT2;
        ink = (u / 0.22) ** 2 + (v / 0.44) ** 2 < 1;
        if (Math.abs(u) < 0.013 && Math.abs(v) < 0.38) ink = false;
        if (
          Math.abs(v - 0.12 - Math.abs(u) * 1.4) < 0.011 ||
          Math.abs(v + 0.12 - Math.abs(u) * 1.4) < 0.011
        )
          ink = false;
      }
      if (ink)
        data.fill(20, (row * size + col) * 4, (row * size + col) * 4 + 3);
    }
  return { width: size, height: size, data };
}

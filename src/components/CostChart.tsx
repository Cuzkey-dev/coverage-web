"use client";

import { formatCost } from "@/lib/format";

export type CostSeries = {
  label: string;
  color: string;
  values: number[];
};

type Props = {
  series: CostSeries[];
  /** 縦線で示すステップ（再生中の現在位置） */
  marker?: number;
  height?: number;
};

const WIDTH = 640;
const PAD = { top: 12, right: 16, bottom: 28, left: 64 };

/**
 * 評価値の推移を折れ線で描く inline SVG。複数系列を同じ軸に重ねられるので比較画面でも使う。
 */
export function CostChart({ series, marker, height = 220 }: Props) {
  const maxLen = Math.max(1, ...series.map((s) => s.values.length));
  const maxVal = Math.max(1e-9, ...series.flatMap((s) => s.values));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const sx = (step: number) =>
    PAD.left + (innerW * step) / Math.max(1, maxLen - 1);
  const sy = (v: number) => PAD.top + innerH * (1 - v / maxVal);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);
  const xTickCount = Math.min(6, maxLen);
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    Math.round(((maxLen - 1) * i) / Math.max(1, xTickCount - 1)),
  );

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-0.5 w-4"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full max-w-full text-neutral-500"
        role="img"
        aria-label="評価値の推移"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={sy(v)}
              y2={sy(v)}
              stroke="currentColor"
              strokeOpacity={0.2}
            />
            <text
              x={PAD.left - 6}
              y={sy(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="currentColor"
            >
              {formatCost(v)}
            </text>
          </g>
        ))}
        {xTicks.map((step) => (
          <text
            key={step}
            x={sx(step)}
            y={height - PAD.bottom + 16}
            textAnchor="middle"
            fontSize={11}
            fill="currentColor"
          >
            {step}
          </text>
        ))}
        <text
          x={WIDTH - PAD.right}
          y={height - 4}
          textAnchor="end"
          fontSize={11}
          fill="currentColor"
        >
          ステップ
        </text>

        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            points={s.values.map((v, i) => `${sx(i)},${sy(v)}`).join(" ")}
          />
        ))}

        {marker !== undefined && marker >= 0 && (
          <line
            x1={sx(marker)}
            x2={sx(marker)}
            y1={PAD.top}
            y2={height - PAD.bottom}
            stroke="currentColor"
            strokeDasharray="4 3"
          />
        )}
      </svg>
    </div>
  );
}

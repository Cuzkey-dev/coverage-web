"use client";
import type { QualitySample } from "@/lib/coverage/experiment";

export function QualityChart({
  series,
  metric = "edgeCoverage",
}: {
  series: { label: string; color: string; values: QualitySample[] }[];
  metric?: "edgeCoverage" | "f1";
}) {
  const last = Math.max(
    1,
    ...series.flatMap((s) => s.values.map((q) => q.step)),
  );
  const x = (step: number) => 54 + (step / last) * 562,
    y = (value: number) => 176 - value * 160;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
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
      <svg
        viewBox="0 0 640 216"
        role="img"
        aria-label={metric === "f1" ? "F1スコアの推移" : "輪郭充足率の推移"}
        className="h-auto w-full text-neutral-500"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line
              x1={54}
              x2={616}
              y1={y(v)}
              y2={y(v)}
              stroke="currentColor"
              opacity={0.2}
            />
            <text
              x={46}
              y={y(v) + 4}
              textAnchor="end"
              fill="currentColor"
              fontSize={12}
            >
              {v * 100}%
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text
            key={v}
            x={x(v * last)}
            y={195}
            textAnchor="middle"
            fill="currentColor"
            fontSize={12}
          >
            {Math.round(v * last)}
          </text>
        ))}
        <text
          x={616}
          y={213}
          textAnchor="end"
          fill="currentColor"
          fontSize={12}
        >
          ステップ
        </text>
        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            points={s.values
              .filter((q) => q[metric] !== undefined)
              .map((q) => `${x(q.step)},${y(q[metric]!)}`)
              .join(" ")}
          />
        ))}
      </svg>
    </div>
  );
}

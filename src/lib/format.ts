/** 評価値の表示。桁が大きいのでカンマ区切り・小数 1 桁まで */
export function formatCost(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

/** ISO 文字列の日時を日本向けに短く */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

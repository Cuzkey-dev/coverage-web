import type { ParamRow } from "@/lib/coverage/params";

type Props = {
  rows: ParamRow[];
  /** 2 列目の見出し（比較のとき） */
  headA?: string;
  headB?: string;
};

/**
 * パラメータの表。比較のときは b 列も出し、変わった行だけ色を付ける。
 */
export function ParamTable({ rows, headA, headB }: Props) {
  const compare = rows.some((r) => r.b !== undefined);
  return (
    <table className="w-full text-sm">
      {compare && (
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-1 font-medium">項目</th>
            <th className="py-1 font-medium">{headA ?? "A"}</th>
            <th className="py-1 font-medium">{headB ?? "B"}</th>
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.key}
            className={
              r.changed
                ? "bg-amber-100 font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                : "border-t border-neutral-200 dark:border-neutral-800"
            }
          >
            <td className="py-1 pr-3 text-neutral-600 dark:text-neutral-400">{r.label}</td>
            <td className="py-1 pr-3 font-mono tabular-nums">{r.a}</td>
            {compare && <td className="py-1 font-mono tabular-nums">{r.b}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

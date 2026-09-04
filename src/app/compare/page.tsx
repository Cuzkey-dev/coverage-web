import Link from "next/link";
import { CompareView } from "./CompareView";
import { getRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;

  const [runA, runB] = await Promise.all([
    a ? getRun(a) : Promise.resolve(null),
    b ? getRun(b) : Promise.resolve(null),
  ]);

  if (!runA || !runB) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">比較</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          比較する実行が見つかりません。一覧で 2 件チェックして「比較する」を押してください。
        </p>
        <Link href="/runs" className="text-sm text-sky-600 hover:underline">
          → 保存した実行
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-1">
        <Link href="/runs" className="text-sm text-sky-600 hover:underline">
          ← 保存した実行
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">比較</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          変わったパラメータだけを色付きで示し、評価値の推移を同じグラフに重ねます。
        </p>
      </div>
      <CompareView a={runA} b={runB} />
    </main>
  );
}

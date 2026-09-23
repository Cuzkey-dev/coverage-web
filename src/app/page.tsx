import Link from "next/link";
import { RunList } from "@/components/RunList";
import { listRuns, type RunSummary } from "@/lib/runs";

// 保存済みの実行を毎回 DB から読むので、ビルド時に固定しない
export const dynamic = "force-dynamic";

const steps = [
  {
    title: "動くモデルを選ぶ",
    body: "鳥・風車・顔の3種類から選ぶだけ。入力画像の準備は不要です。",
  },
  {
    title: "入力と動きを見比べる",
    body: "240台のロボットが、動く輪郭へ追従。止めたり速度を変えたりしながら、軌跡や輪郭を重ねて観察できます。",
  },
  {
    title: "数式で仕組みを知る",
    body: "時間で変わる重要度と、各ロボットの担当領域・重心・追従入力を解説します。",
  },
];

export default async function Home() {
  let runs: RunSummary[] = [];
  let dbError: string | null = null;
  try {
    runs = await listRuns(6);
  } catch (e) {
    console.error(e);
    dbError =
      "データベースに接続できません。DATABASE_URL の設定と DB の起動を確認してください。";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-12">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          動くかたちを、ロボットの群れで。
        </h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-400">
          鳥の羽ばたき、風車の回転、顔の表情。時間とともに変わる入力に、ロボット群が追従する様子を見てみましょう。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/motion"
            className="rounded bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
          >
            3つの動くモデルを見る
          </Link>
          <Link
            href="/new"
            className="rounded border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            静止画像で実行する
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="flex flex-col gap-2 rounded border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="text-xs font-mono text-neutral-500">
              STEP {i + 1}
            </div>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {s.body}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">最近保存した実行</h2>
          <Link href="/runs" className="text-sm text-sky-600 hover:underline">
            すべて見る
          </Link>
        </div>
        {dbError ? (
          <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {dbError}
          </p>
        ) : (
          <RunList runs={runs} />
        )}
      </section>
    </main>
  );
}

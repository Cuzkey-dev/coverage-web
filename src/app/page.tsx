import Link from "next/link";
import { RunList } from "@/components/RunList";
import { listRuns, type RunSummary } from "@/lib/runs";

// 保存済みの実行を毎回 DB から読むので、ビルド時に固定しない
export const dynamic = "force-dynamic";

const steps = [
  {
    title: "描きたい画像を選ぶ",
    body: "6種類のサンプルや手元の画像を選び、ロボットで表現したい輪郭を決める。",
  },
  {
    title: "被覆制御を実行する",
    body: "最大1,200台・6種類の初期配置に対応。研究モデルで移動を計算し、台数や初期配置を変えた4条件を一括比較する。",
  },
  {
    title: "保存して比べる",
    body: "配置の評価値と推移を確認。配置図PNG、評価値と座標CSVを出力し、実行を保存する。",
  },
];

export default async function Home() {
  let runs: RunSummary[] = [];
  let dbError: string | null = null;
  try {
    runs = await listRuns(6);
  } catch (e) {
    console.error(e);
    dbError = "データベースに接続できません。DATABASE_URL の設定と DB の起動を確認してください。";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-12">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">被覆制御シミュレータ</h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-400">
          画像の輪郭を、たくさんのロボットで表現する。
          最大1,200台の配置を計算し、画像・台数・初期配置による違いを比較するツールです。
        </p>
        <div className="flex gap-3">
          <Link
            href="/new"
            className="rounded bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
          >
            新規実行を始める
          </Link>
          <Link
            href="/runs"
            className="rounded border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            保存した実行を見る
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="flex flex-col gap-2 rounded border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="text-xs font-mono text-neutral-500">STEP {i + 1}</div>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{s.body}</p>
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

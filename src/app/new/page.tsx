import { NewRunClient } from "./NewRunClient";
import Link from "next/link";

export default function NewRunPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <Link
        href="/motion"
        className="rounded-xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-900 hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200"
      >
        新しく追加：鳥・風車・顔の「動くモデル」を見る →
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          ロボットで輪郭を描く
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          最大1,200台で、画像・台数・初期配置による違いを検証。配置図と評価値を出力できます。
        </p>
      </div>
      <NewRunClient />
    </main>
  );
}

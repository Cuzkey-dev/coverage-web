import { NewRunClient } from "./NewRunClient";

export default function NewRunPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">ロボットで輪郭を描く</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          最大1,200台で、画像・台数・初期配置による違いを検証。配置図と評価値を出力できます。
        </p>
      </div>
      <NewRunClient />
    </main>
  );
}

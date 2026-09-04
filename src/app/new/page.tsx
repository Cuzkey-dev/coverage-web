import { NewRunClient } from "./NewRunClient";

export default function NewRunPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">新規実行</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          画像から Φ を作り、その Φ で被覆制御を回して、結果を保存します。
        </p>
      </div>
      <NewRunClient />
    </main>
  );
}

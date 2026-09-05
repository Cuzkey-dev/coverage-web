import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">見つかりません</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        指定された実行は削除されたか、URL が違います。保存できる実行の数には上限があり、
        古いものから消えることがあります。
      </p>
      <div className="flex gap-3">
        <Link
          href="/runs"
          className="rounded bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
        >
          保存した実行を見る
        </Link>
        <Link
          href="/new"
          className="rounded border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          新規実行
        </Link>
      </div>
    </main>
  );
}

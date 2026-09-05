"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * 想定外の失敗（多くはデータベースへ届かないとき）に出す画面。
 * これが無いと Next.js の既定の画面になり、訪問者に何も伝わらない。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">エラーが起きました</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        処理を続けられませんでした。少し時間をおいてもう一度お試しください。
        データベースが混み合っているときにも起こります。
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
        >
          もう一度試す
        </button>
        <Link
          href="/"
          className="rounded border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          トップへ
        </Link>
      </div>
      {error.digest && (
        <p className="font-mono text-xs text-neutral-500">エラーID: {error.digest}</p>
      )}
    </main>
  );
}

import { RunList } from "@/components/RunList";
import { listRuns, type RunSummary } from "@/lib/runs";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const { with: preselect } = await searchParams;

  let runs: RunSummary[] = [];
  let dbError: string | null = null;
  try {
    runs = await listRuns();
  } catch (e) {
    console.error(e);
    dbError = "データベースに接続できません。DATABASE_URL の設定と DB の起動を確認してください。";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">保存した実行</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          カードを開くと再生できます。2 件チェックすると比較へ進めます。
        </p>
      </div>
      {dbError ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {dbError}
        </p>
      ) : (
        <RunList runs={runs} preselect={preselect} />
      )}
    </main>
  );
}

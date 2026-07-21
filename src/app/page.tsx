const roadmap = [
  { week: "W1", label: "土台とデプロイ", done: true },
  { week: "W2", label: "被覆制御シミュレーションの実装と描画", done: false },
  { week: "W3", label: "認証", done: false },
  { week: "W4", label: "実行結果の保存・一覧", done: false },
  { week: "W5", label: "画像からのΦ生成、実行の比較", done: false },
  { week: "W6", label: "テスト・CI・仕上げ", done: false },
];

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Coverage Web</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          画像から重要度関数 Φ を設計し、二輪移動ロボットの被覆制御シミュレーションを
          実行・保存・比較するためのツールです。
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          開発状況
        </h2>
        <ul className="flex flex-col gap-2">
          {roadmap.map((item) => (
            <li key={item.week} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`inline-block size-2 shrink-0 rounded-full ${
                  item.done
                    ? "bg-emerald-500"
                    : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              />
              <span className="w-8 font-mono text-neutral-500">{item.week}</span>
              <span className={item.done ? "" : "text-neutral-500"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

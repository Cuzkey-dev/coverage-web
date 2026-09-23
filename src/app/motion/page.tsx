import type { Metadata } from "next";
import { MotionGallery } from "@/components/MotionGallery";
export const metadata: Metadata = {
  title: "時変重要度による被覆制御 | Coverage Web",
  description:
    "入力画像の変化に対するロボット群の追従を、画像・抽出輪郭・ロボット配置で比較します。",
};
function Equation({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div
      role="math"
      aria-label={label}
      className="motion-equation my-4 overflow-x-auto p-4 font-serif text-lg leading-loose"
    >
      {children}
    </div>
  );
}
export default function MotionPage() {
  return (
    <main className="motion-page mx-auto w-full max-w-6xl px-5 pb-16 text-slate-800 sm:px-6">
      <header className="motion-intro">
        <p className="motion-eyebrow">画像から考えるロボットの配置</p>
        <h1>時変重要度による被覆制御</h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          画像が変わると、ロボットの配置はどう変わるでしょうか。
          <br className="hidden sm:block" />
          鳥・風車・顔を例に、入力画像から輪郭を抽出し、240台のロボットが追従するまでを見比べます。
        </p>
        <a href="#how-it-works" className="motion-text-link">
          計算方法と数式 <span aria-hidden="true">↗</span>
        </a>
      </header>
      <MotionGallery />
      <section
        id="how-it-works"
        className="motion-method scroll-mt-8 space-y-6"
      >
        <div className="method-heading">
          <span aria-hidden="true">解説</span>
          <h2 className="text-2xl font-semibold">計算方法</h2>
        </div>
        <p className="max-w-3xl leading-7">
          各時刻の入力画像から輪郭を抽出し、輪郭付近の重要度を高くします。各ロボットは担当領域の重み付き重心へ向かいます。以下では、この処理を一般的な被覆制御の式で説明します。
        </p>
        <div className="method-grid grid gap-x-10 gap-y-8 md:grid-cols-2">
          <article className="min-w-0">
            <h3 className="font-semibold">入力画像から重要度関数を求める</h3>
            <Equation label="入力画像Iから輪郭Eを抽出し、時変重要度ファイを求める。">
              I(q,t) → E(q,t) → Φ(q,t)
            </Equation>
            <p className="text-sm leading-7">
              qは領域内の位置、tは時刻です。Iは入力画像、Eは画像処理で得た輪郭、Φは重要度関数を表します。中央の図は実際に計算に使った輪郭で、重要度関数そのものではありません。
            </p>
          </article>
          <article className="min-w-0">
            <h3 className="font-semibold">ロボットごとに領域を分担する</h3>
            <Equation label="ボロノイ領域Viは、ロボットiに最も近い点qの集合。">
              V<sub>i</sub>(t) = {"{"}q ∈ Q : ‖q − p<sub>i</sub>(t)‖ ≤ ‖q − p
              <sub>j</sub>(t)‖, ∀j{"}"}
            </Equation>
            <p className="text-sm leading-7">
              Qは全体の領域、p<sub>i</sub>はロボットiの位置、V<sub>i</sub>
              はそのロボットに最も近い点の集合です。ロボットが移動すると、担当領域も変わります。
            </p>
          </article>
          <article className="min-w-0">
            <h3 className="font-semibold">重み付き重心を求める</h3>
            <Equation label="重心ciは、Vi上のqファイの積分をファイの積分で割ったもの。">
              c<sub>i</sub>(t) ={" "}
              <span className="inline-flex flex-col text-center align-middle">
                <span className="border-b border-current px-2">
                  ∫<sub>Vᵢ(t)</sub> q Φ(q,t) dq
                </span>
                <span>
                  ∫<sub>Vᵢ(t)</sub> Φ(q,t) dq
                </span>
              </span>
            </Equation>
            <p className="text-sm leading-7">
              c<sub>i</sub>
              は担当領域内の重要度で重み付けした重心です。重要度が高い位置ほど重心に強く影響します。分母は担当領域の重要度の合計で、正の場合を考えます。
            </p>
          </article>
          <article className="min-w-0">
            <h3 className="font-semibold">重心に向かう入力を与える</h3>
            <Equation label="被覆入力uiはゲインkと重心ciから位置piを引いた差の積。">
              u<sub>i</sub>
              <sup>cov</sup>(t) = k [c<sub>i</sub>(t) − p<sub>i</sub>(t)],　k
              &gt; 0
            </Equation>
            <p className="text-sm leading-7">
              kは追従の強さを決めるゲインです。この入力にロボット間の相互作用と移動モデルを適用し、並進速度・旋回速度の上限内で位置を更新します。各時刻の重要度に対して、この計算を繰り返します。
            </p>
          </article>
        </div>
        <article>
          <h3 className="font-semibold">時変入力への追従</h3>
          <Equation label="被覆目的関数Hは各担当領域での距離の二乗と重要度の積を積分して合計したもの。">
            H(P,t) = ∑<sub>i</sub> ∫<sub>Vᵢ(t)</sub> ‖q − p<sub>i</sub>‖² Φ(q,t)
            dq
          </Equation>
          <p className="text-sm leading-7">
            Pは全ロボットの配置です。入力画像が動くため、配置が収束する前から重要度関数が変わり、Hは単調に減少するとは限りません。入力の変化速度に対する遅れを、ゲインや速度上限、計算刻みを調整して確認しています。風車の軸は入力上では固定されていますが、特定のロボットを固定しているわけではありません。
          </p>
        </article>
        <p className="text-sm leading-7 text-slate-600">
          結果はシミュレーションによるものです。掲載した式は、被覆制御の基本的な考え方を示しています。
        </p>
        <p className="text-xs leading-6 text-slate-600">
          参考：
          <a
            className="underline"
            href="https://arxiv.org/abs/math/0212212"
            target="_blank"
            rel="noreferrer"
          >
            Cortés et al., Coverage control for mobile sensing networks
          </a>
        </p>
      </section>
    </main>
  );
}

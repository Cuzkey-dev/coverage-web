import type { Metadata } from "next";
import { MotionGallery } from "@/components/MotionGallery";

export const metadata: Metadata = {
  title: "動くモデル | Coverage Web",
  description:
    "鳥の羽ばたき、風車の回転、顔の表情。時間とともに変わる重要度にロボット群が追従する3つのアニメーション。",
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
      className="my-4 overflow-x-auto rounded-xl bg-slate-100 p-4 font-serif text-lg leading-loose tracking-wide dark:bg-slate-900"
    >
      {children}
    </div>
  );
}

export default function MotionPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-5 py-10 sm:px-6 sm:py-14">
      <header className="max-w-3xl space-y-4">
        <p className="font-mono text-xs tracking-[.22em] text-teal-700 dark:text-teal-300">
          COVERAGE IN MOTION
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          動くかたちを、ロボットの群れで。
        </h1>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
          羽ばたく鳥、回る風車、移り変わる表情。入力の動きに合わせて「ロボットを集めたい場所」を更新すると、群れの配置も変わっていきます。
        </p>
        <a
          href="#how-it-works"
          className="inline-block text-sm text-teal-700 underline underline-offset-4 dark:text-teal-300"
        >
          時間変化する重要度と数式を見る ↓
        </a>
      </header>
      <MotionGallery />
      <section
        id="how-it-works"
        className="scroll-mt-6 space-y-7 border-t border-slate-200 pt-10 dark:border-slate-800"
      >
        <div>
          <p className="font-mono text-xs tracking-widest text-teal-700 dark:text-teal-300">
            HOW IT WORKS
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            重要度を、時間とともに変える
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-slate-600 dark:text-slate-400">
            入力画像の各時刻の形から重要度をつくり、その時刻の重心を追いかけます。ロボットの位置を入力の輪郭へ直接貼り付けているわけではありません。次の式は被覆制御の一般的な考え方を説明するものです。
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <article className="min-w-0">
            <h3 className="font-semibold">1. 集まる場所が動く</h3>
            <Equation label="位置q、時刻tの重要度はファイq t。入力画像I q tから生成する。">
              I(q,t) → Φ(q,t) ≥ 0
            </Equation>
            <p className="text-sm leading-7">
              qは領域内の位置、tは時刻、Iは入力画像、Φはその場所の重要度です。翼や羽根、口の形が変わるたびに分布を更新します。左の図は入力の輪郭を示しており、重要度そのものの表示ではありません。
            </p>
          </article>
          <article className="min-w-0">
            <h3 className="font-semibold">2. 各ロボットが担当する領域</h3>
            <Equation label="ボロノイ領域Viは、全ロボットの中でロボットiに最も近い点qの集合。">
              V<sub>i</sub>(t) = {"{"}q ∈ Q : ‖q − p<sub>i</sub>(t)‖ ≤ ‖q − p
              <sub>j</sub>(t)‖, ∀j{"}"}
            </Equation>
            <p className="text-sm leading-7">
              Qは全体の領域、p<sub>i</sub>
              はロボットiの位置です。最も近いロボットごとに領域を分担するので、ロボットが動くと担当領域V
              <sub>i</sub>も変化します。
            </p>
          </article>
          <article className="min-w-0">
            <h3 className="font-semibold">3. 今の重要度で重心を求める</h3>
            <Equation label="重心ciは、Vi上のqファイの積分を、Vi上のファイの積分で割ったもの。">
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
              は重要度で重み付けした担当領域の重心です。重要度が高い場所ほど重心を強く引き寄せます。分母は担当領域の重要度の合計で、正の場合を考えます。
            </p>
          </article>
          <article className="min-w-0">
            <h3 className="font-semibold">4. 重心へ向かって移動する</h3>
            <Equation label="基本的な被覆入力はuiイコールkかけるciマイナスpi。kは正。">
              u<sub>i</sub>
              <sup>cov</sup>(t) = k [c<sub>i</sub>(t) − p<sub>i</sub>(t)],　k
              &gt; 0
            </Equation>
            <p className="text-sm leading-7">
              u<sub>i</sub>
              <sup>cov</sup>
              は重心へ近づく基本入力、kは応答の強さです。この方向をもとに移動を計算します。再生結果には移動モデルとロボット間の相互作用も含まれるため、この式だけで軌跡全体を表すものではありません。
            </p>
          </article>
        </div>
        <article className="rounded-2xl border border-teal-200 p-5 dark:border-teal-900">
          <h3 className="font-semibold">
            動きを先取りして、追従の遅れを減らす
          </h3>
          <Equation label="追従入力は被覆入力と、入力の動きを先取りするフィードフォワード入力の和。">
            u<sub>i</sub>
            <sup>track</sup>(t) = u<sub>i</sub>
            <sup>cov</sup>(t) + u<sub>i</sub>
            <sup>ff</sup>(t)
          </Equation>
          <p className="text-sm leading-7">
            今回の3つの入力は次にどう動くかが分かっています。その移動方向と速さを先取りする入力u
            <sub>i</sub>
            <sup>ff</sup>
            を加え、重心へ近づく動きと組み合わせます。風車では羽根に沿って回る方向へ、鳥では翼が動く方向へ補助します。計算時には並進速度と旋回速度の上限も設けています。ここに示すのは一般的な構成で、具体的な生成式や係数は非公開です。
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
          <h3 className="font-semibold">
            「動く目標への追従」と「静止した形への収束」は別のこと
          </h3>
          <Equation label="被覆目的関数Hは、各担当領域における位置誤差の二乗と重要度の積を積分し、全ロボットで足したもの。">
            H(P,t) = ∑<sub>i</sub> ∫<sub>Vᵢ(t)</sub> ‖q − p<sub>i</sub>‖² Φ(q,t)
            dq
          </Equation>
          <p className="text-sm leading-7">
            Pは全ロボットの配置です。Φが変化すると目標も動くため、Hが常に減少するとは限りません。速い変形では追従の遅れが生じます。風車の支柱と軸は入力上では固定ですが、同じロボットがそこに固定されるわけではありません。これは配置の追従を見るシミュレーションであり、実機での安全性や厳密な追従を保証するものではありません。
          </p>
        </article>
        <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
          参考：
          <a
            className="underline"
            href="https://arxiv.org/abs/math/0212212"
            target="_blank"
            rel="noreferrer"
          >
            Cortés et al., Coverage control for mobile sensing networks
          </a>
          。一般的な被覆制御の説明を掲載しています。研究固有の重要度の生成式・制御実装・内部パラメータは公開していません。
        </p>
      </section>
    </main>
  );
}

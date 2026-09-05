import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_PHI_CONFIG, phiFromImage, type PhiConfig } from "../src/lib/coverage/phi";
import { createSampleImage, SAMPLE_IMAGE_NAME } from "../src/lib/coverage/sampleImage";
import { buildRunResult } from "../src/lib/coverage/runResult";
import { simulate, type SimulationOptions } from "../src/lib/coverage/simulate";

/**
 * お手本の実行を DB に入れる。
 *
 * 公開したとき、初めて来た人がいきなり空の一覧を見ることになるのを避けるため。
 * 比較画面を試せるように、台数だけが違う2件を入れる。
 *
 * これらは ownerToken を持たない＝画面からは誰も削除できず、上限超過の掃除でも消えない。
 * 何度流しても増えないよう、同じタイトルのものがあれば作り直す。
 *
 * 画像処理もシミュレーションも純粋関数なので、ブラウザを立てずにここで同じ結果を再現できる。
 */

const SAMPLE_PHI_CONFIG: PhiConfig = {
  ...DEFAULT_PHI_CONFIG,
  method: "canny",
  gridWidth: 64,
  gridHeight: 48,
};

const SAMPLES: { title: string; options: SimulationOptions }[] = [
  { title: "お手本: サンプル画像 / Canny / 8台", options: { agents: 8, steps: 80, seed: 1 } },
  { title: "お手本: サンプル画像 / Canny / 20台", options: { agents: 20, steps: 80, seed: 1 } },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const image = createSampleImage();
  const grid = phiFromImage(image, SAMPLE_PHI_CONFIG);

  for (const sample of SAMPLES) {
    const simulation = simulate(grid, sample.options);
    const result = buildRunResult({
      grid,
      seed: sample.options.seed,
      simulation,
      imageName: SAMPLE_IMAGE_NAME,
    });

    await prisma.run.deleteMany({ where: { title: sample.title, ownerToken: null } });
    await prisma.run.create({
      data: {
        title: sample.title,
        agents: sample.options.agents,
        steps: sample.options.steps,
        phiConfig: SAMPLE_PHI_CONFIG as unknown as object,
        result: result as unknown as object,
        ownerToken: null,
      },
    });
    console.log(
      `[seed] ${sample.title} → 最終評価値 ${result.finalCost.toFixed(1)}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

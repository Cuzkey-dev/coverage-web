import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { executeExperiment } from "../src/lib/coverage/experiment";
import { createCatalogImage, SAMPLES } from "../src/lib/coverage/samples";
import { DEFAULT_PHI_CONFIG } from "../src/lib/coverage/phi";
import { parseRunResult } from "../src/lib/coverage/runResult";

const output = process.argv[2];
if (!output) throw new Error("Pass an output directory.");
mkdirSync(output, { recursive: true });
const rows = [];
for (const sample of SAMPLES) {
  const image = createCatalogImage(sample.id);
  for (const agents of sample.id === "bird" ? [120, 300, 600, 1200] : [120]) {
    const start = performance.now();
    const result = executeExperiment({
      image,
      imageName: sample.name,
      phiConfig: {
        ...DEFAULT_PHI_CONFIG,
        gridWidth: 128,
        gridHeight: 128,
        bandSigma: 1,
        floor: 0,
      },
      options: { agents, steps: 600, seed: 7 },
      initialMode: "weighted",
    });
    if (!parseRunResult(JSON.parse(JSON.stringify(result))))
      throw new Error("Invalid roundtrip");
    const row = {
      sample: sample.id,
      agents,
      seconds: +((performance.now() - start) / 1000).toFixed(3),
      steps: result.costs.length - 1,
      frames: result.frames.length,
      bytes: Buffer.byteLength(JSON.stringify(result)),
      ...result.quality!.at(-1),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
    writeFileSync(
      join(output, `${sample.id}-${agents}.json`),
      JSON.stringify(result),
    );
    if (agents === 120)
      writeFileSync(
        join(output, `${sample.id}.pgm`),
        Buffer.concat([
          Buffer.from(`P5\n${image.width} ${image.height}\n255\n`),
          Buffer.from(
            Array.from(
              { length: image.width * image.height },
              (_, i) => image.data[i * 4],
            ),
          ),
        ]),
      );
  }
}
writeFileSync(join(output, "benchmark.json"), JSON.stringify(rows, null, 2));

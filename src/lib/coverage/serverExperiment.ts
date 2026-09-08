import type { ExperimentInput, ExperimentProgress } from "./experiment";
import { parseRunResult, type RunResult } from "./runResult";

export async function executeServerExperiment(
  input: ExperimentInput,
  signal: AbortSignal,
  onProgress: (progress: ExperimentProgress) => void,
): Promise<RunResult> {
  const { image, options, phiConfig } = input;
  const gray = Array.from({ length: image.width * image.height }, (_, i) => {
    const alpha = image.data[i * 4 + 3] / 255;
    return Math.round(
      alpha *
        (0.299 * image.data[i * 4] +
          0.587 * image.data[i * 4 + 1] +
          0.114 * image.data[i * 4 + 2]) +
        (1 - alpha) * 255,
    );
  });
  const response = await fetch("/api/simulate", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agents: options.agents,
      steps: options.steps,
      seed: options.seed >>> 0,
      initialMode: input.initialMode,
      imageName: input.imageName.slice(0, 200),
      sizeMode: input.sizeMode ?? "auto",
      imageWidth: image.width,
      imageHeight: image.height,
      gray,
      gridWidth: phiConfig.gridWidth,
      gridHeight: phiConfig.gridHeight,
    }),
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "計算サービスへ接続できませんでした。");
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    result: RunResult | null = null;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "progress") onProgress(event.progress);
    if (event.type === "complete") {
      result = parseRunResult(event.result);
      if (!result || result.settings?.algorithm !== "server-v1")
        throw new Error("計算結果の形式を確認できませんでした。");
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      lines.forEach(consume);
    }
    consume(buffer + decoder.decode());
  } finally {
    await reader.cancel();
  }
  if (!result)
    throw new Error("通信が途中で終了しました。もう一度実行してください。");
  return result;
}

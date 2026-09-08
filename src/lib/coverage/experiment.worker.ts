import { executeExperiment, type ExperimentInput } from "./experiment";

self.onmessage = (event: MessageEvent<ExperimentInput>) => {
  try {
    const result = executeExperiment(event.data, (progress) =>
      self.postMessage({ type: "progress", progress }),
    );
    self.postMessage({ type: "complete", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "計算に失敗しました",
    });
  }
};

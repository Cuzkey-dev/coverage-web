import { describe, expect, it } from "vitest";
import { DEFAULT_PHI_CONFIG } from "./phi";
import { diffParams, listParams, relevantKeys, type RunParams } from "./params";

const base: RunParams = {
  agents: 8,
  steps: 60,
  seed: 1,
  phiConfig: { ...DEFAULT_PHI_CONFIG, method: "canny" },
};

describe("relevantKeys", () => {
  it("Canny は下限・上限を、Sobel は閾値を使う", () => {
    expect(relevantKeys("canny")).toContain("lowThreshold");
    expect(relevantKeys("canny")).not.toContain("threshold");
    expect(relevantKeys("sobel")).toContain("threshold");
    expect(relevantKeys("sobel")).not.toContain("highThreshold");
  });
});

describe("listParams", () => {
  it("方式名は表示用のラベルになる", () => {
    const rows = listParams(base);
    expect(rows.find((r) => r.key === "method")?.a).toBe("Canny");
    expect(rows.every((r) => !r.changed)).toBe(true);
  });
});

describe("diffParams", () => {
  it("変わった項目だけ changed になる", () => {
    const other: RunParams = { ...base, agents: 12 };
    const rows = diffParams(base, other);
    const changed = rows.filter((r) => r.changed).map((r) => r.key);
    expect(changed).toEqual(["agents"]);
    expect(rows.find((r) => r.key === "agents")).toMatchObject({ a: "8", b: "12" });
  });

  it("方式が違うと、片方でしか使わない項目は — になり changed になる", () => {
    const other: RunParams = {
      ...base,
      phiConfig: { ...base.phiConfig, method: "sobel" },
    };
    const rows = diffParams(base, other);
    expect(rows.find((r) => r.key === "threshold")).toMatchObject({ a: "—", changed: true });
    expect(rows.find((r) => r.key === "lowThreshold")).toMatchObject({ b: "—", changed: true });
    expect(rows.find((r) => r.key === "method")).toMatchObject({ a: "Canny", b: "Sobel" });
  });
});

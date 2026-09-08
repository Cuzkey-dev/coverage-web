import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const result = () => ({
  version: 1,
  seed: 7,
  grid: { width: 2, height: 2, phi: [0, 1, 1, 0] },
  frames: [
    { step: 0, positions: [[0, 0]] },
    { step: 1, positions: [[1, 1]] },
  ],
  costs: [1, 0],
  finalCost: 0,
  settings: {
    algorithm: "server-v1",
    initialMode: "uniform",
    maxSteps: 10,
    executedSteps: 8,
    stopReason: "converged",
    sizeMode: "auto",
  },
  quality: [{ step: 1, meanEdgeDistance: 0, edgeCoverage: 1, f1: 0.5 }],
});
const request = () =>
  new Request("https://example.com/api/simulate", {
    method: "POST",
    headers: { origin: "https://example.com" },
    body: "{}",
  });

beforeEach(() => {
  vi.stubEnv("COVERAGE_ENGINE_URL", "https://engine.example.com");
  vi.stubEnv("COVERAGE_ENGINE_TOKEN", "test-service-credential");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("compute API boundary", () => {
  it("fails closed when the service is not configured", async () => {
    vi.stubEnv("COVERAGE_ENGINE_TOKEN", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await POST(request())).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a different origin", async () => {
    expect(
      (
        await POST(
          new Request("https://example.com/api/simulate", {
            method: "POST",
            headers: { origin: "https://other.example.com" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("forwards only public fields and never the service credential", async () => {
    const r = {
      ...result(),
      privateMetadata: "do-not-forward",
      settings: { ...result().settings, privateMetadata: "do-not-forward" },
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ type: "complete", result: r }) + "\n"),
      );
    vi.stubGlobal("fetch", fetch);
    const response = await POST(request());
    const text = await response.text();
    expect(text).not.toContain("do-not-forward");
    expect(text).not.toContain("test-service-credential");
    const decoded = JSON.parse(text).result;
    expect(decoded.settings.executedSteps).toBe(8);
    expect(decoded.frames.at(-1).step).toBe(1);
    expect(decoded.quality[0].f1).toBe(0.5);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer test-service-credential",
    );
  });
  it("blocks a nonbinary internal map", async () => {
    const r = result();
    r.grid.phi[0] = 0.123;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ type: "complete", result: r }) + "\n"),
        ),
    );
    const text = await (await POST(request())).text();
    expect(text).not.toContain("0.123");
    expect(JSON.parse(text).type).toBe("error");
  });
  it("handles JSON records split across transport chunks", async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ type: "complete", result: result() }) + "\n",
    );
    let offset = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            pull(c) {
              if (offset >= bytes.length) {
                c.close();
                return;
              }
              c.enqueue(bytes.slice(offset, offset + 13));
              offset += 13;
            },
          }),
        ),
      ),
    );
    const text = await (await POST(request())).text();
    expect(JSON.parse(text).result.settings.executedSteps).toBe(8);
  });
  it("does not expose upstream error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("private-diagnostic", { status: 500 })),
    );
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-diagnostic");
  });
  it("cancels upstream when the reader cancels", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(
              new TextEncoder().encode(
                '{"type":"progress","progress":{"step":0,"maxSteps":10,"cost":1,"frame":{"positions":[[0,0]]}}}\n',
              ),
            );
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const reader = (await POST(request())).body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

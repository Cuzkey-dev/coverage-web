import { parseRunResult } from "@/lib/coverage/runResult";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const url = process.env.COVERAGE_ENGINE_URL,
    token = process.env.COVERAGE_ENGINE_TOKEN;
  if (!url || !token)
    return Response.json(
      { error: "計算サービスを準備中です。時間をおいてお試しください。" },
      { status: 503 },
    );
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host)
    return Response.json(
      { error: "このページから再実行してください。" },
      { status: 403 },
    );
  let body = "";
  if (!request.body) return new Response(null, { status: 400 });
  const inputReader = request.body.getReader(),
    decoder = new TextDecoder();
  let size = 0;
  while (true) {
    const { done, value } = await inputReader.read();
    if (done) break;
    size += value.length;
    if (size > 1_200_000) {
      await inputReader.cancel();
      return Response.json({ error: "画像が大きすぎます。" }, { status: 413 });
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 280_000);
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  let upstream: Response;
  try {
    upstream = await fetch(`${url.replace(/\/$/, "")}/simulate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      signal: abort.signal,
      cache: "no-store",
    });
  } catch {
    clearTimeout(timeout);
    return Response.json(
      { error: "計算サービスへ接続できませんでした。もう一度お試しください。" },
      { status: 502 },
    );
  }
  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeout);
    return Response.json(
      {
        error:
          upstream.status === 400
            ? "実行条件を確認してください。"
            : "計算サービスが混み合っています。時間をおいて再実行してください。",
      },
      { status: upstream.status === 400 ? 400 : 503 },
    );
  }
  const reader = upstream.body.getReader(),
    decode = new TextDecoder(),
    encode = new TextEncoder();
  let buffer = "";
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        // A transport chunk may end in the middle of a JSON record. Continue
        // reading until something can be enqueued, otherwise the stream stalls.
        for (;;) {
          const { done, value } = await reader.read();
          buffer += done
            ? decode.decode()
            : decode.decode(value, { stream: true });
          if (buffer.length > 1_800_000) throw new Error("invalid result");
          const lines = buffer.split("\n");
          buffer = lines.pop()!;
          if (done && buffer) {
            lines.push(buffer);
            buffer = "";
          }
          let emitted = false;
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            let output;
            if (event.type === "complete") {
              const result = parseRunResult(event.result);
              if (
                !result ||
                result.settings?.algorithm !== "server-v1" ||
                !result.grid.phi.every((v) => v === 0 || v === 1)
              )
                throw new Error("invalid result");
              output = { type: "complete", result };
            } else if (event.type === "progress") {
              const p = event.progress;
              if (
                !p ||
                !Number.isInteger(p.step) ||
                !Number.isInteger(p.maxSteps) ||
                p.step < 0 ||
                p.step > p.maxSteps ||
                p.maxSteps > 3000 ||
                !Number.isFinite(p.cost) ||
                !Array.isArray(p.frame?.positions) ||
                p.frame.positions.length > 1200
              )
                throw new Error("invalid progress");
              const positions = p.frame.positions.map((pair: unknown) => {
                if (
                  !Array.isArray(pair) ||
                  pair.length !== 2 ||
                  !pair.every(
                    (v) => typeof v === "number" && Number.isFinite(v),
                  )
                )
                  throw new Error("invalid position");
                return [pair[0], pair[1]];
              });
              output = {
                type: "progress",
                progress: {
                  step: p.step,
                  maxSteps: p.maxSteps,
                  cost: p.cost,
                  frame: { step: p.step, positions },
                },
              };
            } else if (event.type === "error") {
              output = {
                type: "error",
                message:
                  "計算を完了できませんでした。明暗のある画像で再実行してください。",
              };
            } else throw new Error("invalid event");
            controller.enqueue(encode.encode(JSON.stringify(output) + "\n"));
            emitted = true;
          }
          if (done) {
            clearTimeout(timeout);
            controller.close();
            return;
          }
          if (emitted) return;
        }
      } catch {
        clearTimeout(timeout);
        abort.abort();
        controller.enqueue(
          encode.encode(
            JSON.stringify({
              type: "error",
              message: "通信が途中で終了しました。もう一度実行してください。",
            }) + "\n",
          ),
        );
        controller.close();
      }
    },
    cancel() {
      clearTimeout(timeout);
      abort.abort();
      return reader.cancel();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

import { countRuns } from "@/lib/runs";

/**
 * 死活監視用のエンドポイント。
 * デプロイ直後に「アプリが起きているか」と「データベースに届くか」を確かめるのに使う。
 * データベースが死んでいても 503 を返すだけで、例外は外に出さない。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await countRuns();
    return Response.json({ status: "ok", database: "ok", runs });
  } catch (e) {
    console.error("health check failed", e);
    return Response.json(
      { status: "degraded", database: "unreachable" },
      { status: 503 },
    );
  }
}

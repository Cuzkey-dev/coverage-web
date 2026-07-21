/**
 * 死活監視用のエンドポイント。
 * デプロイ直後に「アプリが起きているか」を確かめるのに使う。
 */
export async function GET() {
  return Response.json({ status: "ok" });
}

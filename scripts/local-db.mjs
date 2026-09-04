// 開発用のローカル PostgreSQL を起動して待機する。
// Neon などの本番 DB が手元に無いときに `npm run db:local` で立ち上げ、
// .env の DATABASE_URL を postgresql://postgres:password@127.0.0.1:54329/coverage にして使う。
// データは .local-db/ に残る（git 管理外）。Ctrl+C で停止する。
import EmbeddedPostgres from "embedded-postgres";

const PORT = Number(process.env.LOCAL_DB_PORT ?? 54329);
const DB_NAME = "coverage";

const pg = new EmbeddedPostgres({
  databaseDir: "./.local-db",
  user: "postgres",
  password: "password",
  port: PORT,
  persistent: true,
});

const firstTime = !(await import("node:fs")).existsSync("./.local-db/PG_VERSION");
if (firstTime) {
  console.log("[local-db] クラスタを初期化します");
  await pg.initialise();
}
await pg.start();
if (firstTime) {
  await pg.createDatabase(DB_NAME);
}
console.log(
  `[local-db] 起動しました: postgresql://postgres:password@127.0.0.1:${PORT}/${DB_NAME}`,
);

const stop = async () => {
  console.log("[local-db] 停止します");
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

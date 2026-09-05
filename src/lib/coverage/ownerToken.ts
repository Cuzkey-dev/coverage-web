/**
 * 所有者トークン。
 *
 * 認証を入れていないので、公開したときに「他人が保存した実行を誰でも消せる」状態になる。
 * それを避けるため、ブラウザごとに乱数を1つ発行して localStorage に持ち、
 * 保存した実行に付けておく。削除できるのはトークンが一致する実行だけ。
 *
 * 本人確認ではないので（localStorage を書き換えれば名乗れる）、
 * これは「うっかり他人の実行を消してしまう」を防ぐための仕切りであって、認証の代わりではない。
 */

const STORAGE_KEY = "coverage-web.owner-token";

/** トークンの形。DB に入る値なので長さを固定して検証できるようにする */
export const OWNER_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function isOwnerToken(value: unknown): value is string {
  return typeof value === "string" && OWNER_TOKEN_PATTERN.test(value);
}

function createToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * このブラウザのトークンを返す。無ければ作って保存する。
 * localStorage が使えない環境（プライベートウィンドウなど）ではその場限りの値を返す。
 */
export function getOwnerToken(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isOwnerToken(stored)) return stored;
    const token = createToken();
    window.localStorage.setItem(STORAGE_KEY, token);
    return token;
  } catch {
    return createToken();
  }
}

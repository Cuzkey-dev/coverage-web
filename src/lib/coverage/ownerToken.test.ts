import { describe, expect, it } from "vitest";
import { isOwnerToken, OWNER_TOKEN_PATTERN } from "./ownerToken";

describe("isOwnerToken", () => {
  it("16 バイトの16進文字列だけを通す", () => {
    expect(isOwnerToken("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isOwnerToken("0123456789ABCDEF0123456789ABCDEF")).toBe(false);
    expect(isOwnerToken("short")).toBe(false);
    expect(isOwnerToken("0123456789abcdef0123456789abcdefff")).toBe(false);
    expect(isOwnerToken(null)).toBe(false);
    expect(isOwnerToken(123)).toBe(false);
  });

  it("SQL やパス区切りを含む値は通さない", () => {
    expect(isOwnerToken("'; drop table \"Run\"; --")).toBe(false);
    expect(OWNER_TOKEN_PATTERN.test("../../etc")).toBe(false);
  });
});

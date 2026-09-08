import { expect, it } from "vitest";
import { formatDate } from "./format";

it("renders Japan time consistently across server and browser", () => {
  expect(formatDate("2026-09-08T16:23:00.000Z")).toBe("2026/09/09 01:23");
});

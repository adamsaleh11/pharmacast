import { describe, expect, it } from "vitest";
import { normalizeDin } from "./drugs";

describe("normalizeDin", () => {
  it("canonicalizes 1 to 8 digit DIN values", () => {
    expect(normalizeDin("12345")).toBe("00012345");
    expect(normalizeDin(" 02242903 ")).toBe("02242903");
  });

  it("rejects blank, nonnumeric, or overlong DIN values", () => {
    expect(normalizeDin("")).toBeNull();
    expect(normalizeDin("ABC123")).toBeNull();
    expect(normalizeDin("123456789")).toBeNull();
  });
});

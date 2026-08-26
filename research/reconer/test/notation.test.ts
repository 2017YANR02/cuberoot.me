import { describe, it, expect } from "vitest";
import { getFace, getMoveFace, getInverse, splitByFingering } from "../src/notation.ts";

describe("notation helpers", () => {
  it("getInverse: basic / double / wide / compound", () => {
    expect(getInverse("R")).toBe("R'");
    expect(getInverse("U'")).toBe("U");
    expect(getInverse("U2")).toBe("U2");
    expect(getInverse("f'")).toBe("f");
    expect(getInverse("U D'")).toBe("U' D");
    expect(getInverse("??")).toBe("??"); // 未知原样返回
  });

  it("getMoveFace: no y fallback, handles wide + null", () => {
    expect(getMoveFace("R2")).toBe("R");
    expect(getMoveFace("r'")).toBe("R");
    expect(getMoveFace("y")).toBe(null);
    expect(getMoveFace(null)).toBe(null);
  });

  it("getFace: y fallback; 'b' not treated as wide face", () => {
    expect(getFace("F")).toBe("F");
    expect(getFace("u'")).toBe("U");
    expect(getFace("y2")).toBe("y");
    expect(getFace("b")).toBe(null); // 'udlrf' 不含 b, 与原实现一致
    expect(getFace("...")).toBe(null);
  });

  it("splitByFingering strips ↑↓· and collapses whitespace", () => {
    expect(splitByFingering("↑R↓U·F")).toEqual(["R", "U", "F"]);
    expect(splitByFingering("  R  U ")).toEqual(["R", "U"]);
  });
});

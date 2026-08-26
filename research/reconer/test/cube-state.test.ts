import { describe, it, expect } from "vitest";
import { CubeState, tokenize, reverseAlgorithm } from "../src/cube-state.ts";

describe("CubeState", () => {
  it("starts solved", () => {
    expect(new CubeState().isSolved()).toBe(true);
  });

  it("Sexy Move x6 = identity", () => {
    const c = new CubeState();
    for (let i = 0; i < 6; i++) c.apply("R U R' U'");
    expect(c.isSolved()).toBe(true);
  });

  it("face^4 = identity for every face", () => {
    for (const m of ["U", "D", "L", "R", "F", "B"]) {
      const c = new CubeState().apply(`${m} ${m} ${m} ${m}`);
      expect(c.isSolved(), `${m}4`).toBe(true);
    }
  });

  it("X X' = identity for every face", () => {
    for (const m of ["U", "D", "L", "R", "F", "B"]) {
      const c = new CubeState().apply(`${m} ${m}'`);
      expect(c.isSolved(), `${m} ${m}'`).toBe(true);
    }
  });

  it("wide moves self-invert (r r', f f', u u')", () => {
    for (const w of ["r", "f", "u"]) {
      expect(new CubeState().apply(`${w} ${w}'`).isSolved(), `${w} ${w}'`).toBe(true);
    }
  });

  it("middle-layer moves self-invert (M M', E E', S S')", () => {
    for (const m of ["M", "E", "S"]) {
      expect(new CubeState().apply(`${m} ${m}'`).isSolved(), `${m} ${m}'`).toBe(true);
    }
  });

  it("standalone rotations do not change stickers", () => {
    expect(new CubeState().apply("x y z x2 y' z'").isSolved()).toBe(true);
  });

  it("superflip is not solved", () => {
    const c = new CubeState().apply(
      "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    );
    expect(c.isSolved()).toBe(false);
  });

  it("GT solution: forward + reverse = identity", () => {
    const gt =
      "F L2 D' L' U R' F R2 U R' U2 L' U L R' U2 R U D' L F' L' F L U L' U' f U2 R U R' U2 f' U L' R U R' U' L U2 R U2 R' U'";
    const c = new CubeState().apply(gt);
    // 手工逆序 (含宽转 f), 验证与 apply 的展开一致
    const inv: Record<string, string> = {
      U: "U'", "U'": "U", U2: "U2", D: "D'", "D'": "D", D2: "D2",
      L: "L'", "L'": "L", L2: "L2", R: "R'", "R'": "R", R2: "R2",
      F: "F'", "F'": "F", F2: "F2", B: "B'", "B'": "B", B2: "B2",
      f: "f'", "f'": "f",
    };
    const rev = tokenize(gt).reverse().map((t) => inv[t]).join(" ");
    c.apply(rev);
    expect(c.isSolved()).toBe(true);
  });

  it("toColorString of solved state", () => {
    expect(new CubeState().toColorString()).toBe(
      "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB",
    );
  });

  it("U2' == U2", () => {
    expect(new CubeState().apply("U2").sc).toEqual(new CubeState().apply("U2'").sc);
  });

  it("tokenize handles compound symbols", () => {
    expect(tokenize("R U2' Rw2 M' x'")).toEqual(["R", "U2'", "Rw2", "M'", "x'"]);
  });

  it("reverseAlgorithm inverts basic-move sequences", () => {
    expect(reverseAlgorithm("R U R' U'")).toBe("U R U' R'");
    const c = new CubeState().apply("R U F D2 L'");
    c.apply(reverseAlgorithm("R U F D2 L'"));
    expect(c.isSolved()).toBe(true);
  });
});

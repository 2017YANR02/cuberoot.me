import { describe, expect, it } from "vitest";
import { CubeState } from "../src/cube-state.ts";
import {
  anchoredBeamSearch,
  buildVocabulary,
  invertMove,
  invertToken,
  normalizeToken,
} from "../src/anchored-search.ts";

describe("invertToken", () => {
  it("基本 / 宽转 / 转体 / 双转", () => {
    expect(invertToken("U")).toBe("U'");
    expect(invertToken("U'")).toBe("U");
    expect(invertToken("U2")).toBe("U2");
    expect(invertToken("U2'")).toBe("U2");
    expect(invertToken("r'")).toBe("r");
    expect(invertToken("d'")).toBe("d");
    expect(invertToken("y")).toBe("y'");
  });
});

describe("invertMove 复合 token", () => {
  it("UD' / L2'x' 逆序取逆", () => {
    expect(invertMove("UD'")).toBe("D U'");
    expect(invertMove("L2'x'")).toBe("x L2");
  });

  it("apply(m) 后 apply(invertMove(m)) 回到 Solved", () => {
    for (const m of ["UD'", "L2'x'", "r", "f'", "U2'", "u", "d'", "U'D2"]) {
      const s = new CubeState();
      s.apply(m);
      s.apply(invertMove(m));
      expect(s.isSolved()).toBe(true);
    }
  });
});

describe("buildVocabulary", () => {
  it("覆盖 GT 词表: 基本/宽转/x捆绑/UD组合/空段", () => {
    const tokens = new Set(buildVocabulary().map((c) => c.token));
    for (const t of ["U", "U'", "U2", "r", "d'", "L2x'", "UD'", "U'D2", ""]) {
      expect(tokens.has(t), `缺候选 ${t}`).toBe(true);
    }
  });
});

describe("anchoredBeamSearch", () => {
  it("小算例: 含噪概率下锚定并还原已知序列", () => {
    const gt = ["R", "U'", "F2", "L", "U2"];
    const scramble = new CubeState();
    for (let i = gt.length - 1; i >= 0; i--) scramble.apply(invertMove(gt[i]));

    // 正确面 0.6 + 干扰面 0.4 (模拟分类器噪声)
    const other: Record<string, string> = { R: "L", U: "D", F: "U", L: "R" };
    const probs = gt.map((m) => {
      const f = m[0].toUpperCase();
      return { [f]: 0.6, [other[f]]: 0.4 };
    });

    const r = anchoredBeamSearch(probs, [], scramble, { beamWidth: 256, maxRotInserts: 0 });
    expect(r.anchored).toBe(true);
    expect(r.segTokens.map(normalizeToken)).toEqual(gt.map(normalizeToken));
  });

  it("锚定不可达时返回 bestUnanchored 兜底", () => {
    // 打乱态与任何 1 段路径都不一致 (需要 2 步才能到) → 锚定失败
    const scramble = new CubeState().apply("R U");
    const r = anchoredBeamSearch([{ F: 1.0 }], [], scramble, { beamWidth: 16, maxRotInserts: 0 });
    expect(r.anchored).toBe(false);
    expect(r.bestUnanchored).toBeDefined();
  });
});

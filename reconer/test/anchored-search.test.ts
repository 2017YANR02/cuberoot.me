import { describe, expect, it } from "vitest";
import type { Perm } from "../src/cube-state.ts";
import {
  IDENTITY_PERM,
  invertPerm,
  permKey,
  physicalPerm,
  seqCompose,
} from "../src/rotation-perms.ts";
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

  it("物理语义下 m ∘ invertMove(m) = 恒等", () => {
    for (const m of ["UD'", "L2'x'", "r", "f'", "U2'", "u", "d'", "U'D2", "y", "y2"]) {
      const p = seqCompose(physicalPerm(m), physicalPerm(invertMove(m)));
      expect(permKey(p), m).toBe(permKey(IDENTITY_PERM));
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

  it("物理语义: r 与 L 置换不同 (canonical 里相同)", () => {
    const vocab = buildVocabulary();
    const r = vocab.find((c) => c.token === "r")!;
    const L = vocab.find((c) => c.token === "L")!;
    expect(permKey(r.invPerm)).not.toBe(permKey(L.invPerm));
  });
});

/** 由解法 token 串构造打乱空间态: scramble ∘ solution = solved */
function scrambleFromSolution(tokens: string[]): Perm {
  let sol: Perm = IDENTITY_PERM;
  for (const t of tokens) sol = seqCompose(sol, physicalPerm(t));
  return invertPerm(sol);
}

const COLOR_NAMES = ["W", "R", "G", "Y", "O", "B"] as const;

/** 正向回放, 给每个非转体 token 的段起点生成 B 面 one-hot 观测 */
function replayObservations(scramble: Perm, tokens: string[]) {
  let cur: Perm = scramble;
  const obs: ({ idx: number; dist: Record<string, number> }[] | null)[] = [];
  for (const t of tokens) {
    if (!t.startsWith("y")) {
      obs.push(
        Array.from({ length: 9 }, (_, i) => ({
          idx: 45 + i,
          dist: { [COLOR_NAMES[Math.floor(cur[45 + i] / 9)]]: 1 },
        })),
      );
    }
    cur = seqCompose(cur, physicalPerm(t));
  }
  const finalObservation = Array.from({ length: 9 }, (_, i) => ({
    idx: 45 + i,
    dist: { [COLOR_NAMES[Math.floor(cur[45 + i] / 9)]]: 1 },
  }));
  return { obs, finalObservation };
}

describe("anchoredBeamSearch (物理语义)", () => {
  it("小算例: 含噪概率下锚定并还原已知序列", () => {
    const gt = ["R", "U'", "F2", "L", "U2"];
    const scramble = scrambleFromSolution(gt);

    // 正确面 0.6 + 干扰面 0.4 (模拟分类器噪声)。纯概率无方向信息 →
    // 方向并列 3^5 × 24 朝向, beam 需 ≥ 并列数才能确定性保住真路径
    const other: Record<string, string> = { R: "L", U: "D", F: "U", L: "R" };
    const probs = gt.map((m) => {
      const f = m[0].toUpperCase();
      return { [f]: 0.6, [other[f]]: 0.4 };
    });

    const r = anchoredBeamSearch(probs, scramble, { beamWidth: 8192, maxRotInserts: 0 });
    expect(r.anchored).toBe(true);
    expect(r.segTokens.map(normalizeToken)).toEqual(gt.map(normalizeToken));
  });

  it("中途 y 转体: 观测下通过 y 插入锚定并还原 (物理语义专属能力)", () => {
    // 正向: R F y' R U。y' 跟在 F 后 (不同轴不可交换), 词表无 token 可吸收
    // (u/d 只吸收 y+U/D 同轴组合, 如 R U y' R U ≡ R d R U 就能免插入锚定),
    // 故无插入必不可锚定。
    const gt = ["R", "F", "y'", "R", "U"];
    const scramble = scrambleFromSolution(gt);
    const segs = gt.filter((t) => !t.startsWith("y")); // probs 跳过 y 段
    const probs = segs.map((m) => ({ [m[0]]: 0.9 }));
    const { obs, finalObservation } = replayObservations(scramble, gt);

    const common = { beamWidth: 1024, observations: obs, finalObservation };
    const r = anchoredBeamSearch(probs, scramble, { ...common, maxRotInserts: 2 });
    expect(r.anchored).toBe(true);
    expect(r.movesFlat.map(normalizeToken)).toEqual(gt.map(normalizeToken));

    // 无插入时真路径不可表达。锚定 ≠ 正确: 短序列下可能存在"另解"碰巧锚定
    // (如 R F2x' F2x' u'), 但观测罚分使其分数远差 — 区分真路径靠得分。
    const noIns = anchoredBeamSearch(probs, scramble, { ...common, maxRotInserts: 0 });
    if (noIns.anchored) {
      expect(noIns.movesFlat.map(normalizeToken)).not.toEqual(gt.map(normalizeToken));
      expect(r.score - noIns.score).toBeGreaterThan(20);
    }
  });

  it("锚定不可达时返回 bestUnanchored 兜底", () => {
    // 打乱态与任何 1 段路径都不一致 (需要 2 步才能到) → 锚定失败
    const scramble = scrambleFromSolution(["R", "U"]);
    const r = anchoredBeamSearch([{ F: 1.0 }], scramble, { beamWidth: 64, maxRotInserts: 0 });
    expect(r.anchored).toBe(false);
    expect(r.bestUnanchored).toBeDefined();
  });
});

/**
 * /recon 详情页那个 ⇄ 按钮 —— 把十字段写成纯单层转 + 一个前缀转体。
 * =========================================================================
 *
 * 起因是用户报的 `/recon/2473`:那把的十字整个就是一个 `M'`,而按钮压根没出现 ——
 * 判据只认宽转动,不认中层。补上之后 `M'` 得展开成 `R' L x`,**那个 `x` 不能省**:
 * 省了之后十字之后的每一步都错位。
 *
 * 所以这里每一条都拿魔方模型对着原文验一次「重写前后是同一个置换」,而不是比字符串
 * —— 比字符串只能证明它没变,证明不了它是对的。
 */

import { describe, it, expect } from 'vitest';

import {
  buildReconGroundTruth,
  buildNormalizedSolution,
  canonicalizeReconSolution,
  findCrossLineIndex,
  hasNormalizableCrossMove,
} from '@cuberoot/shared/recon-ground-truth';
import { normalize } from '@/lib/recon-norm-cross';
import { applyOneToken } from '@/app/[lang]/timer/_lib/cube/apply_token';
import { solved, facesEqual } from '@/app/[lang]/timer/_lib/cube/state';

/** 整段复盘 → 转动序列(丢掉 `//` 注释和空行)。 */
function algOf(solution: string): string[] {
  return solution.split(/\r?\n/)
    .map(l => (l.includes('//') ? l.slice(0, l.indexOf('//')) : l))
    .join(' ')
    .trim().split(/\s+/).filter(Boolean);
}

function apply(tokens: readonly string[]) {
  let st = solved(3);
  for (const t of tokens) st = applyOneToken(st, t);
  return st;
}

describe('什么时候挂 ⇄ 按钮', () => {
  it('十字段里的中层也算 —— `/recon/2473` 就是这么一个按钮都没有的', () => {
    expect(hasNormalizableCrossMove("M' // cross")).toBe(true);
    expect(hasNormalizableCrossMove('U M2 U // cross\nR U R\' // GR')).toBe(true);
  });

  it('宽转动照旧算', () => {
    expect(hasNormalizableCrossMove("r U R' // cross")).toBe(true);
    expect(hasNormalizableCrossMove("Rw U R' // cross")).toBe(true);
  });

  it('纯单层转的十字不挂 —— 没什么可换的', () => {
    expect(hasNormalizableCrossMove("D R' F D2 // cross")).toBe(false);
    // 转体本来就在前缀里,不算
    expect(hasNormalizableCrossMove("x' z' D R' // cross")).toBe(false);
  });

  it('十字之后的中层不算 —— 这个按钮只管十字段', () => {
    expect(hasNormalizableCrossMove("D R' // cross\nM2 U M2 // PLL")).toBe(false);
  });

  it('认不出十字行就不挂', () => {
    expect(hasNormalizableCrossMove("M' U R")).toBe(false);
    expect(hasNormalizableCrossMove('')).toBe(false);
  });
});

describe('中层展开', () => {
  it("`M'` 就是用户说的 `R' L x`(转体收进前缀写在最前)", () => {
    expect(buildNormalizedSolution("M' // cross")).toBe("x R' L // cross");
  });

  it('展开之后没有中层、没有宽转动剩下', () => {
    const out = buildNormalizedSolution("M' U M2 // cross") as string;
    const crossTokens = algOf(out.split(/\r?\n/).slice(0, findCrossLineIndex(out) + 1).join('\n'));
    for (const tok of crossTokens) {
      expect(/^[MES]/.test(tok), tok).toBe(false);
      expect(/^[rludfb]/.test(tok) || tok.includes('w'), tok).toBe(false);
    }
  });

  it('`normalize` 默认不展开 —— 别的调用方(转视角 / 首段判定)吃的还是中层', () => {
    expect(normalize(["M'"])).toEqual(["M'"]);
    expect(normalize(["M'"], { expandSlices: true })).toEqual(['x', "R'", 'L']);
  });
});

describe('重写前后是同一个置换', () => {
  const cases: Array<[string, string]> = [
    ['单个中层(2473 那把)', "M' // cross"],
    ['中层混面转', "U M2 U' M // cross"],
    ['中层 + 后续步骤', "M' // cross\nR U R' U' // GR\nU2 R U R' // GO"],
    ['中层 + 宽转动 + 转体', "x' z' // insp\nU2 r F M' // cross\nR U' R' // GR"],
    ['只有宽转动(老行为不许变)', "x' // insp\nU2 R F r' F' // W xcross\nU' F R' F' R // GR"],
    ['转体夹在中间', "D M2 y R U R' // cross\nU R U' R' // GR"],
  ];

  for (const [name, solution] of cases) {
    it(name, () => {
      const out = buildNormalizedSolution(solution);
      expect(out, name).toBeTruthy();
      expect(facesEqual(apply(algOf(solution)), apply(algOf(out as string))), name).toBe(true);
    });
  }
});

describe('ground truth 文本口径', () => {
  it('只保留真转动与有语义的阶段名', () => {
    expect(canonicalizeReconSolution(
      "(R U) D2U' → ... // W cross (2.960) ↔ (BO)\n... M2' U2 // PLL-Z (0.22+0.80)",
    )).toBe("R U D2 U' // W cross (BO)\nM2' U2 // PLL-Z");
  });

  it('2383 以 Normalize cross 后的文字进入测试', () => {
    const scramble = "R2 F' D' B L R D U' L B2 F2 L2 F D B2 L R U'";
    const solution = [
      "x' z2 // insp",
      "U' r' D R2 U L F' L' D // W xcross (BO)",
      "U2 R U' R' // GO",
    ].join('\n');
    expect(buildReconGroundTruth(scramble, solution).truth).toBe([
      scramble,
      'z2 // insp',
      "F' L' D R2 U L F' L' D // W xcross (BO)",
      "U2 R U' R' // GO",
    ].join('\n'));
  });
});

// lib/pocket-cost 的等价性锁定 —— 对拍 TNoodle 上游递归 computeCost。
//
// oracleComputeCost 是 TwoByTwoSolver.java:402-465 的逐行 JS 转写(输入 = 解序 code,采 moveToString
// 序 U/U2/U'/R/R2/R'/F/F2/F' = 0..8;各 case 体照抄)。上游 computeCost(解序 S) = 执行 inverse(S) 的
// 代价 + 恒定 cU3(读越界位)。pocketCost(A) = 正序执行 A 的代价,故应有
//   pocketCost(A) === oracleComputeCost(invert(A)) - cU3
// 其中 invert(A) 把 A 解析成 moveToString code、reverse 并逐招取逆。5000 例 fuzz + 手算样本。
import { describe, it, expect } from 'vitest';
import { pocketCost, POCKET_COSTS } from '@/lib/pocket-cost';

const c = POCKET_COSTS;

// moveToString 序(= 解序 code 的语义,与上游一致)
const MOVE_TO_STRING = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"];
// moveToString code → 其逆招的 moveToString code:U↔U'、R↔R'、F↔F',带 2 不变
const INV = [2, 1, 0, 5, 4, 3, 8, 7, 6];

// TwoByTwoSolver.computeCost 的忠实转写(含 index=length 读越界位=0 的 phantom)。solution = 解序 code。
function oracleComputeCost(solution: number[]): number {
  const cc = (index: number, cur: number, grip: number): number => {
    if (index < 0) return cur;
    const mv = index < solution.length ? solution[index] : 0;
    switch (mv) {
      case 0: return cc(index - 1, cur + c.U3, grip);
      case 1: return cc(index - 1, cur + c.U2, grip);
      case 2:
        if (grip === 0) return cc(index - 1, cur + c.U, 0);
        if (grip === -1) return Math.min(cc(index - 1, cur + c.regrip + c.U, 0), cc(index - 1, cur + c.Ulow, grip));
        return cc(index - 1, cur + c.regrip + c.U, 0);
      case 3:
        return grip > -1 ? cc(index - 1, cur + c.R3, grip - 1) : cc(index - 1, cur + c.regrip + c.R3, -1);
      case 4:
        return grip !== 0 ? cc(index - 1, cur + c.R2, -grip)
          : Math.min(cc(index - 1, cur + c.regrip + c.R2, -1), cc(index - 1, cur + c.regrip + c.R2, 1));
      case 5:
        return grip < 1 ? cc(index - 1, cur + c.R, grip + 1) : cc(index - 1, cur + c.regrip + c.R, 1);
      case 6:
        return grip !== 0 ? cc(index - 1, cur + c.F3, grip)
          : Math.min(cc(index - 1, cur + c.regrip + c.F3, -1), cc(index - 1, cur + c.regrip + c.F3, 1));
      case 7:
        return grip === -1 ? cc(index - 1, cur + c.F2, -1) : cc(index - 1, cur + c.regrip + c.F2, -1);
      case 8:
        return grip === -1 ? cc(index - 1, cur + c.F, -1) : cc(index - 1, cur + c.regrip + c.F, -1);
      default: return -1;
    }
  };
  return cc(solution.length, 0, 0);
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('pocket-cost vs TNoodle computeCost', () => {
  it('5000 例随机 U/R/F 串与上游递归逐例相等(差常数 cU3)', () => {
    const r = rng(424242);
    let checked = 0;
    for (let k = 0; k < 5000; k++) {
      const len = 1 + Math.floor(r() * 12);
      const codes: number[] = []; // moveToString code
      let prevFace = -1;
      for (let i = 0; i < len; i++) {
        let mv: number;
        do { mv = Math.floor(r() * 9); } while ((mv / 3 | 0) === prevFace);
        prevFace = mv / 3 | 0;
        codes.push(mv);
      }
      const alg = codes.map((m) => MOVE_TO_STRING[m]).join(' ');
      const mine = pocketCost(alg) as number;
      const solution = codes.slice().reverse().map((m) => INV[m]); // invert(A) 作解序
      const oracle = oracleComputeCost(solution) - c.U3;
      expect(mine).toBe(oracle);
      checked++;
    }
    expect(checked).toBe(5000);
  });

  it('手算样本(正序执行代价)', () => {
    // R(+6→g1) U(regrip+8=28→g0) R'(+6→g-1) U'(+7→g-1) = 47
    expect(pocketCost("R U R' U'")).toBe(47);
    expect(pocketCost('')).toBe(0);
    expect(pocketCost("U'")).toBe(c.U3); // 7,不换手
    expect(pocketCost('R')).toBe(c.R);   // 6
  });

  it('F2 比 U2 贵得多(模型对 F 层的厌恶)', () => {
    expect(pocketCost('R F2 R') as number).toBeGreaterThan(pocketCost('R U2 R') as number);
  });

  it('未知步契约同 algSpeed', () => {
    expect(pocketCost('R D R')).toBe('Unknown move: D');
    expect(pocketCost('R D R', true)).toBe(pocketCost('R R', true));
    expect(typeof pocketCost('R x R')).toBe('string');
  });
});

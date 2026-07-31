/**
 * 中层还原(`humanize.ts`)。
 * =========================================================================
 *
 * 起因是用户的一句话:「我做的 PLL 实际上是 `R2 U' S' U2' S U' R2`」,而报告里印的是
 * `L2 U' B F' L2 F B' U' L2 U2`。两个中层各变成一对相对面,夹在中间的 `U2'` 被换名
 * 成 `L2` —— 因为做中层的时候中心核跟着转了,后面每一手都换了名。
 *
 * 所以这里的头号测试是**把那条公式按魔方的报法生成一遍,再要求重写器原样还原它**。
 * 生成器 `record()` 走的是和重写器相反的方向,两边只共用拆分表这一个事实;要是符号
 * 写反了,两边会在「重写结果 ≠ 原公式」上炸,而不是互相抵消。
 */

import { describe, it, expect } from 'vitest';

import {
  MAX_PAIR_GAP_MS,
  humanizeStream,
  sliceSplitTable,
} from '@/app/[lang]/timer/_lib/reconstruct/humanize';
import { facePermFor, conjugateToken } from '@/app/[lang]/timer/_lib/reconstruct/orient';
import { htmMoves } from '@/app/[lang]/timer/_lib/reconstruct/htm';
import type { HtmMove } from '@/app/[lang]/timer/_lib/reconstruct/htm';
import { applyOneToken } from '@/app/[lang]/timer/_lib/cube/apply_token';
import { solved, facesEqual } from '@/app/[lang]/timer/_lib/cube/state';

const T = (s: string) => s.trim().split(/\s+/).filter(Boolean);

function apply(tokens: readonly string[]) {
  let st = solved(3);
  for (const t of tokens) st = applyOneToken(st, t);
  return st;
}

/** 中层 → 魔方会报的那一对 + 它把核心转了多少。拆分表反过来查。 */
function pairForSlice(slice: string): { pair: [string, string]; rotation: string } {
  for (const [key, v] of sliceSplitTable()) {
    if (v.slice === slice) {
      const [a, b] = key.split(' ');
      return { pair: [a, b], rotation: v.rotation };
    }
  }
  throw new Error(`no recorded pair for ${slice}`);
}

/**
 * 人的公式 → 魔方会报的那条流。
 *
 * 维护 ρ =「核心到这里为止转了多少」:普通一手报成 `ρ⁻¹ h ρ`;中层报成它那一对,
 * 并且 `ρ ← ρ·σ`。和 `humanizeStream` 的推导互为逆运算,见该文件头注。
 */
function record(human: readonly string[]): string[] {
  const out: string[] = [];
  let rho = '';
  for (const h of human) {
    // 反向:人的记号 → 魔方系里的记号,正是 `conjugateToken` 本来的方向。
    const inv = facePermFor(rho);
    if (/^[MES]/.test(h)) {
      // 人写的中层先搬回魔方那个系,再查它报成哪一对。
      const inFrame = conjugateToken(h, inv);
      if (!inFrame) throw new Error(`cannot reframe ${h}`);
      const { pair, rotation } = pairForSlice(inFrame);
      out.push(pair[0], pair[1]);
      rho = rho === '' ? rotation : `${rho} ${rotation}`;
    } else {
      const tok = conjugateToken(h, inv);
      if (!tok) throw new Error(`cannot reframe ${h}`);
      out.push(tok);
    }
  }
  return out;
}

/** 记号串 → HtmMove[]。`pairGap` 是相对面那两手之间的间隔,别的手用 `gap`。 */
function stamped(tokens: readonly string[], gap = 200, tight: ReadonlySet<number> = new Set()): HtmMove[] {
  let t = 0;
  return tokens.map((m, i) => {
    t += i === 0 ? gap : (tight.has(i) ? 12 : gap);
    return { m, ts: t, endTs: t, quarters: m.endsWith('2') ? 2 : 1, startIdx: i, endIdx: i };
  });
}

describe('拆分表', () => {
  const table = sliceSplitTable();

  it('每一条都真的等价 —— 一对相对面 = 中层 + 转体', () => {
    expect(table.size).toBeGreaterThan(0);
    for (const [key, { slice, rotation }] of table) {
      expect(facesEqual(apply(T(key)), apply([slice, rotation]))).toBe(true);
    }
  });

  it('六个有序轴向 × 三种量 = 18 条', () => {
    expect(table.size).toBe(18);
  });

  it('转向相反的一对拆不开 —— `R L` 不是中层', () => {
    expect(table.has('R L')).toBe(false);
    expect(table.has("R' L'")).toBe(false);
    expect(table.has("U D")).toBe(false);
  });

  it('量不一样的一对拆不开', () => {
    expect(table.has("F2 B'")).toBe(false);
    expect(table.has('F B2')).toBe(false);
  });

  it('用户那把里的两对都在表里', () => {
    expect(table.get("F B'")).toBeTruthy();
    expect(table.get("B F'")).toBeTruthy();
  });
});

describe('humanizeStream —— 用户报的那条 PLL', () => {
  // 用户写的是 `U2'`,标准写法是 `U2`(半转没有方向),其余一字不改。
  const HUMAN = T("R2 U' S' U2 S U' R2");

  it('魔方的报法确实把中层变成一对相对面、并且换掉后面的名', () => {
    const rec = record(HUMAN);
    // 7 手里有两个中层,各变成两手 → 9 手。
    expect(rec).toHaveLength(9);
    // 夹在两个中层之间的那一手不再写成 U —— 这正是用户看到的 `L2`。
    const mid = rec[4];
    expect(mid.startsWith('U')).toBe(false);
    expect(mid.endsWith('2')).toBe(true);
  });

  it('重写回来就是那条公式,一个记号不差', () => {
    const rec = record(HUMAN);
    const tight = new Set([3, 6]);   // 两对相对面各自的第二手
    const { moves, merges } = humanizeStream(stamped(rec, 200, tight));
    expect(merges).toBe(2);
    expect(moves.map(m => m.m)).toEqual(HUMAN);
  });

  it('间隔拉开到两个动作那么远就不合 —— 宁可少写一个中层', () => {
    const rec = record(HUMAN);
    const { moves, merges } = humanizeStream(stamped(rec, 200));
    expect(merges).toBe(0);
    expect(moves.map(m => m.m)).toEqual(rec);
  });
});

describe('等价性 —— 重写只换写法,不换这把', () => {
  const cases: Array<[string, string[], Set<number>]> = [
    ['一个 S', T("F B' U2 R"), new Set([1])],
    ['一个 M', T("R L' U F'"), new Set([1])],
    ['一个 E', T("U D' R2 F"), new Set([1])],
    ['连着两个中层', T("F B' U2 B F' R"), new Set([1, 4])],
  ];

  for (const [name, rec, tight] of cases) {
    it(`${name}:重写后的谱子 + 剩下的转体 = 原流`, () => {
      const { moves, merges, rotation } = humanizeStream(stamped(rec, 200, tight));
      expect(merges).toBeGreaterThan(0);
      const rewritten = [...moves.map(m => m.m), ...T(rotation)];
      expect(facesEqual(apply(rec), apply(rewritten))).toBe(true);
    });
  }
});

describe('不该合的不合', () => {
  it('跨过步骤边界不合', () => {
    const rec = T("F B' U2");
    const tight = new Set([1]);
    const plain = humanizeStream(stamped(rec, 200, tight));
    expect(plain.merges).toBe(1);
    const split = humanizeStream(stamped(rec, 200, tight), { boundaries: new Set([0]) });
    expect(split.merges).toBe(0);
  });

  it('没有设备时钟(整条流的间隔都被打包成一样)时整体退化成不合并', () => {
    // 到达时间戳:同一个 BLE 包里的几手挤成同一刻,中位间隔也是 0 —— 相对判据于是
    // 没有哪一对能「明显更短」。
    const rec = T("F B' U2 R U");
    const flat = rec.map((m, i) => ({
      m, ts: 0, endTs: 0, quarters: 1, startIdx: i, endIdx: i,
    }));
    expect(humanizeStream(flat).merges).toBe(0);
  });

  it('绝对上限本身就拦得住一半的常速手法', () => {
    const rec = T("F B'");
    const justOver = humanizeStream(stamped(rec, MAX_PAIR_GAP_MS + 1, new Set()));
    expect(justOver.merges).toBe(0);
  });

  it('空流 / 单手不炸', () => {
    expect(humanizeStream([]).moves).toEqual([]);
    expect(humanizeStream(htmMoves([{ m: 'R', ts: 10 }])).merges).toBe(0);
  });
});

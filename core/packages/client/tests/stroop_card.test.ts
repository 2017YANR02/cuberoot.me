/**
 * /stroop 出卡与成绩计算的回归。
 *
 * 卡片的两条硬约束(相邻墨色不同、每色份额相差 ≤1)是这个测试存在的理由 ——
 * 排布一旦退化成纯随机,卡就有难有易、两次成绩不可比,而肉眼看不出来。
 */

import { describe, it, expect } from 'vitest';
import {
  generateCard, STROOP_COLORS, COLOR_NAMES, CARD_KINDS, CELL_COUNTS,
  type StroopColor,
} from '@/app/[lang]/stroop/_lib/card';
import {
  addRun, bestPerCell, interferenceMs, perCellMs, MAX_RUNS, type StroopRun,
} from '@/app/[lang]/stroop/_lib/history';
import { CUBE_FILL } from '@/lib/cube-colors';

/** 种子化 RNG,让「随机」排布可复现。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function counts(xs: readonly StroopColor[]): number[] {
  const m = new Map<StroopColor, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.values()];
}

describe('调色板', () => {
  it('就是魔方六面色,一个不多一个不少', () => {
    expect([...STROOP_COLORS]).toEqual(['white', 'yellow', 'red', 'orange', 'blue', 'green']);
    // 面色单一源在 lib/cube-colors:六个面各出一次,别在本页另立一套色名
    expect(Object.keys(CUBE_FILL)).toHaveLength(STROOP_COLORS.length);
  });

  it('每种颜色都有双语名字(印在格子里的就是它)', () => {
    for (const c of STROOP_COLORS) {
      expect(COLOR_NAMES[c].zh).toHaveLength(1);
      expect(COLOR_NAMES[c].en.length).toBeGreaterThan(2);
    }
  });
});

describe('generateCard', () => {
  it('格数为 0 / 负数时给空卡,不抛', () => {
    expect(generateCard('incongruent', 0)).toEqual([]);
    expect(generateCard('incongruent', -5)).toEqual([]);
  });

  for (const kind of CARD_KINDS) {
    it(`${kind}:格数正确、墨色相邻不同、份额相差 ≤1`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const rand = mulberry32(seed * 7919);
        for (const n of CELL_COUNTS) {
          const card = generateCard(kind, n, rand);
          expect(card).toHaveLength(n);

          const inks = card.map(c => c.ink);
          for (const ink of inks) expect(STROOP_COLORS).toContain(ink);
          for (let i = 1; i < inks.length; i++) expect(inks[i]).not.toBe(inks[i - 1]);

          const c = counts(inks);
          expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
          // 均分:n 能被 6 整除时每色份额必须完全相等
          if (n % STROOP_COLORS.length === 0) expect(new Set(c).size).toBe(1);
        }
      }
    });
  }

  it('色块卡没有字', () => {
    const card = generateCard('patch', 20, mulberry32(1));
    expect(card.every(c => c.word === null)).toBe(true);
  });

  it('一致卡字色相同', () => {
    const card = generateCard('congruent', 20, mulberry32(2));
    expect(card.every(c => c.word === c.ink)).toBe(true);
  });

  it('干扰卡字色必然冲突 —— 这是整个测试的前提', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const card = generateCard('incongruent', 40, mulberry32(seed));
      expect(card.every(c => c.word !== null && c.word !== c.ink)).toBe(true);
    }
  });

  it('干扰卡的字也大致均匀(每色份额相差 ≤2)', () => {
    // 字要同时躲开本格墨色和上一格的字,做不到墨色那样严格均分,但不能塌成一两种。
    for (let seed = 1; seed <= 20; seed++) {
      const card = generateCard('incongruent', 40, mulberry32(seed * 31));
      const c = counts(card.map(x => x.word as StroopColor));
      expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(2);
    }
  });

  it('同一种子出同一张卡(排布可复现)', () => {
    const a = generateCard('incongruent', 20, mulberry32(123));
    const b = generateCard('incongruent', 20, mulberry32(123));
    expect(a).toEqual(b);
  });
});

describe('history', () => {
  const run = (kind: StroopRun['kind'], ms: number, count = 20, ts = 1): StroopRun =>
    ({ kind, ms, count, ts });

  it('每格用时按格数摊,格数为 0 时给 0 而不是 Infinity', () => {
    expect(perCellMs(run('patch', 20000))).toBe(1000);
    expect(perCellMs(run('patch', 20000, 0))).toBe(0);
  });

  it('addRun 新的在前并裁到上限', () => {
    let runs: StroopRun[] = [];
    for (let i = 0; i < MAX_RUNS + 10; i++) runs = addRun(runs, run('patch', i, 20, i));
    expect(runs).toHaveLength(MAX_RUNS);
    expect(runs[0].ts).toBe(MAX_RUNS + 9);
  });

  it('最好成绩只在同类型卡里比,且跨格数可比(按每格摊)', () => {
    const runs = [
      run('patch', 10000), run('patch', 12000),
      run('patch', 8000, 40),      // 40 格 8s = 200 ms/格,才是最好的那次
      run('incongruent', 30000),
    ];
    expect(bestPerCell(runs, 'patch')).toBe(200);
    expect(bestPerCell(runs, 'incongruent')).toBe(1500);
    expect(bestPerCell(runs, 'congruent')).toBeNull();
  });

  it('干扰量 = 干扰卡最好 − 色块卡最好,缺一张就没有', () => {
    const patchOnly = [run('patch', 10000)];
    expect(interferenceMs(patchOnly)).toBeNull();
    expect(interferenceMs([...patchOnly, run('incongruent', 16000)])).toBe(300);
  });

  it('干扰量为负时照实返回(基线那次发挥失常),不夹到 0', () => {
    expect(interferenceMs([run('patch', 20000), run('incongruent', 10000)])).toBe(-500);
  });
});

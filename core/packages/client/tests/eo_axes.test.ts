import { describe, expect, it } from 'vitest';
import { cube3x3x3 } from 'cubing/puzzles';
import {
  EO_AXIS_UNIVERSE, contingencyTables, eoAxisJoint, eoAxisMarginal, eoAxisMinDist,
  meanOfDist, pairOffset, tableWays,
} from '@/lib/eo-axes';

/**
 * 三轴坏棱联合分布的两道锁:
 *   ① 那张 18 项「层对 → 偏移」小表,现场从 cubing.js 的三阶模型重读一遍(不是手抄);
 *   ② 算出来的 65 个组合,与 3x3.xlsx `EO` 页逐个对上(那页出自 speedsolving 概率串
 *      #1520621,与本机的列联表-卷积算法完全无关)。
 */

/** 棱序 = cubing.js 的 UF UR UB UL DF DR DB DL FR FL BR BL。 */
const EDGE_NAMES = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'];
const sliceOf = (i: number) => (['UF', 'UB', 'DF', 'DB'].includes(EDGE_NAMES[i]) ? 'M'
  : ['UR', 'UL', 'DR', 'DL'].includes(EDGE_NAMES[i]) ? 'S' : 'E');

// 表格 EO 页的 65 行:升序三元组 → 状态数
const SHEET: Array<[string, number]> = [
  ['0,0,0', 1], ['12,12,12', 1], ['0,0,8', 3], ['4,12,12', 3], ['0,0,2', 48], ['10,12,12', 48],
  ['0,0,6', 48], ['6,12,12', 48], ['0,0,4', 108], ['8,12,12', 108], ['0,2,8', 576], ['4,10,12', 576],
  ['0,2,2', 1008], ['10,10,12', 1008], ['2,10,10', 1098], ['2,2,10', 1098], ['0,8,8', 3753],
  ['4,4,12', 3753], ['0,2,6', 4416], ['6,10,12', 4416], ['0,2,4', 6336], ['8,10,12', 6336],
  ['0,4,8', 6336], ['4,8,12', 6336], ['2,2,2', 12602], ['10,10,10', 12602], ['0,4,4', 14148],
  ['8,8,12', 14148], ['0,6,8', 14976], ['4,6,12', 14976], ['0,6,6', 22608], ['6,6,12', 22608],
  ['0,4,6', 29376], ['6,8,12', 29376], ['2,2,8', 31056], ['4,10,10', 31056], ['2,4,10', 38016],
  ['2,8,10', 38016], ['2,6,10', 95976], ['2,2,6', 138636], ['6,10,10', 138636], ['2,2,4', 150336],
  ['8,10,10', 150336], ['2,8,8', 259056], ['4,4,10', 259056], ['2,4,8', 585792], ['4,8,10', 585792],
  ['2,4,4', 756576], ['8,8,10', 756576], ['2,6,8', 1147392], ['4,6,10', 1147392], ['2,6,6', 1415376],
  ['6,6,10', 1415376], ['4,4,4', 1483843], ['8,8,8', 1483843], ['2,4,6', 1829952], ['6,8,10', 1829952],
  ['4,8,8', 2536704], ['4,4,8', 2536704], ['4,4,6', 6295824], ['6,8,8', 6295824], ['6,6,6', 6527128],
  ['4,6,8', 9836928], ['4,6,6', 10465584], ['6,6,8', 10465584],
];

describe('三轴坏棱:那张 18 项小表是从 cubing.js 读出来的', () => {
  it('每条棱的三轴好坏只由 {家所在层, 现所在层} 与朝向位决定,且与 lib 的表一致', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    // 三个轴 = F/B(原生朝向位)、U/D(绕 x 共轭)、R/L(绕 y 共轭)
    const ROTS = ['', 'x', 'y'];
    const edgesOf = (alg: string, rot: string) =>
      solved.applyAlg(rot ? `${rot}' ${alg} ${rot}` : alg).patternData.EDGES;
    // 转体把位置怎么搬:pattern(rot).pieces[pos] = 转完 pos 上是原来的哪块 → 反查得到位置映射
    const posMap = (r: string) => {
      const pieces = solved.applyAlg(r).patternData.EDGES.pieces as number[];
      const m = new Array<number>(12);
      pieces.forEach((piece, pos) => { m[piece] = pos; });
      return m;
    };
    const maps = ROTS.map((r) => (r ? posMap(r) : null));

    // 每个面转一下:该轴翻 4 条,另两个轴一条不翻 —— 确认三个轴确实是三个轴
    const flips = (alg: string, rot: string) =>
      (edgesOf(alg, rot).orientation as number[]).reduce((a, b) => a + b, 0);
    expect(ROTS.map((r) => flips('U', r))).toEqual([0, 4, 0]);
    expect(ROTS.map((r) => flips('R', r))).toEqual([0, 0, 4]);
    expect(ROTS.map((r) => flips('F', r))).toEqual([4, 0, 0]);

    const seen = new Map<string, string>();
    let rng = 12345;
    const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const MOVES = ['U', 'D', 'L', 'R', 'F', 'B'];
    for (let t = 0; t < 200; t++) {
      let alg = '';
      for (let i = 0; i < 25; i++) alg += `${MOVES[Math.floor(rand() * 6)]}${['', "'", '2'][Math.floor(rand() * 3)]} `;
      const base = edgesOf(alg, '');
      const perAxis = ROTS.map((r) => (r ? edgesOf(alg, r) : base));
      (base.pieces as number[]).forEach((piece, pos) => {
        const o = (base.orientation as number[])[pos];
        const bits = perAxis.map((d, i) => {
          const q = maps[i] ? (maps[i] as number[])[pos] : pos;
          return (d.orientation as number[])[q];
        });
        // ① F/B 那一位就是朝向位本身
        expect(bits[0]).toBe(o);
        // ② 另两位 = 朝向位 XOR 层对偏移
        const [a, b] = pairOffset(sliceOf(piece), sliceOf(pos));
        expect(`${sliceOf(piece)}${sliceOf(pos)}${o}:${bits[1]},${bits[2]}`)
          .toBe(`${sliceOf(piece)}${sliceOf(pos)}${o}:${o ^ a},${o ^ b}`);
        seen.set(`${piece}|${pos}|${o}`, bits.join(','));
      });
    }
    // 12 块 × 12 位置 × 2 朝向,一个不漏地覆盖到
    expect(seen.size).toBe(288);
  }, 120000);
});

describe('三轴坏棱:联合分布', () => {
  const joint = eoAxisJoint();

  it('列联表加权 = 34,650;总和 = 70,963,200 = 34,650 × 2¹¹', () => {
    expect(contingencyTables().reduce((a, N) => a + tableWays(N), 0)).toBe(34650);
    expect(joint.reduce((a, c) => a + c.count, 0)).toBe(EO_AXIS_UNIVERSE);
    expect(34650 * 2 ** 11).toBe(EO_AXIS_UNIVERSE);
  });

  it('65 个组合,逐个对上表格', () => {
    const mine = new Map(joint.map((c) => [c.triple.join(','), c.count]));
    expect(mine.size).toBe(65);
    expect(SHEET.length).toBe(65);
    for (const [k, v] of SHEET) expect(`${k}=${mine.get(k)}`).toBe(`${k}=${v}`);
  });

  it('单轴平均恰好 6,三个轴里最小的那个平均 4.7013', () => {
    expect(meanOfDist(eoAxisMarginal())).toBe(6);
    expect(meanOfDist(eoAxisMinDist())).toBeCloseTo(4.701325757575757, 12);
  });

  it('单轴边际 = C(12,k) × 34,650,只有偶数档', () => {
    const m = eoAxisMarginal();
    const C = (n: number, k: number) => {
      let r = 1;
      for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
      return Math.round(r);
    };
    for (let k = 0; k <= 12; k++) {
      expect(`${k}=${m[k] ?? 0}`).toBe(`${k}=${k % 2 ? 0 : C(12, k) * 34650}`);
    }
  });

  it('三元组全是偶数,且极差 ≤ 8 —— 65 个可能组合一个不少', () => {
    let possible = 0;
    for (let x = 0; x <= 12; x += 2) {
      for (let y = x; y <= 12; y += 2) {
        for (let z = y; z <= 12; z += 2) if (z - x <= 8) possible++;
      }
    }
    expect(possible).toBe(65);
    for (const { triple } of joint) {
      expect(triple.every((v) => v % 2 === 0)).toBe(true);
      expect(triple[2] - triple[0]).toBeLessThanOrEqual(8);
    }
  });

  it('x ↔ 12−x 对称:补集组合的状态数相同', () => {
    const mine = new Map(joint.map((c) => [c.triple.join(','), c.count]));
    for (const [k, v] of mine) {
      const mirror = k.split(',').map((n) => 12 - Number(n)).sort((a, b) => a - b).join(',');
      expect(`${k}→${mirror}=${mine.get(mirror)}`).toBe(`${k}→${mirror}=${v}`);
    }
  });

  // 「平均每个轴 6 条坏棱」是对的,但 (6,6,6) 并不是最常见的组合
  it('(4,6,6) 与 (6,6,8) 都比 (6,6,6) 常见', () => {
    const mine = new Map(joint.map((c) => [c.triple.join(','), c.count]));
    expect(mine.get('4,6,6')).toBe(10465584);
    expect(mine.get('6,6,8')).toBe(10465584);
    expect(mine.get('6,6,6')).toBe(6527128);
    expect(joint[0].triple.join(',')).not.toBe('6,6,6');
  });
});

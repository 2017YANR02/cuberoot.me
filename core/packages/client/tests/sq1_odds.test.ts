/**
 * Square-1 形状枚举与各阶段跳步概率的护栏。
 *
 * 三条独立来源互锁:①本机枚举的 3,678 个可切形状;②`/math/god?event=sq1` 那页引自
 * jaapsch.net 的形状数与状态空间;③同页 Chen 2017 面转分布逐档求和。三者必须给出同一个
 * 11,958,666,854,400 —— 任何一处被改坏,这里立刻红。
 *
 * 上游 `Cube Odds.xlsx` 的 SQ1 页那几格(CS 1/919.5、CSP 1/1839、PBL 1/20,736、
 * 11 面转 1/2,864,045.387 等)也在这里逐格对账,包括那格自相矛盾的 OBL。
 */
import { describe, expect, it } from 'vitest';
import {
  HALF_PATTERNS, SQ1_ADJ_ADJ_EP, SQ1_CP_CASES, SQ1_CUBE_SHAPES, SQ1_EP_CASES, SQ1_HALF_SLOTS,
  SQ1_LAYER_SPLITS, SQ1_OBL_UNIVERSE, SQ1_ODDS, SQ1_PBL_CASES, SQ1_SHAPES, SQ1_SLOTS, SQ1_STATES,
  enumerateShapes, isSquareLayer, layerTurns, reachableShapes, shapeKey, sliceShape,
} from '@/lib/sq1-odds';
import { FACE_DIST, STATE_SPACE, TWIST_DIST } from '@/app/[lang]/math/god/_components/sq1/sq1_data';
import { SKIP_ENTRIES, entryById, oneOver } from '@/lib/skip-probability';

describe('SQ1 形状:枚举本身', () => {
  it('半层只有 13 种填法,每种正好填满 6 槽', () => {
    expect(HALF_PATTERNS.length).toBe(13);
    for (const p of HALF_PATTERNS) {
      expect(p.reduce((a, b) => a + b, 0)).toBe(SQ1_HALF_SLOTS);
      expect(p.every((s) => s === 1 || s === 2)).toBe(true);
    }
  });

  it('可切形状 3,678 个:两层都填满 12 槽,角块总数恒 8,且互不重复', () => {
    const shapes = enumerateShapes();
    expect(shapes.length).toBe(3678);
    expect(SQ1_SHAPES).toBe(3678);
    const keys = new Set<string>();
    for (const s of shapes) {
      expect(s.top.reduce((a, b) => a + b, 0)).toBe(SQ1_SLOTS);
      expect(s.bottom.reduce((a, b) => a + b, 0)).toBe(SQ1_SLOTS);
      const corners = [...s.top, ...s.bottom].filter((x) => x === 2).length;
      expect(corners).toBe(8);
      keys.add(shapeKey(s));
    }
    expect(keys.size).toBe(3678);
  });

  it('从立方体形状广搜摸得到全部 3,678 个 —— 形状图连通,枚举没多也没少', () => {
    const reached = reachableShapes();
    expect(reached.size).toBe(3678);
    const enumerated = new Set(enumerateShapes().map(shapeKey));
    for (const k of reached) expect(enumerated.has(k), k).toBe(true);
  });

  it('立方体形状只有 4 个:上下层各 2 个可切摆位', () => {
    expect(SQ1_CUBE_SHAPES).toBe(4);
    const cubes = enumerateShapes().filter((s) => isSquareLayer(s.top) && isSquareLayer(s.bottom));
    expect(cubes.length).toBe(4);
    // 4 个都是「角棱交替」的两层,只差谁先起头
    for (const c of cubes) {
      for (const layer of [c.top, c.bottom]) {
        expect(layer.length).toBe(8);
        expect(layer.filter((x) => x === 2).length).toBe(4);
      }
    }
  });

  it('一层转位:正方形层只有 3 个可切摆位里的 2 个能到(第三个把角块劈在切缝上)', () => {
    const square = [2, 1, 2, 1, 2, 1, 2, 1];
    const turns = layerTurns(square);
    // 12 个 30° 位里,可切的共 2 个;当前这个不算在内,所以只剩 1 个
    expect(turns.length).toBe(1);
    expect(turns[0]).toEqual([1, 2, 1, 2, 1, 2, 1, 2]);
  });

  it('"/" 一刀是对合:切两次回到原形状', () => {
    const shapes = enumerateShapes();
    for (const s of shapes.slice(0, 200)) {
      expect(shapeKey(sliceShape(sliceShape(s)))).toBe(shapeKey(s));
    }
  });
});

describe('SQ1 状态空间:三条独立来源必须相等', () => {
  it('形状 × 中层 × 8!·8! = 11,958,666,854,400', () => {
    expect(SQ1_STATES).toBe(11_958_666_854_400n);
  });

  it('与 /math/god 那页引 jaapsch.net 的可切态数逐字相同', () => {
    expect(STATE_SPACE.shapes.twistable).toBe(SQ1_SHAPES);
    expect(STATE_SPACE.twistable).toBe(SQ1_STATES.toLocaleString('en-US'));
  });

  it('与 Chen 2017 面转分布逐档求和相同(完全独立的第三条路)', () => {
    const sum = FACE_DIST.reduce((a, r) => a + BigInt(r.count), 0n);
    expect(sum).toBe(SQ1_STATES);
    expect(FACE_DIST[FACE_DIST.length - 1].d).toBe(31);
  });

  it('扭转口径那份分布求和 = 435,891,456,000 = 站内 distinct 口径', () => {
    const sum = TWIST_DIST.reduce((a, r) => a + r.count, 0);
    expect(sum).toBe(435_891_456_000);
    expect(STATE_SPACE.distinct).toBe(sum.toLocaleString('en-US'));
  });
});

describe('SQ1 跳步:逐格对上游表格', () => {
  const oneOverOdds = (o: { num: number; den: number }) => o.den / o.num;

  it('CS 跳步 = 4/3678 = 1/919.5', () => {
    expect(SQ1_ODDS.cs).toEqual({ num: 4, den: 3678 });
    expect(oneOverOdds(SQ1_ODDS.cs)).toBe(919.5);
  });

  it('CSP 跳步 = 1/1839:立方体形状再折半(排列奇偶与形状独立)', () => {
    expect(oneOverOdds(SQ1_ODDS.csp)).toBe(1839);
  });

  it('CO / EO 各 1/70,OBL 1/4900 —— 上游那格写 1/2450,是把整只翻转也算成功', () => {
    expect(SQ1_LAYER_SPLITS).toBe(70);
    expect(oneOverOdds(SQ1_ODDS.co)).toBe(70);
    expect(oneOverOdds(SQ1_ODDS.eo)).toBe(70);
    expect(SQ1_OBL_UNIVERSE).toBe(4900);
    expect(oneOverOdds(SQ1_ODDS.obl)).toBe(4900);
    // 同一套「允许整只翻转」口径下 CO/EO 也得 ×2 —— 上游两处不同口径,记在这
    expect(SQ1_OBL_UNIVERSE / 2).toBe(2450);
  });

  it('PBL = 角 36 × 棱 576 = 20,736,相邻-相邻棱 16/576 = 1/36', () => {
    expect(SQ1_CP_CASES).toBe(36);
    expect(SQ1_EP_CASES).toBe(576);
    expect(SQ1_PBL_CASES).toBe(20736);
    expect(oneOverOdds(SQ1_ODDS.pbl)).toBe(20736);
    expect(SQ1_ADJ_ADJ_EP).toBe(16);
    expect(oneOverOdds(SQ1_ODDS.adjAdjEp)).toBe(36);
  });

  it('上游「11 面转」那格 = 恰好 11 步的那一档占比,1/2,864,045.387', () => {
    const at11 = FACE_DIST.find((r) => r.d === 11)!;
    expect(at11.count).toBe(4_175_446);
    const oneOverExact = Number(SQ1_STATES) / at11.count;
    expect(oneOverExact.toFixed(3)).toBe('2864045.387');
  });
});

describe('SQ1 跳步:接进速查表', () => {
  it('速查表里 sq1 组九条,概率与 lib/sq1-odds 同源', () => {
    const rows = SKIP_ENTRIES.filter((e) => e.group === 'sq1');
    expect(rows.length).toBe(9);
    expect(oneOver(entryById('sq1-cs'))).toBe(919.5);
    expect(oneOver(entryById('sq1-pbl'))).toBe(20736);
    expect(oneOver(entryById('sq1-adj'))).toBe(36);
    for (const r of rows) expect(Number(r.num)).toBeGreaterThan(0);
  });
});

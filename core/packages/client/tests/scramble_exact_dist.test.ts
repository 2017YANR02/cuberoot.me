import { describe, expect, it } from 'vitest';
import {
  EXACT_DIST, EXACT_STAGES, SLOT_OK,
  compactExact, exactColorsOf, exactMean, exactRatio, exactRatios, formatExactPct, getExactCell,
  groupDigits, isSlotApplicable,
  type ExactFull, type ExactStage,
} from '@/app/[lang]/scramble/stats/_data/exact_dist';

/**
 * 精确穷举分布的回归锁。数值来自 solver/src/bin/dist_*.rs 的 GOLDEN 注释
 * (C++ 金标 + Rust 逐位复算),本页展示的全部价值就在于逐位正确 —— 改动这些数字
 * 必须是有意的,故一律 toBe() 锁死,禁放宽。
 */

/** 遍历所有 (stage, slot, colors) 单元。 */
function eachCell(fn: (stage: ExactStage, slot: string, colors: string, cell: unknown) => void) {
  for (const stage of EXACT_STAGES) {
    for (const [slot, byColor] of Object.entries(EXACT_DIST[stage])) {
      for (const [colors, cell] of Object.entries(byColor ?? {})) fn(stage, slot, colors, cell);
    }
  }
}

describe('exact_dist 数据完整性', () => {
  // 18 格 ≠ solver 那边的 19 个 dist_* bin:dist_xcross_{1col,2col}_0f 算出的
  // 0 步数已经是各自完整分布的 d=0 行(37,908,599 / 4,716,424,212,835),不另占格子;
  // 反过来 xxxxcross 单色底没有对应 bin,0 步平凡为 1,这里补上。
  it('矩阵 18 格:8 个完整分布 + 10 个仅 0 步', () => {
    let full = 0, zero = 0;
    eachCell((_s, _sl, _c, cell) => {
      if ((cell as ExactFull).kind === 'full') full++; else zero++;
    });
    expect(full).toBe(8);
    expect(zero).toBe(10);
  });

  it('每个完整分布的 counts 之和等于 total', () => {
    eachCell((stage, slot, colors, cell) => {
      const c = cell as ExactFull;
      if (c.kind !== 'full') return;
      const sum = c.counts.reduce((a, v) => a + BigInt(v), 0n);
      expect(`${stage}/${slot}/${colors}=${sum}`).toBe(`${stage}/${slot}/${colors}=${c.total}`);
    });
  });

  it('counts / total 全是十进制数字串(不是 number,防精度静默丢失)', () => {
    eachCell((_s, _sl, _c, cell) => {
      const c = cell as ExactFull;
      if (c.kind === 'full') {
        expect(typeof c.total).toBe('string');
        for (const v of c.counts) expect(v).toMatch(/^\d+$/);
      }
    });
  });
});

describe('对齐 C++ 金标的关键数值', () => {
  // .done/cross_1_col/ 的 .2do:190,080 / Average Distance 5.8121
  it('单色底 Cross', () => {
    const c = EXACT_DIST.cross.unfixed!.W as ExactFull;
    expect(c.total).toBe('190080');
    expect(c.counts).toEqual(['1', '15', '158', '1394', '9809', '46381', '97254', '34966', '102']);
    expect(exactMean(c).toFixed(4)).toBe('5.8121');
    // 逐档占比对齐 .2do 打印的百分比。注意这两个值同时也在守 SCALE 的大小 ——
    // 放大因子若退回 1e6,整数除法会把 51.16477% 截成 51.1647%,与 C++ 输出差一位。
    expect(formatExactPct(exactRatio('46381', c.total))).toBe('24.4008%');
    expect(formatExactPct(exactRatio('97254', c.total))).toBe('51.1648%');
  });

  // .done/cross_2_col/:5,109,350,400 / Average Dist 5.3872
  it('双色底 Cross', () => {
    const c = EXACT_DIST.cross.unfixed!.WY as ExactFull;
    expect(c.total).toBe('5109350400');
    expect(exactMean(c).toFixed(4)).toBe('5.3872');
  });

  // .done/cross_6_col/:980,995,276,800 / Avg Depth 4.80946
  it('六色底 Cross', () => {
    const c = EXACT_DIST.cross.unfixed!.BGORWY as ExactFull;
    expect(c.total).toBe('980995276800');
    expect(exactMean(c).toFixed(5)).toBe('4.80946');
  });

  // .done/xcross_1_col/:total 695,280,402,432,000,max depth 10
  it('单色底 XCross(不固定槽)', () => {
    const c = EXACT_DIST.xcross.unfixed!.W as ExactFull;
    expect(c.total).toBe('695280402432000');
    expect(c.counts.length).toBe(11);
    expect(c.counts[10]).toBe('4998960');
  });

  // .done/xcross_1_col_fixed/:72,990,720 / Avg Len 7.98
  it('单色底 XCross(固定 BL 槽)', () => {
    const c = EXACT_DIST.xcross.fixed1!.W as ExactFull;
    expect(c.total).toBe('72990720');
    expect(exactMean(c).toFixed(2)).toBe('7.98');
  });

  // dist_xcross_2col.rs:全空间 43,252,003,274,489,856,000 —— 超 Number 安全区三个数量级
  it('双色底 XCross 的大数不经过 Number', () => {
    const c = EXACT_DIST.xcross.unfixed!.WY as ExactFull;
    expect(c.total).toBe('43252003274489856000');
    expect(c.counts[7]).toBe('25284688565714070184');
    // 存成 number 就会变成 25284688565714070000,这正是必须用字符串的原因
    expect(Number(c.counts[7]) > Number.MAX_SAFE_INTEGER).toBe(true);
    expect(String(Number(c.counts[7]))).not.toBe(c.counts[7]);
  });

  it('XXCross 固定双槽 adj / diag 同状态空间、不同分布', () => {
    const adj = EXACT_DIST.xxcross.adj!.W as ExactFull;
    const diag = EXACT_DIST.xxcross.diag!.W as ExactFull;
    expect(adj.total).toBe('21459271680');
    expect(diag.total).toBe(adj.total);
    expect(adj.counts.length).toBe(13);
    expect(adj.counts[12]).toBe('2090462');
    expect(diag.counts[12]).toBe('1436832');
  });

  it('0 步状态数对齐容斥输出', () => {
    expect((EXACT_DIST.xcross.unfixed!.BGORWY as { zero: string }).zero).toBe('14066967166411');
    expect((EXACT_DIST.xxcross.unfixed!.W as { zero: string }).zero).toBe('193203');
    expect((EXACT_DIST.xxxcross.unfixed!.W as { zero: string }).zero).toBe('597');
    expect((EXACT_DIST.xxxxcross.unfixed!.BGORWY as { zero: string }).zero).toBe('373219');
    // 单色底 XCross 的 0 步数 = 完整分布的 d=0 行,两份数据必须自洽
    expect((EXACT_DIST.xcross.unfixed!.W as ExactFull).counts[0]).toBe('37908599');
  });
});

describe('BigInt 占比:小档不能被整除成 0', () => {
  // 放大因子给小了会静默出错:1e6 时 1/21,459,271,680 整除后是 0,柱子和表格行一起消失
  it('XXCross d=0(1 / 21,459,271,680)仍是正数', () => {
    const c = EXACT_DIST.xxcross.adj!.W as ExactFull;
    const r = exactRatio(c.counts[0], c.total);
    expect(r).toBeGreaterThan(0);
    expect(formatExactPct(r)).toBe('4.66e-9%');
  });

  it('整条分布每一档都是正数,且归一化后和约等于 1', () => {
    eachCell((_s, _sl, _c, cell) => {
      const c = cell as ExactFull;
      if (c.kind !== 'full') return;
      const rs = exactRatios(c);
      let sum = 0;
      for (const d of Object.keys(rs)) {
        expect(rs[d]).toBeGreaterThan(0);
        sum += rs[d];
      }
      expect(sum).toBeCloseTo(1, 6);
    });
  });
});

describe('底色折叠与槽位适用性', () => {
  it('同档内各配色折到同一份数据(颜色对称性)', () => {
    for (const k of ['W', 'Y', 'B', 'G', 'O', 'R']) expect(exactColorsOf(k)).toBe('W');
    for (const k of ['WY', 'BG', 'OR']) expect(exactColorsOf(k)).toBe('WY');
    expect(exactColorsOf('BGORWY')).toBe('BGORWY');
    // 四色底在精确集无对应口径
    expect(exactColorsOf('BGOR')).toBe(null);
    expect(getExactCell('cross', 'unfixed', 'BGOR')).toBe(null);
  });

  it('单色底 6 个键取到的是同一份分布', () => {
    const w = getExactCell('cross', 'unfixed', 'W') as ExactFull;
    const y = getExactCell('cross', 'unfixed', 'Y') as ExactFull;
    expect(y).toBe(w);
  });

  it('不适用的槽位取不到数据(区别于「未计算」)', () => {
    // Cross 没有 F2L 槽的概念
    expect(isSlotApplicable('cross', 'fixed1')).toBe(false);
    expect(getExactCell('cross', 'fixed1', 'W')).toBe(null);
    // XCross 只解 1 个槽,谈不上相邻/对角
    expect(isSlotApplicable('xcross', 'adj')).toBe(false);
    // XXCross 要 2 个槽,谈不上固定单槽
    expect(isSlotApplicable('xxcross', 'fixed1')).toBe(false);
    expect(isSlotApplicable('xxcross', 'diag')).toBe(true);
  });

  it('SLOT_OK 覆盖全部阶段,且每档都真有数据', () => {
    for (const stage of EXACT_STAGES) {
      expect(SLOT_OK[stage].length).toBeGreaterThan(0);
      for (const slot of SLOT_OK[stage]) {
        expect(Object.keys(EXACT_DIST[stage][slot] ?? {}).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('格式化', () => {
  it('千分位按字符串切,不经过 Number', () => {
    expect(groupDigits('43252003274489856000')).toBe('43,252,003,274,489,856,000');
    expect(groupDigits('1')).toBe('1');
    expect(groupDigits('190080')).toBe('190,080');
  });

  it('大占比用定宽小数,小占比切科学计数', () => {
    expect(formatExactPct(0.511647)).toBe('51.1647%');
    expect(formatExactPct(0)).toBe('0%');
    expect(formatExactPct(1e-12)).toBe('1.00e-10%');
  });

  it('柱顶紧凑写法:一路带到 E,且不改变数量级', () => {
    expect(compactExact('1')).toBe('1');
    expect(compactExact('9809')).toBe('9809');
    expect(compactExact('46381')).toBe('46.3k');
    expect(compactExact('12836210229')).toBe('12.8B');
    expect(compactExact('980995276800')).toBe('980B');
    expect(compactExact('695280402432000')).toBe('695T');
    // 双色底 XCross 的两个极端 —— 只到 P 会写出「25284.7P」这种东西
    expect(compactExact('25284688565714070184')).toBe('25.2E');
    expect(compactExact('43252003274489856000')).toBe('43.2E');
  });

  it('紧凑写法与完整值同源 —— 位数不会错档', () => {
    eachCell((_s, _sl, _c, cell) => {
      const c = cell as ExactFull;
      if (c.kind !== 'full') return;
      for (const v of c.counts) {
        const compact = compactExact(v);
        // 反解出的量级必须与原字符串位数一致(容 1 位:紧凑保留 1~3 位整数)
        const m = /^([\d.]+)([kMBTPE]?)$/.exec(compact);
        expect(m).not.toBe(null);
        const exp = { '': 0, k: 3, M: 6, B: 9, T: 12, P: 15, E: 18 }[m![2]] ?? 0;
        const approx = Number(m![1]) * Math.pow(10, exp);
        expect(Math.abs(approx - Number(v)) / Number(v)).toBeLessThan(0.1);
      }
    });
  });
});

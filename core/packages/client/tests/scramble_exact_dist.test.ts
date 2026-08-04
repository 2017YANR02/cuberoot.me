import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EXACT_DIST, EXACT_STAGES, EXACT_STAGE_VARIANT, EXACT_VARIANT_STAGES, FRAME_NOTE, FRAME_STATES,
  SLOT_OK,
  compactExact, exactColorsOf, exactMean, exactRatio, exactRatios, formatExactPct, getExactCell,
  groupDigits, isColorFreeCell, isSlotApplicable,
  type ExactFull, type ExactStage,
} from '@/app/[lang]/scramble/stats/_data/exact_dist';
import { CUBE3_STATES, GOD_DIST_333, GOD_DIST_333_NORMALIZED } from '@/lib/god-distance-333';
import { EO_UI_STAGES, VARIANT_STAGES, uiVariantOf } from '@/lib/scramble-variants';
import {
  BLOCK123_HISTOGRAM, SQUARE122_HISTOGRAM, block222Histogram,
} from '@/lib/cross-trainer/block';
import { eoLineHistogram } from '@/lib/cross-trainer/eoline';
import { PAIR_HISTOGRAM, PSEUDO_PAIR_HISTOGRAM } from '@/lib/cross-trainer/pair';
import { PSEUDO_XCROSS_HISTOGRAM } from '@/lib/cross-trainer/multi';
import {
  EO_AXIS_STATES, EO_BEST_OF_2_HIST, EO_BEST_OF_3_HIST, EO_ONE_AXIS_HIST,
} from '@/lib/eo-axis-dist';

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
  // 格数 ≠ solver 那边的 dist_* bin 数:dist_xcross_{1col,2col}_0f 算出的
  // 0 步数已经是各自完整分布的 d=0 行(37,908,599 / 4,716,424,212,835),不另占格子;
  // 反过来 xxxxcross 单色底没有对应 bin,0 步平凡为 1,这里补上。
  // 13 个完整分布 = 9 个标准阶段 + 4 档伪十字(dist_cross_6col --pseudo × 四个色集)。
  // 四色底那 4 格没有对应 bin,0 步由 lib/skip-probability 的容斥现算 ——
  // 同一套代码把其余 12 个 0 步金标逐位复现,证明见 tests/skip_probability.test.ts。
  // 整解那一格是同一个对象挂在四个底色键上(最优解长度与底色无关),所以它记 4 格。
  // 2×2×3(E1)与 EO+XCross(E2)是 solver/src/bin/dist_tracked.rs 跑出来的,各占 1 格。
  // F2LEO 十字(E3)与伪 F2LEO 十字(P4)各两格:站内口径(两条 EO 轴取最短)+ 固定一条轴。
  // 都是 dist_tracked 在 EdgeSet 商空间上跑的,各 2.6s;两条站内口径那格与真题逐档对过。
  it('矩阵 50 格:36 个完整分布 + 14 个仅 0 步', () => {
    let full = 0, zero = 0;
    eachCell((_s, _sl, _c, cell) => {
      if ((cell as ExactFull).kind === 'full') full++; else zero++;
    });
    expect(full).toBe(36);
    expect(zero).toBe(14);
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

  // dist_cross_6col --faces LRFB:980,995,276,800 / Avg Depth 5.0194
  // 表格给的四色底 avg 是 5.019,这里是本机穷举复算出来的整条分布。
  it('四色底 Cross', () => {
    const c = EXACT_DIST.cross.unfixed!.BGOR as ExactFull;
    expect(c.total).toBe('980995276800');
    expect(c.counts).toEqual(['20635791', '309065792', '3241839115', '27981105637',
      '175574881766', '514537441534', '256994694935', '2335611639', '591']);
    expect(exactMean(c).toFixed(4)).toBe('5.0194');
  });

  // 色数越多,取 min 的选择越多,平均步数必须单调下降。四档一起验,
  // 免得哪天某一档被改错了还看不出来。
  it('单 > 双 > 四 > 六:平均步数随可选底色数单调下降', () => {
    const mean = (k: 'W' | 'WY' | 'BGOR' | 'BGORWY') =>
      exactMean(EXACT_DIST.cross.unfixed![k] as ExactFull);
    expect(mean('W').toFixed(4)).toBe('5.8121');
    expect(mean('WY').toFixed(4)).toBe('5.3872');
    expect(mean('BGOR').toFixed(4)).toBe('5.0194');
    expect(mean('BGORWY').toFixed(4)).toBe('4.8095');
    expect(mean('W') > mean('WY')).toBe(true);
    expect(mean('WY') > mean('BGOR')).toBe(true);
    expect(mean('BGOR') > mean('BGORWY')).toBe(true);
  });

  // 四色底与六色底共用整个 12 棱商空间(12!·2¹¹),分母同数不是抄错。
  it('四色底与六色底同分母,四色底逐档不优于六色底', () => {
    const q = EXACT_DIST.cross.unfixed!.BGOR as ExactFull;
    const s = EXACT_DIST.cross.unfixed!.BGORWY as ExactFull;
    expect(q.total).toBe(s.total);
    // 累积分布:六色底在每个深度都至少解出四色底那么多状态
    let cq = 0n, cs = 0n;
    for (let d = 0; d < q.counts.length; d++) {
      cq += BigInt(q.counts[d]);
      cs += BigInt(s.counts[d]);
      expect(`d=${d} ${cs >= cq}`).toBe(`d=${d} true`);
    }
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

/**
 * 伪十字(pseudo cross)—— dist_cross_6col --pseudo。目标集从「还原」放宽成
 * 「还原 / D / D' / D2」,其余(状态空间、编码、分母)与标准 Cross 逐字相同。
 *
 * 这四档没有 C++ 金标,可信度由三层证据撑:
 *   1. `--faces U --pseudo` = 5,160,960 × 一份独立 JS BFS(见 lib/cross-solver.ts 的
 *      PERM/ORI,190,080 态上跑出 4 48 440 3576 21492 74660 81780 8064 16);
 *   2. 与同分母的标准 Cross 逐档对比,必须严格更近(放宽目标集只会变近);
 *   3. 与站内 1,317,565 条 WCA 真题的经验分布逐档吻合(最大偏差 0.077 个百分点)。
 * 表格 https://bit.ly/3x3odds 给的 1 12 110 896 5399 19070 21913 2442 5 / avg 5.385933
 * 过不了第 3 层(最大偏差 0.98 个百分点),不采用。
 */
describe('伪十字精确分布', () => {
  const ps = (k: 'W' | 'WY' | 'BGOR' | 'BGORWY') =>
    EXACT_DIST.pseudo_cross.unfixed![k] as ExactFull;

  it('单色底 = 5,160,960 × 独立 JS BFS 的 190,080 态分布', () => {
    const c = ps('W');
    expect(c.total).toBe('980995276800');
    const JS_BFS = [4, 48, 440, 3576, 21492, 74660, 81780, 8064, 16];
    expect(JS_BFS.reduce((a, b) => a + b, 0)).toBe(190080);
    expect(c.counts).toEqual(JS_BFS.map((n) => String(BigInt(n) * 5160960n)));
    expect(exactMean(c).toFixed(5)).toBe('5.35659');
  });

  it('双色底 / 四色底 / 六色底', () => {
    expect(ps('WY').counts).toEqual(['41284608', '495194112', '4528035840', '36302346240',
      '203316470784', '514595773440', '220007574528', '1708548096', '49152']);
    expect(exactMean(ps('WY')).toFixed(5)).toBe('4.93041');

    expect(ps('BGOR').counts).toEqual(['82561551', '989639320', '9016537732', '70527627394',
      '342939567939', '501802189777', '55631618351', '5534736']);
    expect(exactMean(ps('BGOR')).toFixed(5)).toBe('4.53132');

    expect(ps('BGORWY').counts).toEqual(['123831014', '1483362354', '13467931869', '102912176921',
      '439912207732', '409964837408', '13130901687', '27815']);
    expect(exactMean(ps('BGORWY')).toFixed(5)).toBe('4.30727');
  });

  // 四色/六色底最深只到 7 步:8 步档恰好空。counts 末尾不补 0 —— 补了会让
  // 覆盖矩阵的「深度 ≤ N」多报一档。
  it('四色底与六色底 8 步档为空(最深 7 步)', () => {
    expect(ps('BGOR').counts.length).toBe(8);
    expect(ps('BGORWY').counts.length).toBe(8);
    expect(ps('W').counts.length).toBe(9);
    expect(ps('WY').counts.length).toBe(9);
  });

  it('与标准 Cross 同分母,且逐档严格更近(放宽目标集只会变近)', () => {
    for (const k of ['W', 'WY', 'BGOR', 'BGORWY'] as const) {
      const strict = EXACT_DIST.cross.unfixed![k] as ExactFull;
      const loose = ps(k);
      // 单/双色底的标准 Cross 走各自的子空间(分母 190,080 / 5,109,350,400),
      // 伪十字这四档一律落在 12!·2¹¹ 全空间上 —— 故按占比比,不按计数比。
      let cs = 0n, cl = 0n;
      const S = 10n ** 18n;
      for (let d = 0; d < Math.max(strict.counts.length, loose.counts.length); d++) {
        cs += BigInt(strict.counts[d] ?? '0');
        cl += BigInt(loose.counts[d] ?? '0');
        const rs = (cs * S) / BigInt(strict.total);
        const rl = (cl * S) / BigInt(loose.total);
        expect(`${k} d=${d} ${rl >= rs}`).toBe(`${k} d=${d} true`);
      }
      expect(`${k} ${exactMean(loose) < exactMean(strict)}`).toBe(`${k} true`);
    }
  });

  it('色数越多平均步数越低(与标准 Cross 同向)', () => {
    expect(exactMean(ps('W')) > exactMean(ps('WY'))).toBe(true);
    expect(exactMean(ps('WY')) > exactMean(ps('BGOR'))).toBe(true);
    expect(exactMean(ps('BGOR')) > exactMean(ps('BGORWY'))).toBe(true);
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

  it('整解那张理论表:1 / 4.3e19 也不能归零(定标到 1e14 会直接整除成 0)', () => {
    // /scramble/stats 的整解视图拿 cube20.org 的分布当理论对照,最小一档是 d=0 的单个态。
    const r = exactRatio('1', CUBE3_STATES);
    expect(r).toBeGreaterThan(0);
    expect(formatExactPct(r)).toBe('2.31e-18%');
    // 每一档都得画得出来,d=20 的 4.9 亿也不例外
    for (const b of GOD_DIST_333) expect(exactRatio(b.count, CUBE3_STATES)).toBeGreaterThan(0);
    // 归一化那份是完整分布的形状:各档占比加起来正好 1
    const sum = GOD_DIST_333_NORMALIZED.reduce((a, c) => a + exactRatio(c, CUBE3_STATES), 0);
    expect(sum).toBeCloseTo(1, 12);
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
    // 四色底 = 去掉一对相对色,三种取法折到同一份(见下面那条对称性回归)
    for (const k of ['BGOR', 'ORWY', 'BGWY']) expect(exactColorsOf(k)).toBe('BGOR');
    expect(exactColorsOf('BGORWY')).toBe('BGORWY');
    // 长度不是 1/2/4/6 的键没有对应口径
    expect(exactColorsOf('BGO')).toBe(null);
    expect(getExactCell('cross', 'unfixed', 'BGO')).toBe(null);
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

  // 菜单与 WCA 那套逐项相同,所以绝大多数格子还没算 —— 那些格子必须**说得出话**:
  // 要么有数据,要么是一条写清楚了可行性与卡点的 todo。空着不算数。
  it('每个适用的格子都取得到东西:有数据,或一条说得清楚的 todo', () => {
    for (const stage of EXACT_STAGES) {
      expect(SLOT_OK[stage].length, stage).toBeGreaterThan(0);
      for (const slot of SLOT_OK[stage]) {
        for (const colors of ['W', 'WY', 'BGOR', 'BGORWY']) {
          const cell = getExactCell(stage, slot, colors);
          expect(cell, `${stage}/${slot}/${colors}`).not.toBe(null);
          if (cell!.kind !== 'todo') continue;
          expect(cell!.note.zh.length, `${stage}/${slot}/${colors} zh`).toBeGreaterThan(4);
          expect(cell!.note.en.length, `${stage}/${slot}/${colors} en`).toBeGreaterThan(4);
          // 「待跑」是有承诺的一档:必须指得出跟踪文档里的单元号。
          if (cell!.feasible === 'ready') expect(cell!.unit, `${stage}/${slot}/${colors}`).toBeTruthy();
        }
      }
    }
  });

  // 帧 = (面, 槽/轴/块)。钉死一个帧就把底面一并钉死了 —— 底色档在这一档下不成立,
  // 四档取到的必须是同一个对象。这条曾经不成立:数据只挂在 W 上,而查表照样按底色档索引,
  // 于是 222 定块这种早就穷举完的曲线,一切到双色底就显示成「还没写」。
  it('固定帧不分底色:四档底色取到同一个对象', () => {
    const TIERS = ['W', 'WY', 'BGOR', 'BGORWY'];
    let checked = 0;
    for (const stage of EXACT_STAGES) {
      for (const slot of SLOT_OK[stage]) {
        if (slot === 'unfixed') continue;
        expect(isColorFreeCell(stage, slot), `${stage}/${slot}`).toBe(true);
        // 有数据的格是同一个对象;还没算的格每次现造一条 todo,故比内容
        const base = getExactCell(stage, slot, 'W');
        for (const t of TIERS) {
          expect(getExactCell(stage, slot, t), `${stage}/${slot}/${t}`).toStrictEqual(base);
        }
        checked++;
      }
    }
    // 固定帧共 36 格(22 个 fixed1 + 7 个阶段各一对 adj/diag),其中 16 格已有完整曲线。
    // 修好之前那些格子各有 3 档底色够不着,48 个早就算完的组合被显示成「还没写」。
    expect(checked).toBe(36);
  });

  it('固定帧的数据只存一份(存储键恒为 W)', () => {
    eachCell((stage, slot, colors) => {
      if (slot === 'unfixed') return;
      expect(colors, `${stage}/${slot}`).toBe('W');
    });
  });

  it('222 定块四档底色都拿得到那条 253,440 的曲线', () => {
    for (const t of ['W', 'WY', 'BGOR', 'BGORWY']) {
      const cell = getExactCell('block222', 'fixed1', t) as ExactFull;
      expect(cell.kind, t).toBe('full');
      expect(cell.total, t).toBe('253440');
    }
  });

  it('取最优帧仍然分底色:底色档一变,曲线就得变', () => {
    expect(isColorFreeCell('cross', 'unfixed')).toBe(false);
    const w = getExactCell('cross', 'unfixed', 'W') as ExactFull;
    const wy = getExactCell('cross', 'unfixed', 'WY') as ExactFull;
    expect(wy).not.toBe(w);
    // 整解是唯一一个「取最优帧」也不分底色的阶段(最优解长度与底面无关)
    expect(isColorFreeCell('333', 'unfixed')).toBe(true);
  });

  // 中文标签只有「固定」两个字(不写「帧」,会与视频帧读岔),固定的是什么全靠 FRAME_NOTE
  // 补在括号里 —— 漏一条,下拉里就出现一个没有宾语的「固定」。
  it('固定那一档都写明了固定的是什么', () => {
    for (const stage of EXACT_STAGES) {
      if (!SLOT_OK[stage].includes('fixed1')) continue;
      expect(FRAME_NOTE[stage], stage).toBeTruthy();
      expect(FRAME_STATES[stage], stage).toMatch(/^\d+$/);
    }
  });
});

/**
 * 菜单必须和 WCA 那套**逐项相同** —— 用户看到的两个下拉是同一套词表,只是数据来源不同。
 * 真源是 stats/scramble/distribution.json 的 sets.wca.variants;这里逐键逐项对,
 * 顺序也对。管道加了新变体 / 新阶段而精确集没跟上,这条当场红。
 */
describe('菜单与 WCA 数据集逐项相同', () => {
  const STATS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../stats/scramble');
  const wca = JSON.parse(readFileSync(path.join(STATS, 'distribution.json'), 'utf-8'))
    .sets.wca.variants as Record<string, { stages: string[] }>;

  it('变体键集合相同', () => {
    expect(Object.keys(EXACT_VARIANT_STAGES).sort()).toEqual(Object.keys(wca).sort());
  });

  it('每个变体的阶段序相同', () => {
    for (const v of Object.keys(wca)) {
      expect(EXACT_VARIANT_STAGES[v], v).toEqual(wca[v].stages);
    }
  });

  it('展平后的阶段表就是矩阵的行,一个不多一个不少', () => {
    const flat = Object.values(wca).flatMap((v) => v.stages).sort();
    expect([...EXACT_STAGES].sort()).toEqual(flat);
    expect(EXACT_STAGES.length).toBe(39);
    // 每个阶段都得知道自己属于哪个变体(矩阵分组 + 深链的 variant 参数)
    for (const st of EXACT_STAGES) expect(EXACT_STAGE_VARIANT[st], st).toBeTruthy();
  });

  it('展开序让同一个 UI 方法连成一段(矩阵靠它合并方法列)', () => {
    const seen = new Set<string>();
    let prev = '';
    for (const st of EXACT_STAGES) {
      const v = uiVariantOf(EXACT_STAGE_VARIANT[st]);
      if (v === prev) continue;
      expect(seen.has(v), `${v} 被拆成了两段`).toBe(false);
      seen.add(v);
      prev = v;
    }
    // 10 个方法 = 截图里那份下拉
    expect(seen.size).toBe(10);
  });

  it('砖 / EO 两个聚合方法的阶段序与阶段下拉一致', () => {
    const stagesOf = (ui: string) => EXACT_STAGES.filter((s) => uiVariantOf(EXACT_STAGE_VARIANT[s]) === ui);
    expect(stagesOf('block')).toEqual(VARIANT_STAGES.block);
    expect(stagesOf('eo')).toEqual(EO_UI_STAGES);
  });

  /**
   * 「取最优帧」那几格与真题同口径,所以两条曲线必须逐档贴着走。这不是风格检查:
   * F2LEO 十字那格的口径要是搞错了(比如固定一条 EO 轴、而真题那列对两条取最短),
   * 均值会差 0.27 步、逐档差好几个百分点 —— 一眼看不出来,这条能。
   *
   * 阈值 0.08 个百分点。实测:F2LEO 十字 0.027、单色底十字 0.019、六色底十字 0.0706
   * (最后这个就是文件头注里那句「实测最大逐档偏差 0.07 个百分点」的出处)。n = 131.8 万、
   * 最大那档占 50% 时采样标准差约 0.04 个百分点,所以 0.08 就是噪声底上方一点点 ——
   * 口径搞错的差是**几个百分点**量级,这个阈值照样一眼逮住。
   */
  const wcaData = JSON.parse(readFileSync(path.join(STATS, 'distribution.json'), 'utf-8'))
    .sets.wca.variants as Record<string, { data: Record<string, Record<string, { counts: Record<string, number> }>> }>;

  it.each([
    ['std', 'cross', 'W'],
    ['std', 'cross', 'BGORWY'],
    ['f2leo', 'f2leo_cross', 'W'],
    ['pseudo_f2leo', 'pseudo_f2leo_cross', 'W'],
  ])('%s/%s/%s:穷举与真题逐档贴合', (variant, stage, colors) => {
    const cell = getExactCell(stage, 'unfixed', colors) as ExactFull;
    expect(cell.kind).toBe('full');
    const emp = wcaData[variant].data[stage][colors].counts;
    const n = Object.values(emp).reduce((a, b) => a + b, 0);
    expect(n).toBeGreaterThan(1_000_000);
    const total = BigInt(cell.total);
    let worst = 0;
    for (let d = 0; d < cell.counts.length; d++) {
      // 分子先放大再除,避免 5e9 分母上的整数除法把小档抹成 0
      const theory = Number((BigInt(cell.counts[d]) * 1_000_000_000n) / total) / 1e7;
      const real = (emp[String(d)] ?? 0) / n * 100;
      worst = Math.max(worst, Math.abs(theory - real));
    }
    expect(worst, `${stage}/${colors} 最大逐档偏差 ${worst.toFixed(4)} 个百分点`).toBeLessThan(0.08);
  });
});

/**
 * 这一批格子不是从 solver 的 GOLDEN 抄来的,而是站内自己算的 —— 所以每一格都必须**指回它的
 * 计算源**,而不是各留一份数字。源本身由各自的测试每次重算(cross_trainer_tracked /
 * eo_axis_dist / cross_trainer_pair 的 PAIR_FULL_BFS / cross_trainer_multi 的 PX_FULL_BFS)。
 */
describe('站内自算的格子:与计算源同一个数', () => {
  const full = (stage: string, slot: string) => getExactCell(stage, slot, 'W') as ExactFull;
  const nums = (c: ExactFull) => c.counts.map(Number);

  it('纯 EO 三档:固定轴 / 两轴取最优 / 三轴取最优', () => {
    expect(nums(full('eo', 'fixed1'))).toEqual([...EO_ONE_AXIS_HIST]);
    expect(full('eo', 'fixed1').total).toBe('2048');

    for (const k of ['W', 'WY']) {
      const c = getExactCell('eo', 'unfixed', k) as ExactFull;
      expect(nums(c), k).toEqual([...EO_BEST_OF_2_HIST]);
      expect(c.total).toBe(String(EO_AXIS_STATES));
    }
    for (const k of ['BGOR', 'BGORWY']) {
      const c = getExactCell('eo', 'unfixed', k) as ExactFull;
      expect(nums(c), k).toEqual([...EO_BEST_OF_3_HIST]);
    }
    // 轴越多越浅,但直径都是 7 —— 三档一起看才说明白「多给轴只是让深档变稀有」
    expect(exactMean(full('eo', 'fixed1')) > exactMean(getExactCell('eo', 'unfixed', 'W') as ExactFull)).toBe(true);
    expect(exactMean(getExactCell('eo', 'unfixed', 'W') as ExactFull)
      > exactMean(getExactCell('eo', 'unfixed', 'BGOR') as ExactFull)).toBe(true);
    expect(full('eo', 'fixed1').counts.length).toBe(8);
    expect((getExactCell('eo', 'unfixed', 'BGORWY') as ExactFull).counts.length).toBe(8);
  });

  it('EOLine / 222 / 122 / 123 = 各自那台整表 BFS', () => {
    expect(nums(full('eoline', 'fixed1'))).toEqual(eoLineHistogram());
    expect(nums(full('block222', 'fixed1'))).toEqual(block222Histogram());
    expect(nums(full('fbsquare', 'fixed1'))).toEqual([...SQUARE122_HISTOGRAM]);
    expect(nums(full('rouxs1', 'fixed1'))).toEqual([...BLOCK123_HISTOGRAM]);
  });

  it('基态 / 伪基态 / 伪 XCross 定槽 = 72,990,720 全表 BFS', () => {
    expect(nums(full('cross_pair', 'fixed1'))).toEqual([...PAIR_HISTOGRAM]);
    expect(nums(full('pseudo_cross_pseudo_pair', 'fixed1'))).toEqual([...PSEUDO_PAIR_HISTOGRAM]);
    expect(nums(full('pseudo_xcross', 'fixed1'))).toEqual([...PSEUDO_XCROSS_HISTOGRAM]);
    for (const s of ['cross_pair', 'pseudo_cross_pseudo_pair', 'pseudo_xcross', 'xcross']) {
      expect(full(s, 'fixed1').total, s).toBe('72990720');
    }
    // 放宽目标集只会变近:同一个坐标上,伪基态 ≤ 基态、伪 XCross ≤ XCross(按均值)
    expect(exactMean(full('pseudo_cross_pseudo_pair', 'fixed1')) < exactMean(full('cross_pair', 'fixed1'))).toBe(true);
    expect(exactMean(full('pseudo_xcross', 'fixed1')) < exactMean(full('xcross', 'fixed1'))).toBe(true);
  });

  it('整体那一格 = cube20.org 的归一化分布,且标了「不是全穷举」', () => {
    const c = getExactCell('333', 'unfixed', 'BGORWY') as ExactFull;
    expect(c.total).toBe(CUBE3_STATES);
    expect(c.counts).toEqual([...GOD_DIST_333_NORMALIZED]);
    expect(c.caveat).toBeTruthy();
    // 与底色无关:四档取到的是同一个对象
    expect(getExactCell('333', 'unfixed', 'W')).toBe(c);
    expect(getExactCell('333', 'unfixed', 'BGOR')).toBe(c);
    expect(exactMean(c).toFixed(2)).toBe('17.70');
  });

  // 2×2×3 与 EO+XCross 这两条曲线出自 Rust(solver/src/bin/dist_tracked.rs),TS 这边没法
  // 现算复核。能查的是「加约束只会变难」:大问题投影到小问题上,每个小态的原像数一样多,
  // 所以大问题的累积分布逐档不高于小问题。抄错一位数几乎必然违反它。
  const cumNotAbove = (big: ExactFull, small: ExactFull, label: string) => {
    const tb = BigInt(big.total), ts = BigInt(small.total);
    let cb = 0n, cs = 0n;
    const n = Math.max(big.counts.length, small.counts.length);
    for (let d = 0; d < n; d++) {
      cb += BigInt(big.counts[d] ?? '0');
      cs += BigInt(small.counts[d] ?? '0');
      expect(cb * ts <= cs * tb, `${label} d=${d}`).toBe(true);
    }
  };

  it('2×2×3 / EO+XCross:比自己包住的子问题逐档更难', () => {
    cumNotAbove(full('block223', 'fixed1'), full('rouxs1', 'fixed1'), '223 ⊃ 123');
    cumNotAbove(full('eo_xcross', 'fixed1'), full('eo_cross', 'fixed1'), 'EOXCross ⊃ EOCross');
    cumNotAbove(full('eo_xcross', 'fixed1'), full('xcross', 'fixed1'), 'EOXCross ⊃ XCross');
    // 同一台 Rust 引擎在同一次运行里复现的五条已知曲线之一(xcross),口径没跑偏的旁证
    expect(full('xcross', 'fixed1').total).toBe('72990720');
  });

  // F2LEO 十字:十字解好 + 中层四棱朝向好。夹在两个已知曲线中间 ——
  // 比十字严(多了四条棱的朝向门),比 EOCross 松(EOCross 要全部 12 条都朝向好)。
  it('F2LEO 十字:比十字难,比 EOCross 易', () => {
    cumNotAbove(full('f2leo_cross', 'fixed1'), full('cross', 'unfixed'), 'F2LEO十字 ⊃ 十字');
    cumNotAbove(full('eo_cross', 'fixed1'), full('f2leo_cross', 'fixed1'), 'EOCross ⊃ F2LEO十字');
    // 两条轴取最短只会更浅:同一个坐标、目标集大一倍
    cumNotAbove(full('f2leo_cross', 'fixed1'), full('f2leo_cross', 'unfixed'), '固定轴 ⊃ 两轴取最短');
    // 商掉四条中层棱的 4! 种贴法之后再乘回来 —— 分母必须回到坐标空间那个数
    expect(full('f2leo_cross', 'unfixed').total).toBe(FRAME_STATES.f2leo_cross);
    expect(exactMean(full('f2leo_cross', 'unfixed')).toFixed(4)).toBe('6.4946');
    expect(exactMean(full('f2leo_cross', 'fixed1')).toFixed(4)).toBe('6.7682');
  });

  // 伪 = 目标集放宽成「底十字拼好即可,绕 D 轴偏一格不算错」,只会更近。
  it('伪 F2LEO 十字:逐档比标准版更浅', () => {
    cumNotAbove(full('f2leo_cross', 'unfixed'), full('pseudo_f2leo_cross', 'unfixed'), '标准 ⊃ 伪(两轴)');
    cumNotAbove(full('f2leo_cross', 'fixed1'), full('pseudo_f2leo_cross', 'fixed1'), '标准 ⊃ 伪(定轴)');
    cumNotAbove(full('pseudo_f2leo_cross', 'fixed1'), full('pseudo_f2leo_cross', 'unfixed'), '定轴 ⊃ 两轴');
    // 0 步 = 目标集大小:四个 D 偏移 × 两条轴,标准版那格恰好是它的 1/4
    expect(Number(full('pseudo_f2leo_cross', 'unfixed').counts[0]))
      .toBe(Number(full('f2leo_cross', 'unfixed').counts[0]) * 4);
    expect(exactMean(full('pseudo_f2leo_cross', 'unfixed')).toFixed(4)).toBe('6.0387');
  });

  it('固定单帧那几格的 total 就是它的坐标空间', () => {
    for (const stage of EXACT_STAGES) {
      const cell = EXACT_DIST[stage].fixed1?.W;
      if (!cell || cell.kind !== 'full') continue;
      expect(cell.total, stage).toBe(FRAME_STATES[stage]);
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

/**
 * 上游 `3x3.xlsx` 的 `stat` 页是一张 4 档底色 × 5 个阶段的**平均步数**表。
 * 它与本站精确集有五格重叠 —— 那五格必须逐位对上(对上了才有资格把剩下几格的均值
 * 当参考值搬进来,见 `ExactZeroOnly.refMean`)。
 */
describe('对上游 stat 页的平均步数', () => {
  const meanOf = (stage: ExactStage, slot: string, colors: string): number => {
    const cell = (EXACT_DIST[stage] as Record<string, Record<string, unknown>>)[slot][colors];
    return exactMean(cell as ExactFull);
  };

  // `exactMean` 只到 6 位小数(BigInt 定点截断),表格十字那三档给到 9 位 ——
  // 允许的偏差就是截断本身,1e-6。其余格子表格只给两位,允许半个末位 0.005。
  it.each([
    ['cross', 'unfixed', 'W', 5.812058081, 1e-6],
    ['cross', 'unfixed', 'WY', 5.387206484, 1e-6],
    ['cross', 'unfixed', 'BGORWY', 4.809458647, 1e-6],
    ['xcross', 'unfixed', 'W', 7.35, 0.005],
    ['xcross', 'unfixed', 'WY', 6.99, 0.005],
    ['xxcross', 'adj', 'W', 9.96, 0.005],
    ['xxcross', 'diag', 'W', 9.95, 0.005],
  ])('%s/%s/%s 的均值与表格一致', (stage, slot, colors, sheet, tol) => {
    const ours = meanOf(stage as ExactStage, slot as string, colors as string);
    expect(Math.abs(ours - (sheet as number))).toBeLessThan(tol as number);
  });

  // 唯一对不上的一格:固定 BL 槽的 XCross。精确均值 7.975721,四舍五入应是 7.98,
  // 表格写 7.97。同一张表其余七格都在半个末位以内,所以这一格是它自己少进了一位,
  // 不是我们算错 —— 分布本身与 C++ 金标逐位一致(见上面的「对齐 C++ 金标」)。
  it('固定槽 XCross:表格的 7.97 比正确的舍入低一个末位', () => {
    const ours = meanOf('xcross', 'fixed1', 'W');
    expect(ours).toBeCloseTo(7.975721, 6);
    expect(Number(ours.toFixed(2))).toBe(7.98);
    expect(Math.abs(ours - 7.97)).toBeGreaterThan(0.005);
  });

  it('搬来的参考均值只挂在算不动的格子上,而且方向必须对', () => {
    const refs: Array<[ExactStage, string, number]> = [];
    eachCell((stage, slot, colors, cell) => {
      const c = cell as { kind: string; refMean?: number };
      if (c.refMean === undefined) return;
      expect(c.kind).toBe('zero');            // 自己能算的格子不许再挂搬运值
      expect(slot).toBe('unfixed');
      refs.push([stage, colors, c.refMean]);
    });
    expect(refs.length).toBe(7);

    // 底色越多越好解:单色 > 双色 > 六色。前两档能算的就用算的,算不动的用参考值。
    for (const stage of ['xcross', 'xxcross', 'xxxcross'] as ExactStage[]) {
      const at = (colors: string): number => {
        const cell = (EXACT_DIST[stage] as Record<string, Record<string, unknown>>)
          .unfixed[colors] as { kind: string; refMean?: number };
        return cell.kind === 'full' ? exactMean(cell as unknown as ExactFull) : cell.refMean!;
      };
      expect(at('W')).toBeGreaterThan(at('WY'));
      expect(at('WY')).toBeGreaterThan(at('BGORWY'));
    }

    // 阶段越靠后越难:同一档底色下 XCross < XXCross < XXXCross
    for (const colors of ['W', 'WY', 'BGORWY']) {
      const at = (stage: ExactStage): number => {
        const cell = (EXACT_DIST[stage] as Record<string, Record<string, unknown>>)
          .unfixed[colors] as { kind: string; refMean?: number };
        return cell.kind === 'full' ? exactMean(cell as unknown as ExactFull) : cell.refMean!;
      };
      expect(at('xcross')).toBeLessThan(at('xxcross'));
      expect(at('xxcross')).toBeLessThan(at('xxxcross'));
    }

    // 固定槽只会更难:同为单色底,固定 BL 槽的 XCross 比四槽取 min 慢
    expect(meanOf('xcross', 'fixed1', 'W')).toBeGreaterThan(meanOf('xcross', 'unfixed', 'W'));
    expect(meanOf('xxcross', 'adj', 'W')).toBeGreaterThan(
      (EXACT_DIST.xxcross.unfixed!.W as { refMean?: number }).refMean!,
    );
  });
});

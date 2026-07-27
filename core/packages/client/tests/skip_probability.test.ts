import { describe, expect, it } from 'vitest';
import {
  AUF, BOTTOM_FACES, LL_CO, LL_EO, LL_PERM, LL_UNIVERSE, SKIP_ENTRIES,
  atLeastKInRound, blockEdges, cornersOnFace, crossEdges, entryById,
  oneOver, oneOverRelative, probability, statesWithAnyCrossSolved,
  statesWithAnyXCrossSolved, statesWithSolved,
} from '@/lib/skip-probability';
import { CUBE3_STATES } from '@/lib/god-distance-333';
import { CORNER_FACELET, EDGE_FACELET } from '@/app/[lang]/scramble/solver/facelet';
import { EXACT_DIST, type ExactFull } from '@/app/[lang]/scramble/stats/_data/exact_dist';

/**
 * 跳步概率的回归锁。这批数字全部**现算**,所以测试锁的是「算出来的东西对不对」,
 * 而不是「有没有人手抖改了小数」。
 *
 * 最关键的一条在最下面:同一套容斥代码,拿 solver 独立算出的四档十字金标验过 ——
 * 十字对得上,才敢信它算 2×2×2 块(那一族没有金标)。
 */

const G = BigInt(CUBE3_STATES);

describe('块邻接表', () => {
  // lib 里的邻接是按块名(URF / UR)推的;这里用 facelet 表把它核一遍,免得名字写错了没人知道
  it('与 facelet 表推出的邻接一致', () => {
    const NAMES_C = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
    const NAMES_E = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
    const cFaces = CORNER_FACELET.map((fs) => new Set(fs.map((f) => Math.floor(f / 9))));
    const eFaces = EDGE_FACELET.map((fs) => fs.map((f) => Math.floor(f / 9)));
    NAMES_C.forEach((cn, ci) => {
      const fromFacelet = NAMES_E.filter((_, ei) => eFaces[ei].every((f) => cFaces[ci].has(f)));
      expect(`${cn}: ${blockEdges(cn).join(',')}`).toBe(`${cn}: ${fromFacelet.join(',')}`);
    });
  });

  it('每个 2×2×2 块正好 3 条棱,每个十字正好 4 条棱', () => {
    for (const c of ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB']) {
      expect(blockEdges(c).length).toBe(3);
    }
    for (const f of ['U', 'D', 'L', 'R', 'F', 'B']) expect(crossEdges(f).length).toBe(4);
  });

  it('一个面上 4 个角,相邻两块共用 1 条棱', () => {
    const u = cornersOnFace('U');
    expect(u).toEqual(['URF', 'UFL', 'ULB', 'UBR']);
    // URF 与 UFL 同在 U、F 两面 → 共用 UF
    const shared = blockEdges('URF').filter((e) => blockEdges('UFL').includes(e));
    expect(shared).toEqual(['UF']);
    // URF 与 ULB 是面对角 → 不共用
    expect(blockEdges('URF').filter((e) => blockEdges('ULB').includes(e))).toEqual([]);
  });
});

describe('计数公式', () => {
  it('什么都不固定就是整个群', () => {
    expect(statesWithSolved([], [])).toBe(G);
  });

  it('固定 1 角 + 它的 3 条棱 = 1/253,440', () => {
    expect(G / statesWithSolved(['URF'], blockEdges('URF'))).toBe(253440n);
  });

  it('固定 4 条同面棱 = 1/190,080', () => {
    expect(G / statesWithSolved([], crossEdges('U'))).toBe(190080n);
  });
});

/**
 * 容斥的正确性证明:四档十字的 0 步状态数,solver 那边是用完全不同的路子算的
 * (子空间 BFS / 495×495 mask 容斥 / 全空间 AVX2 min-reduction),已逐位对齐 C++ 金标并
 * 落在 exact_dist.ts。本文件的通用容斥必须与它们**分数相等**(交叉相乘比,不比浮点)。
 */
describe('拿十字金标验容斥', () => {
  it.each([
    ['单色底', ['U'], 'W'],
    ['双色底', ['U', 'D'], 'WY'],
    ['四色底', ['L', 'R', 'F', 'B'], 'BGOR'],
    ['六色底', ['U', 'D', 'L', 'R', 'F', 'B'], 'BGORWY'],
  ] as const)('%s 十字 0 步', (_label, faces, key) => {
    const mine = statesWithAnyCrossSolved([...faces]);
    const cell = EXACT_DIST.cross.unfixed![key] as ExactFull;
    // exact_dist 的计数活在它自己的分母上,换算成全群要交叉相乘
    expect(mine * BigInt(cell.total)).toBe(BigInt(cell.counts[0]) * G);
  });
});

/**
 * 同一套容斥再往前推一步:精确集里**每一个** 0 步计数都由它复算一遍。
 *
 * 那 12 个金标分别出自 5 个不同的 Rust bin(dist_cross_{1,2,6}col、dist_xcross_{1,2}col、
 * dist_xcross_6col_0f、dist_xxcross_{1,2,6}col_0f、dist_xxxcross_*_0f、dist_xxxxcross_*_0f),
 * 算法各不相同。全部逐位复现之后,才敢让同一套代码去补四色底那 4 格 —— 那 4 格没有 bin。
 */
describe('拿精确集的 0 步金标验容斥(全 16 格)', () => {
  // 「仅 0 步」格不带 total,分母按底色档定:单色底固定了底面,只有 4 十字棱 + 4 中层棱
  // + 4 个该面角有意义,商掉整个顶层 → |G|/62,208;多色底哪个块都可能参与,分母就是 |G|。
  const denOf = (colors: string): bigint => (colors === 'W' ? G / 62208n : G);

  it.each([
    ['xcross', 1], ['xxcross', 2], ['xxxcross', 3], ['xxxxcross', 4],
  ] as const)('%s 四档底色', (stage, k) => {
    for (const colors of ['W', 'WY', 'BGOR', 'BGORWY'] as const) {
      const cell = EXACT_DIST[stage].unfixed![colors]!;
      const golden = cell.kind === 'full' ? cell.counts[0] : cell.zero;
      const den = cell.kind === 'full' ? BigInt(cell.total) : denOf(colors);
      const mine = statesWithAnyXCrossSolved(BOTTOM_FACES[colors], k);
      // 交叉相乘比分数,不比浮点
      expect(`${stage}/${colors}=${mine * den}`).toBe(`${stage}/${colors}=${BigInt(golden) * G}`);
    }
  });

  // 速查表的 CN 四条与覆盖矩阵的六色底 0 步必须是同一个数,否则同一件事站上有两种说法
  it('速查表的 CN 四条 = 覆盖矩阵的六色底 0 步', () => {
    for (const [k, stage] of [[1, 'xcross'], [2, 'xxcross'], [3, 'xxxcross'], [4, 'xxxxcross']] as const) {
      const cell = EXACT_DIST[stage].unfixed!.BGORWY!;
      const golden = cell.kind === 'full' ? cell.counts[0] : cell.zero;
      expect(`${stage}=${entryById(`xcross${k}-cn`).num}`).toBe(`${stage}=${golden}`);
    }
  });

  it('四色底那 4 格夹在双色底与六色底之间', () => {
    for (const stage of ['xcross', 'xxcross', 'xxxcross', 'xxxxcross'] as const) {
      const z = (c: 'WY' | 'BGOR' | 'BGORWY') => {
        const cell = EXACT_DIST[stage].unfixed![c]!;
        return BigInt(cell.kind === 'full' ? cell.counts[0] : cell.zero);
      };
      // 同一个分母(多色底都是 |G|),可以直接比大小
      expect(`${stage}: ${z('WY') < z('BGOR')} ${z('BGOR') < z('BGORWY')}`).toBe(`${stage}: true true`);
    }
  });

  // 容斥不是「面数 × 单色底」:目标之间共用块,重叠会把总数压下来一点点。
  // 越深的阶段重叠越小(四槽全好的两个底色几乎不可能同时发生),比值就越贴近整数倍。
  it('六色底 ≠ 3 × 双色底,但差得很少 —— 重叠项的量级看得见', () => {
    const zero = (stage: 'xxxxcross', c: 'WY' | 'BGORWY') =>
      BigInt((EXACT_DIST[stage].unfixed![c] as { zero: string }).zero);
    expect(zero('xxxxcross', 'WY') * 3n).toBe(373245n);
    expect(zero('xxxxcross', 'BGORWY')).toBe(373219n); // 少 26 = 重叠
  });
});

describe('顶层全集', () => {
  it('62,208 = 3³ · 2³ · 4!·4!/2', () => {
    expect(LL_CO).toBe(27);
    expect(LL_EO).toBe(8);
    expect(LL_PERM).toBe(288);
    expect(LL_UNIVERSE).toBe(62208);
    expect(AUF).toBe(4);
  });

  it.each([
    ['eo', 8],
    ['oll', 216],
    ['pll', 72],
    ['coll', 162],
    ['ll', 15552],
    ['lll1', 3888],
  ])('%s = 1/%i', (id, denom) => {
    expect(oneOver(entryById(id))).toBe(denom);
  });

  // OLL 是 3³·2³ 而不是「3³·2⁴/4」—— 站内曾经写过后者,算出来是 108,差一倍
  it('OLL 分母来自 3³·2³,不是 3³·2⁴/4', () => {
    expect(LL_CO * LL_EO).toBe(216);
    expect((27 * 16) / 4).not.toBe(216);
  });

  it('LL 连跳 = OLL × PLL', () => {
    expect(oneOver(entryById('ll'))).toBe(oneOver(entryById('oll')) * oneOver(entryById('pll')));
  });
});

describe('十字与 2×2×2 块', () => {
  it.each([
    ['xcross-fixed1', 72990720],
    ['xcross-fixed', 18340968.032926],
    ['xcross-dual', 9170507.427382],
    ['cross-fixed', 190080],
    ['cross-dual', 95041.76789],
    ['cross-cn', 31703.943492],
    ['block222-fixed', 253440],
    ['block222-face', 63370.848739],
    ['block222-cn', 31688.602055],
  ])('%s ≈ 1/%f', (id, denom) => {
    expect(oneOver(entryById(id))).toBeCloseTo(denom, 5);
  });

  // 表格 https://bit.ly/cubeodds 的 CN 222 给到小数点后 11 位,与本机容斥逐位吻合 ——
  // 那一条不是模拟值,是精确算出来的。反过来也确认了本文件的容斥。
  it('CN 2×2×2 与表格公布值一致到 10 位有效数字', () => {
    expect(oneOver(entryById('block222-cn'))).toBeCloseTo(31688.60205470051, 6);
  });

  // 底色越多越容易跳,但「双色底 2×2×2」= CN:一对相对面已经覆盖全部 8 个角
  it('十字四档单调,2×2×2 只有 1 / 4 / 8 角三档', () => {
    expect(oneOver(entryById('cross-fixed'))).toBeGreaterThan(oneOver(entryById('cross-dual')));
    expect(oneOver(entryById('cross-dual'))).toBeGreaterThan(oneOver(entryById('cross-cn')));
    expect(cornersOnFace('U').length).toBe(4);
    // 一对相对面的角并集 = 全部 8 个
    const dual = new Set([...cornersOnFace('U'), ...cornersOnFace('D')]);
    expect(dual.size).toBe(8);
  });

  it('CN 十字比 CN 2×2×2 略难 —— 十字要 4 条棱,块要 1 角 3 棱', () => {
    expect(oneOver(entryById('cross-cn'))).toBeGreaterThan(oneOver(entryById('block222-cn')));
  });

  // 固定槽 XCross 的绝对概率 = exact_dist 里那个 72,990,720 状态空间的倒数
  it('固定槽 XCross = 1/72,990,720,与 exact_dist 的状态空间同数', () => {
    expect(oneOver(entryById('xcross-fixed1'))).toBe(72990720);
    expect((EXACT_DIST.xcross.fixed1!.W as ExactFull).total).toBe('72990720');
  });

  // 任一槽 XCross 的 0 步计数,solver 端是独立算的 —— 分数必须相等
  it('任一槽 XCross 0 步与 solver 金标分数相等', () => {
    const mine = statesWithAnyXCrossSolved(['U']);
    const cell = EXACT_DIST.xcross.unfixed!.W as ExactFull;
    expect(mine * BigInt(cell.total)).toBe(BigInt(cell.counts[0]) * G);
  });

  /**
   * 「自然 X-cross」大家引用的是**相对十字**的条件概率 1/96.49,不是绝对的 1/1834 万。
   * 站内 method_dna 曾写 1/16,差了 6 倍;表格给的 96.490783 与本机现算逐位一致。
   */
  it('XCross 相对十字 = 1/96.490783,不是 1/16', () => {
    expect(oneOverRelative(entryById('xcross-fixed'))!).toBeCloseTo(96.490783, 6);
    expect(oneOverRelative(entryById('xcross-fixed'))!).not.toBeCloseTo(16, 0);
    // 双色底几乎同值 —— 十字与 XCross 一起变容易,比值基本不动
    expect(oneOverRelative(entryById('xcross-dual'))!).toBeCloseTo(96.489234, 5);
  });

  it('没有 relativeTo 的条目不报条件列', () => {
    expect(oneOverRelative(entryById('cross-fixed'))).toBe(null);
  });
});

describe('条目自洽', () => {
  it('id 唯一,分子分母都是十进制串且分子 ≥ 1', () => {
    expect(new Set(SKIP_ENTRIES.map((e) => e.id)).size).toBe(SKIP_ENTRIES.length);
    for (const e of SKIP_ENTRIES) {
      expect(e.num).toMatch(/^\d+$/);
      expect(e.den).toMatch(/^\d+$/);
      expect(BigInt(e.num) > 0n).toBe(true);
      expect(BigInt(e.num) < BigInt(e.den)).toBe(true);
    }
  });

  // 相对误差,不是绝对误差:本表概率横跨 1/8 到 1/7×10¹⁴,任何「先定点缩放再转 Number」
  // 的写法都会在小的那头把有效数字截掉(曾经的 1e18 定点在 XXXCross 上就差到 1e-9)。
  it('probability 与 oneOver 互为倒数(相对误差 < 1e-12)', () => {
    for (const e of SKIP_ENTRIES) {
      expect(Math.abs(probability(e) * oneOver(e) - 1)).toBeLessThan(1e-12);
    }
  });

  it('最小的那几条概率仍保住 12 位有效数字', () => {
    const tiny = SKIP_ENTRIES.filter((e) => probability(e) < 1e-9);
    expect(tiny.length).toBeGreaterThan(0);
    for (const e of tiny) {
      // 与 BigInt 精确值比:取 den/num 的前 12 位有效数字
      const exact = Number(BigInt(e.den) * 10n ** 12n / BigInt(e.num)) / 1e12;
      expect(Math.abs(oneOver(e) / exact - 1)).toBeLessThan(1e-11);
    }
  });

  // 全群分母超 Number 安全区,任何一步走浮点都会静默丢精度
  it('全群分母不经过 Number', () => {
    expect(Number(CUBE3_STATES) > Number.MAX_SAFE_INTEGER).toBe(true);
    expect(String(Number(CUBE3_STATES))).not.toBe(CUBE3_STATES);
  });
});

describe('一轮五把里的跳步(二项)', () => {
  it('k=0 恒为 1,k>把数为 0', () => {
    expect(atLeastKInRound(1 / 72, 0)).toBe(1);
    expect(atLeastKInRound(1 / 72, 6)).toBe(0);
  });

  it('一轮五把里至少 1 次 PLL 跳步 ≈ 6.7%', () => {
    expect(atLeastKInRound(1 / 72, 1)).toBeCloseTo(1 - (71 / 72) ** 5, 12);
    expect(atLeastKInRound(1 / 72, 1)).toBeCloseTo(0.06754, 5);
  });

  // 表格给「一轮三次 PLL 跳步 = 1/38114」;二项算出来一致
  it('一轮五把里至少 3 次 PLL 跳步 ≈ 1/38114', () => {
    expect(1 / atLeastKInRound(1 / 72, 3)).toBeCloseTo(38114, 0);
  });

  it('单调:要求越多越难', () => {
    const p = 1 / 216;
    for (let k = 1; k < 5; k++) {
      expect(atLeastKInRound(p, k)).toBeGreaterThan(atLeastKInRound(p, k + 1));
    }
  });
});

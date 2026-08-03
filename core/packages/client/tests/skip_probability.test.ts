import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AUF, BLOCK122_ALL, BLOCK223_ALL, BOTTOM_FACES, CUBE2_STATES, CUBE2_WCA_LEGAL, CUBE4_CENTRE_STATES,
  CUBE4_ONE_CENTRE, CUBE4_TWO_CENTRES, LL_CO, LL_EO, LL_PERM, LL_UNIVERSE, MINX_EP, MINX_LL,
  MINX_LL_CO, MINX_LL_EO, MINX_LL_PERM_RAW, MINX_PLL, SKIP_ENTRIES,
  atLeastKInRound, blockEdges, cornersOnFace, crossEdges, entryById, exactlyKInRound,
  f2bOnFace, fbBlocksOnFace, oneOver, oneOverRelative, probability, statesWithAnyCrossSolved,
  statesWithAnyXCrossSolved, statesWithSolved,
} from '@/lib/skip-probability';
import { CUBE3_STATES } from '@/lib/god-distance-333';
import { CORNER_FACELET, EDGE_FACELET } from '@/lib/cube-facelet';
import { EXACT_DIST, zeroStates, type ExactFull } from '@/app/[lang]/scramble/stats/_data/exact_dist';

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
      const golden = zeroStates(cell)!;
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
      const golden = zeroStates(cell)!;
      expect(`${stage}=${entryById(`xcross${k}-cn`).num}`).toBe(`${stage}=${golden}`);
    }
  });

  it('四色底那 4 格夹在双色底与六色底之间', () => {
    for (const stage of ['xcross', 'xxcross', 'xxxcross', 'xxxxcross'] as const) {
      const z = (c: 'WY' | 'BGOR' | 'BGORWY') => {
        return BigInt(zeroStates(EXACT_DIST[stage].unfixed![c]!)!);
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

/**
 * Roux 那一族。LSE 的全集(11,520)有两条独立算路:
 *   ① 固定块计数:8 角 + 非 M 层 6 棱都好,剩下的合法状态数;
 *   ② 直接在 ⟨M, U⟩ 上广搜。
 * ② 数出来的是 92,160 —— 正好 8 倍,差的那 8 = M 层带着中心块转出来的坐标系自由度
 * (标准三阶状态计数里中心块是参照系,不算独立坐标)。两条路对上,11,520 才算证到。
 */
describe('Roux', () => {
  // ⟨M, U⟩ 上的广搜:6 条棱(UF UB UL UR DF DB)+ 朝向 + M 环上 4 个中心的位置
  function enumerateMU() {
    type St = { p: number[]; o: number[]; c: number };
    const key = (s: St) => `${s.p.join('')}|${s.o.join('')}|${s.c}`;
    const uCycle = [[1, 3], [3, 0], [0, 2], [2, 1]]; // U:UB→UR→UF→UL→UB,不翻
    const mCycle = [[0, 4], [4, 5], [5, 1], [1, 0]]; // M:UF→DF→DB→UB→UF,四条都翻
    const apply = (s: St, cyc: number[][], flip: boolean, centre: boolean): St => {
      const p = s.p.slice(), o = s.o.slice();
      for (const [from, to] of cyc) { p[to] = s.p[from]; o[to] = flip ? s.o[from] ^ 1 : s.o[from]; }
      return { p, o, c: centre ? (s.c + 1) % 4 : s.c };
    };
    const start: St = { p: [0, 1, 2, 3, 4, 5], o: [0, 0, 0, 0, 0, 0], c: 0 };
    const seen = new Set([key(start)]);
    let frontier = [start];
    while (frontier.length) {
      const next: St[] = [];
      for (const s of frontier) {
        for (const m of [apply(s, uCycle, false, false), apply(s, mCycle, true, true)]) {
          const k = key(m);
          if (!seen.has(k)) { seen.add(k); next.push(m); }
        }
      }
      frontier = next;
    }
    return seen;
  }

  it('⟨M, U⟩ 广搜 = 92,160 = 11,520 × 8(中心块坐标系)', () => {
    const all = enumerateMU();
    expect(all.size).toBe(92160);
    // 把中心那一位丢掉还剩 23,040 = 全部 6! 排列 × 32 组朝向;
    // 标准状态计数里只有偶排列合法(角已还原),故 11,520
    const noCentre = new Set([...all].map((k) => k.split('|').slice(0, 2).join('|')));
    expect(noCentre.size).toBe(23040);
    expect(oneOver(entryById('roux-lse'))).toBe(11520);
    expect(11520 * 8).toBe(all.size);
  });

  it('LSE = EO × 排列,两步分母相乘正好是全跳', () => {
    expect(oneOver(entryById('roux-lse-eo'))).toBe(32);
    expect(oneOver(entryById('roux-lse-ep'))).toBe(360);
    expect(32 * 360).toBe(oneOver(entryById('roux-lse')));
  });

  it('CMLL 与 COLL 同一个数;CMLL + LSE 是两者相乘', () => {
    expect(oneOver(entryById('roux-cmll'))).toBe(oneOver(entryById('coll')));
    expect(oneOver(entryById('roux-cmll-lse')))
      .toBe(oneOver(entryById('roux-cmll')) * oneOver(entryById('roux-lse')));
  });

  it('1×2×3 = 2 角 3 棱,1×2×2 = 1 角 2 棱(第四格是中心)', () => {
    const fb = fbBlocksOnFace('D');
    expect(fb.length).toBe(4);
    for (const b of fb) {
      expect(b.corners.length).toBe(2);
      expect(new Set(b.edges).size).toBe(3);
    }
    expect(oneOver(entryById('roux-fb-fixed'))).toBe(5322240);
    expect(BLOCK122_ALL.length).toBe(24);
    expect(oneOver(entryById('roux-122-fixed'))).toBe(12672);
  });

  // 并集必须落在 (单个/个数, 单个) 之间:重叠只会让它比「直接除以个数」更难
  it.each([
    ['roux-fb-y', 'roux-fb-fixed', 4],
    ['roux-fb-xy', 'roux-fb-fixed', 8],
    ['roux-122-any', 'roux-122-fixed', 24],
  ])('%s 的并集夹在「除以个数」与单个之间', (id, baseId, n) => {
    const one = oneOver(entryById(baseId));
    const many = oneOver(entryById(id));
    expect(many).toBeGreaterThan(one / n);
    expect(many).toBeLessThan(one);
  });

  it('SB = 给定首块之后第二块也好:6·5·3² × 9·8·7·2³ = 1,088,640', () => {
    const f2b = f2bOnFace('D');
    expect(f2b.corners.length).toBe(4);                 // 两块互不共角
    expect(new Set(f2b.edges).size).toBe(6);
    const sb = oneOverRelative(entryById('roux-f2b-fixed'))!;
    expect(sb).toBe(6 * 5 * 3 ** 2 * (9 * 8 * 7 * 2 ** 3));
    expect(sb).toBe(1088640);
    // 条件概率就是两个绝对值之比 —— 表格把 FB 与 SB 并排列,靠的正是这条
    // (5.8×10¹² 量级,比的是相对误差,不是绝对差)
    expect(oneOver(entryById('roux-f2b-fixed')) / (oneOver(entryById('roux-fb-fixed')) * sb))
      .toBeCloseTo(1, 12);
  });

  it('2×2×3 = 2 角 5 棱(中间那条棱两个角共用),1/1,532,805,120', () => {
    expect(BLOCK223_ALL.length).toBe(12);               // 立方体 12 条棱
    for (const b of BLOCK223_ALL) {
      expect(b.corners.length).toBe(2);
      expect(new Set(b.edges).size).toBe(5);            // 3 + 3 − 1
    }
    expect(oneOver(entryById('block223-fixed'))).toBe(8 * 7 * 3 ** 2 * (12 * 11 * 10 * 9 * 8 * 2 ** 5));
    expect(oneOver(entryById('block223-fixed'))).toBe(1532805120);
    // 12 个块的并集:夹在「除以 12」与单个之间
    const any = oneOver(entryById('block223-any'));
    expect(any).toBeGreaterThan(1532805120 / 12);
    expect(any).toBeLessThan(1532805120);
  });

  // 表格给 FB(x2 y)= 1/333,333。8 个首块就算完全不重叠也只能到 1/665,280,
  // 所以那一格不可能对;本机精确并集是 1/665,485.85。
  it('表格的 FB(x2 y)低于任何可能值', () => {
    expect(oneOver(entryById('roux-fb-xy'))).toBeCloseTo(665485.847685, 4);
    expect(oneOver(entryById('roux-fb-xy'))).toBeGreaterThan(333333.34);
    expect(5322240 / 8).toBe(665280); // 不重叠的下限
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

  // 表格另有一页「PLL skip in a round」,那页把 p 写死成 0.027777…= 1/36,
  // 与它自己 3x3 页的 72 打架。1/72 才对(288 个排列里 4 个是「还原 + 一次 AUF」),
  // 而且只有 1/72 能对上同一份表格给的「一轮三次 = 1/38,114」。
  it('表格那页的 p = 1/36 与它自己的 1/72 打架,38,114 站在 1/72 这边', () => {
    expect(1 / atLeastKInRound(1 / 72, 3)).toBeCloseTo(38114, 0);
    expect(1 / atLeastKInRound(1 / 36, 3)).toBeCloseTo(4866, 0);
    expect(oneOver(entryById('pll'))).toBe(72);
  });

  it('恰好 k 逐项加起来 = 至少 k;全部 k 加起来 = 1', () => {
    const p = 1 / 216;
    for (let k = 0; k <= 5; k++) {
      let sum = 0;
      for (let i = k; i <= 5; i++) sum += exactlyKInRound(p, i, 5);
      expect(sum).toBeCloseTo(atLeastKInRound(p, k, 5), 15);
    }
    let all = 0;
    for (let k = 0; k <= 5; k++) all += exactlyKInRound(p, k, 5);
    expect(all).toBeCloseTo(1, 15);
  });

  // 表格那页 D 列(恰好 n 次)的五个数,用它自己的 p = 1/36 复算,逐位对上 ——
  // 说明它的二项算得没错,错的只是喂进去的 p。
  it.each([
    [1, 0.1240879694], [2, 0.007090741111], [3, 0.0002025926032],
    [4, 0.000002894180045], [5, 0.00000001653817169],
  ])('表格 D 列 n=%i 复算得上', (n, want) => {
    // 表格只写到 10 位有效数字,跨 7 个数量级 → 比相对误差
    expect(Math.abs(exactlyKInRound(1 / 36, n, 5) / want - 1)).toBeLessThan(1e-9);
  });

  it('单调:要求越多越难', () => {
    const p = 1 / 216;
    for (let k = 1; k < 5; k++) {
      expect(atLeastKInRound(p, k)).toBeGreaterThan(atLeastKInRound(p, k + 1));
    }
  });
});

// ── 非三阶项目 ──────────────────────────────────────────────────────
// 这几族的分母不在三阶那套容斥里,所以判据只能是:①与站内已有的全枚举结果对账,
// ②闭式两条独立路径互推。两样都做。

const essential2x2 = JSON.parse(readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../stats/scramble/2x2_essential.json'),
  'utf8',
));
const numOf = (id: string) => entryById(id).num;
const denOf = (id: string) => entryById(id).den;

describe('二阶:与站内 3,674,160 态全枚举对账', () => {
  it('分母与 WCA 可用态数同源', () => {
    expect(essential2x2.meta.total_positions).toBe(CUBE2_STATES);
    expect(essential2x2.meta.wca_legal_min4h).toBe(CUBE2_WCA_LEGAL);
    // ≤3 HTM 的态正是被 WCA 排除的那些
    const shallow = [0, 1, 2, 3].reduce((a, d) => a + essential2x2.htm.counts[String(d)], 0);
    expect(CUBE2_STATES - CUBE2_WCA_LEGAL).toBe(shallow);
  });

  it('首面 / 首层 / 无棒三格 = 那份枚举里对应数据集的档位', () => {
    const group = (key: string) => essential2x2.stat.groups.find((g: { key: string }) => g.key === key)!;
    const zeroMove = (key: string) => group(key).rows.find((r: { m: number }) => r.m === 0).cases;
    expect(numOf('222-ff')).toBe(String(zeroMove('CN FF')));
    expect(numOf('222-fl')).toBe(String(zeroMove('CN FL')));
    expect(numOf('222-nobar')).toBe(String(group('(No Bar) CN FF').total));
    for (const id of ['222-ff', '222-fl', '222-nobar']) expect(denOf(id)).toBe(String(CUBE2_STATES));
  });

  it('「比赛里 4 步」是 QTM 档,不是 HTM 档', () => {
    expect(numOf('222-4q')).toBe(String(essential2x2.qtm.counts['4']));
    expect(denOf('222-4q')).toBe(String(CUBE2_WCA_LEGAL));
    // HTM 的 4 步档是另一个数量级(1/1989),两者别混
    expect(CUBE2_WCA_LEGAL / essential2x2.qtm.counts['4']).toBeCloseTo(6879.73, 1);
    expect(CUBE2_WCA_LEGAL / essential2x2.htm.counts['4']).toBeCloseTo(1989.05, 1);
  });

  it('顶层连跳 = 朝向 × 排列', () => {
    expect(oneOver(entryById('222-ll'))).toBe(
      oneOver(entryById('222-oll')) * oneOver(entryById('222-pll')),
    );
    expect(oneOver(entryById('222-ll'))).toBe(162);
  });
});

describe('四阶中心:两条独立路径推同一个数', () => {
  it('可分辨排布 24!/(4!)⁶', () => {
    expect(CUBE4_CENTRE_STATES).toBe(3_246_670_537_110_000n);
  });

  it('一种颜色成面 = 精确的 1/1771(不是近似)', () => {
    // 路径一:占位计数 6·20!/(4!)⁵ 除以全集
    expect(CUBE4_CENTRE_STATES).toBe(CUBE4_ONE_CENTRE * 1771n);
    // 路径二:抓住其中一块,另外三块要落进同一面剩下的三个槽
    // 3/23 · 2/22 · 1/21 = 6/10626 = 1/1771
    expect(23n * 22n * 21n).toBe(6n * 1771n);
  });

  it('一对相对色都成面 = 精确的 1/8,580,495', () => {
    expect(CUBE4_CENTRE_STATES).toBe(CUBE4_TWO_CENTRES * 8_580_495n);
    expect(CUBE4_TWO_CENTRES).toBeLessThan(CUBE4_ONE_CENTRE);
  });
});

describe('五魔顶层:排列必为偶,这条不是可选项', () => {
  it('朝向两档与 OLL', () => {
    expect(MINX_LL_EO).toBe(16);
    expect(MINX_LL_CO).toBe(81);
    expect(oneOver(entryById('minx-oll'))).toBe(1296);
  });

  it('A5 × A5 模 AUF = 720,顶层连跳 933,120', () => {
    expect(MINX_LL_PERM_RAW).toBe(3600);
    expect(MINX_PLL).toBe(720);
    expect(MINX_LL).toBe(933_120);
    // EP 好了之后 AUF 就被用掉了,角只剩 60 种 —— 相乘才回到 720,不是 12 × 12
    expect(MINX_EP * 60).toBe(MINX_PLL);
    expect(MINX_EP).toBe(12);
  });

  it('「各自必为偶」与站内 god_data 写的 2²⁷ 是同一件事', () => {
    const f = (n: bigint): bigint => (n <= 1n ? 1n : n * f(n - 1n));
    const both = f(20n) * f(30n) * 3n ** 19n * 2n ** 27n;   // 角、棱排列各取偶
    const onlyJoint = f(20n) * f(30n) * 3n ** 19n * 2n ** 29n / 4n;
    expect(both).toBe(onlyJoint);
    expect(String(both).length).toBe(69);                    // ≈ 1.01 × 10⁶⁸
    expect(String(both).slice(0, 3)).toBe('100');
  });

  it('表格把 720 拆成 24 × 30 —— 乘积对,两个因子都不对', () => {
    expect(24 * 30).toBe(MINX_PLL);        // 5!·5!/(5·4) 与 A5·A5/5 数值相等
    expect(24).not.toBe(MINX_EP);          // 真正的 EP 档是 12
    expect(30).not.toBe(MINX_EP);
  });
});

/**
 * 精确穷举分布 —— 三阶 Cross / XCross 系列子阶段在**全状态空间**上的深度分布。
 *
 * 与本页其它数据的根本区别:distribution.json 是拿真实 WCA 打乱跑分析器得到的**经验分布**
 * (n = 130 万条),本文件是把整个状态空间穷举 BFS 得到的**理论分布**,与任何打乱池无关。
 * 两者同图叠加即可看出 TNoodle 打乱离均匀随机态有多近(实测最大逐档偏差 0.07 个百分点)。
 *
 * 数据来源:solver/src/bin/dist_*.rs 头注释里的 GOLDEN 常量。每个数据集都是
 * 「C++ 先出金标 → Rust 独立复算 → 逐位一致」,两端耗时对照见 solver/CLAUDE.md。
 * 例外是四色底那 4 个「仅 0 步」格:solver 没有对应 bin,由 lib/skip-probability 的
 * 容斥现算 —— 同一套代码把其余 12 个 0 步金标(分别出自 5 个不同的 bin)逐位复现,
 * 见 tests/skip_probability.test.ts。
 * 全部 28 个数据集加起来不到 8KB,故走 TS 常量而非 stats/*.json 的 rsync 管道。
 * 例外之二是 EOCross:它没有 Rust bin,由 lib/eocross-dist.ts 在纯 TS 里 BFS 全部
 * 24,330,240 个态得到(约 7 秒,只在测试里跑)。
 *
 * ⚠ counts / total 一律是**字符串**,不是 number。双色底 XCross 的 d=7 是
 * 25,284,688,565,714,070,184,比 Number.MAX_SAFE_INTEGER 大三个数量级 —— 存成 number
 * 会静默丢精度且不报错。一切算术走 BigInt(见本文件底部的 exactPct / exactMean)。
 */

import { groupDigits } from '@/lib/group-digits';

/**
 * 阶段键 —— 与 lib/scramble-variants.ts 的 VARIANT_STAGES 逐字相同,可与经验分布直接对照。
 * 精确集目前覆盖两个变体:标准 CFOP 的 5 个阶段 + 伪(pseudo)变体的十字。
 */
export type ExactStage =
  | 'cross' | 'xcross' | 'xxcross' | 'xxxcross' | 'xxxxcross'
  | 'pseudo_cross' | 'eo_cross';
/** 精确集里 std 变体的阶段序(= VARIANT_STAGES.std)。 */
export const EXACT_STD_STAGES: ExactStage[] = ['cross', 'xcross', 'xxcross', 'xxxcross', 'xxxxcross'];
/** 精确集里 pseudo 变体的阶段序(VARIANT_STAGES.pseudo 的前缀,后三档还没算)。 */
export const EXACT_PSEUDO_STAGES: ExactStage[] = ['pseudo_cross'];
/** 精确集里 EO 变体的阶段序(VARIANT_STAGES.eo 的前缀,后四档还没算)。 */
export const EXACT_EO_STAGES: ExactStage[] = ['eo_cross'];
/** 全部有精确数据的阶段,覆盖矩阵与守卫测试按这个枚举。 */
export const EXACT_STAGES: ExactStage[] = [
  ...EXACT_STD_STAGES, ...EXACT_PSEUDO_STAGES, ...EXACT_EO_STAGES,
];

/**
 * 槽位档。经验分布只有「不固定槽」这一种语义(分析器对 4 个 F2L 槽取 min),
 * 固定槽是精确集独有的额外内容,与真题无可比对象 → 叠加对照只在 unfixed 时可用。
 */
export type ExactSlot = 'unfixed' | 'fixed1' | 'adj' | 'diag';

/**
 * 每个阶段有意义的槽位档。其余组合是**不适用**而非「未计算」——
 * Cross 阶段根本没有 F2L 槽的概念;XCross 只解 1 个槽,谈不上相邻/对角;
 * XXCross 要 2 个槽,谈不上固定单槽。不适用的入口直接不给(槽位下拉按阶段动态列出)。
 */
export const SLOT_OK: Record<ExactStage, ExactSlot[]> = {
  cross: ['unfixed'],
  xcross: ['unfixed', 'fixed1'],
  xxcross: ['unfixed', 'adj', 'diag'],
  xxxcross: ['unfixed'],
  xxxxcross: ['unfixed'],
  // 伪十字只解底面 4 棱,同样没有 F2L 槽的概念。
  pseudo_cross: ['unfixed'],
  // EOCross 同理:只有 12 条棱参与,没有 F2L 槽。
  eo_cross: ['unfixed'],
};

export const SLOT_LABEL: Record<ExactSlot, { zh: string; en: string }> = {
  unfixed: { zh: '不固定槽', en: 'Any slot' },
  fixed1: { zh: '固定 BL 槽', en: 'Fixed BL slot' },
  adj: { zh: '固定相邻双槽', en: 'Fixed adjacent pair' },
  diag: { zh: '固定对角双槽', en: 'Fixed diagonal pair' },
};

/**
 * 底色档。**同档内各配色的分布完全相同**(魔方的颜色对称性:任选一个面当底,穷举出的分布
 * 逐位一样),故每档只存一份,查表时把 single 的 6 个键、dual 的 3 个键、quad 的 3 个键
 * 分别折到 'W' / 'WY' / 'BGOR'。四色底那条对称性不是假设 —— `dist_cross_6col --faces`
 * 把 LRFB / UDFB / UDLR 三种取法各跑了一遍,九档逐位相同。
 */
export type ExactColors = 'W' | 'WY' | 'BGOR' | 'BGORWY';
export const EXACT_COLOR_KEYS: ExactColors[] = ['W', 'WY', 'BGOR', 'BGORWY'];
export const COLORS_LABEL: Record<ExactColors, { zh: string; en: string }> = {
  W: { zh: '单色底', en: 'Single color' },
  WY: { zh: '双色底', en: 'Dual color' },
  BGOR: { zh: '四色底', en: 'Four colors' },
  BGORWY: { zh: '六色底', en: 'Color neutral' },
};

/** 完整深度分布:counts[d] = 距离恰为 d 的状态数(字符串十进制),下标即深度,从 0 起。 */
export interface ExactFull {
  kind: 'full';
  total: string;
  counts: string[];
  /**
   * 有真题分布、但**与本格不是同一个口径**,故不叠加。文案直接摆给用户看。
   * 目前只有 EOCross:本格固定一条 EO 轴,真题那列两条轴取 min(见 lib/eocross-dist.ts)。
   * 留空 = 可以叠加(绝大多数格)。
   */
  noOverlay?: { zh: string; en: string };
}
/** 只算出了 0 步状态数(完整分布跑不动或无可信金标)。blocked = 卡在哪,直接显示给用户。
 *  不单独导出 —— 消费方一律经 ExactCell 收窄(cell.kind === 'zero')。 */
interface ExactZeroOnly {
  kind: 'zero';
  zero: string;
  /**
   * 最深一档:全表跑不动,但这一档的状态数是已知的。目前只有六色底 XCross ——
   * 上游穷举搜索出的 438 个 10 步态(见 _data/cn_xcross_10.ts,站内有 23 条对称代表
   * 展开成 438 的现场证明)。`href` 指向可以细看的地方。
   */
  top?: {
    depth: number;
    count: string;
    label: { zh: string; en: string };
    href?: string;
  };
  /**
   * 上游表格(`3x3.xlsx` 的 `stat` 页)给的平均步数,两位小数。**这是搬运值,不是证明** ——
   * 页面上必须与穷举出来的均值区分开。
   *
   * 之所以敢摆上来:同一张表与本站精确集有八格重叠,**七格逐位对上**(三档十字给到 9 位小数的
   * 5.812058081 / 5.387206484 / 4.809458647,加 XCross 单色 7.35、双色 6.99,XXCross
   * 固定双槽 9.96 adj / 9.95 diag)。唯一的例外是固定 BL 槽的 XCross:精确值 7.975721,
   * 表格写 7.97 —— 少进了一位。剩下这几格我们算不动,同一个来源同一套口径,当参考值比留空强。
   */
  refMean?: number;
  blocked: { zh: string; en: string };
}
export type ExactCell = ExactFull | ExactZeroOnly;

type StageTable = Partial<Record<ExactSlot, Partial<Record<ExactColors, ExactCell>>>>;

/**
 * 28 个数据集。数值逐位抄自 solver/src/bin/dist_*.rs 的 GOLDEN 注释(四色底那 4 格与 EOCross 除外,
 * 见文件头),每组的和必须等于 total —— tests/scramble_exact_dist.test.ts 用 toBe 锁死。
 */
export const EXACT_DIST: Record<ExactStage, StageTable> = {
  // ── Cross ─────────────────────────────────────────────────────────────
  // dist_cross_1col / _2col / _6col(四色底走 `dist_cross_6col --faces LRFB`)
  cross: {
    unfixed: {
      W: {
        kind: 'full',
        total: '190080',
        counts: ['1', '15', '158', '1394', '9809', '46381', '97254', '34966', '102'],
      },
      WY: {
        kind: 'full',
        total: '5109350400',
        counts: ['53759', '806253', '8484602', '74437062', '506855983',
          '2031420585', '2311536662', '175751822', '3672'],
      },
      // 四色底 = 去掉一对相对色。分母与六色底同为 12!·2¹¹ —— 两者共用整个 12 棱商空间,
      // 只是取 min 的色集不同(单/双色底那两档是各自的子空间,分母才更小)。
      BGOR: {
        kind: 'full',
        total: '980995276800',
        counts: ['20635791', '309065792', '3241839115', '27981105637', '175574881766',
          '514537441534', '256994694935', '2335611639', '591'],
      },
      BGORWY: {
        kind: 'full',
        total: '980995276800',
        counts: ['30942374', '462820266', '4839379314', '41131207644', '239671237081',
          '543580917185', '151019930400', '258842496', '40'],
      },
    },
  },

  // ── XCross ────────────────────────────────────────────────────────────
  // dist_xcross_1col(不固定槽,4 槽取 min)/ dist_xcross_1col_fixed(固定 BL 槽)
  // / dist_xcross_2col / dist_xcross_6col_0f
  xcross: {
    unfixed: {
      W: {
        kind: 'full',
        total: '695280402432000',
        counts: ['37908599', '568628985', '6517572994', '73720189384', '807161926701',
          '8014907818106', '64989168195161', '300998517199292', '310250210240321',
          '10139587753497', '4998960'],
      },
      WY: {
        kind: 'full',
        total: '43252003274489856000',
        counts: ['4716424212835', '70684100048529', '810010675407438', '9164539088016574',
          '100275129028335625', '988415943046745864', '7571709355823781261',
          '25284688565714070184', '9286904784514949171', '9959546054057915', '20230604'],
      },
      BGOR: {
        kind: 'zero',
        zero: '9405280010083',
        blocked: {
          zh: '完整分布未算 —— 与六色底同因:多色底 XCross 的全分布没有可信金标',
          en: 'Full distribution not computed — same reason as CN: no trusted ground truth for multi-colour XCross',
        },
      },
      BGORWY: {
        kind: 'zero',
        zero: '14066967166411',
        refMean: 6.53,
        // 中间各档未知,但两个端点都知道:0 步走容斥,10 步是上游穷举搜出来的 438 个态。
        top: {
          depth: 10,
          count: '438',
          label: {
            zh: '换哪个面当底、解哪个槽都要 10 步 —— XCross 的上确界',
            en: 'Ten moves from every colour and every slot — the supremum of XCross',
          },
          href: '/scramble/hardest',
        },
        blocked: {
          zh: '完整分布无可信金标 —— C++ 端 v1..v4 都有 bug',
          en: 'No trusted ground truth for the full distribution — the C++ v1..v4 all had bugs',
        },
      },
    },
    fixed1: {
      W: {
        kind: 'full',
        total: '72990720',
        counts: ['1', '15', '172', '1950', '21535', '220368', '1989591',
          '13431990', '40963892', '16325184', '36022'],
      },
    },
  },

  // ── XXCross ───────────────────────────────────────────────────────────
  // dist_xxcross_1col_adj / _diag(固定双槽)/ dist_xxcross_{1,2,6}col_0f
  xxcross: {
    unfixed: {
      W: {
        kind: 'zero',
        zero: '193203',
        refMean: 9.23,
        blocked: {
          zh: '完整分布未算 —— 695T 全空间,C++ 端自己也没解出来',
          en: 'Full distribution not computed — 695T state space, unsolved on the C++ side too',
        },
      },
      WY: {
        kind: 'zero',
        zero: '24037529283',
        refMean: 8.88,
        blocked: {
          zh: '完整分布未算 —— 剪枝表 2×21GB,32GB 机器跑不动',
          en: 'Full distribution not computed — needs 2×21GB pruning tables, beyond a 32GB machine',
        },
      },
      BGOR: {
        kind: 'zero',
        zero: '47399792819',
        blocked: {
          zh: '完整分布未算 —— 剪枝表同上量级,跑不动',
          en: 'Full distribution not computed — pruning tables of the same scale, out of reach',
        },
      },
      BGORWY: {
        kind: 'zero',
        zero: '70090706379',
        refMean: 8.49,
        blocked: {
          zh: '完整分布未算 —— 剪枝表同上量级,跑不动',
          en: 'Full distribution not computed — pruning tables of the same scale, out of reach',
        },
      },
    },
    adj: {
      W: {
        kind: 'full',
        total: '21459271680',
        counts: ['1', '15', '182', '2286', '28611', '349811', '4169855', '47547352',
          '491359384', '3873872622', '12836210229', '4203640870', '2090462'],
      },
    },
    diag: {
      W: {
        kind: 'full',
        total: '21459271680',
        counts: ['1', '15', '184', '2306', '29005', '356588', '4265037', '48724487',
          '504091325', '3969368327', '12938576623', '3992420950', '1436832'],
      },
    },
  },

  // ── XXXCross ──────────────────────────────────────────────────────────
  // dist_xxxcross_{1,2,6}col_0f(纯容斥)
  xxxcross: {
    unfixed: {
      W: {
        kind: 'zero',
        zero: '597',
        refMean: 11.31,
        blocked: {
          zh: '完整分布未算 —— 固定三槽版 2.2TB visited,32GB 机器跑不动',
          en: 'Full distribution not computed — the fixed-3-slot version needs 2.2TB of visited state',
        },
      },
      WY: {
        kind: 'zero',
        zero: '74276319',
        refMean: 10.98,
        blocked: {
          zh: '完整分布未算 —— 同上量级',
          en: 'Full distribution not computed — same scale as above',
        },
      },
      BGOR: {
        kind: 'zero',
        zero: '148429829',
        blocked: {
          zh: '完整分布未算 —— 同上量级',
          en: 'Full distribution not computed — same scale as above',
        },
      },
      BGORWY: {
        kind: 'zero',
        zero: '222523171',
        refMean: 10.57,
        blocked: {
          zh: '完整分布未算 —— 同上量级',
          en: 'Full distribution not computed — same scale as above',
        },
      },
    },
  },

  // ── XXXXCross(= F2L 完整还原)────────────────────────────────────────
  // dist_xxxxcross_{2,6}col_0f;单色底 0 步平凡为 1(只有还原态)
  xxxxcross: {
    unfixed: {
      W: {
        kind: 'zero',
        zero: '1',
        blocked: {
          zh: '完整分布未算 —— 350TB visited;0 步平凡为 1(只有还原态)',
          en: 'Full distribution not computed — 350TB of visited state; the 0-move count is trivially 1',
        },
      },
      WY: {
        kind: 'zero',
        zero: '124415',
        blocked: {
          zh: '完整分布未算 —— 350TB visited',
          en: 'Full distribution not computed — 350TB of visited state',
        },
      },
      BGOR: {
        kind: 'zero',
        zero: '248821',
        blocked: {
          zh: '完整分布未算 —— 350TB visited',
          en: 'Full distribution not computed — 350TB of visited state',
        },
      },
      BGORWY: {
        kind: 'zero',
        zero: '373219',
        blocked: {
          zh: '完整分布未算 —— 350TB visited',
          en: 'Full distribution not computed — 350TB of visited state',
        },
      },
    },
  },


  // ── EOCross ───────────────────────────────────────────────────────────
  // lib/eocross-dist.ts 现场 BFS(11,880 × 2,048 = 24,330,240),与 3x3.xlsx 的
  // `fixed eocross` 表逐档相同;d=10 的 140 个态在 /scramble/hardest 列全了。
  // 唯一一格不叠真题:口径不同(固定轴 vs 两轴取 min),见 noOverlay。
  eo_cross: {
    unfixed: {
      W: {
        kind: 'full',
        total: '24330240',
        counts: ['1', '15', '178', '1982', '21041', '204732', '1645039',
          '8477633', '12917628', '1061851', '140'],
        noOverlay: {
          zh: '这一格不叠真题对照:底面定死后 EO 还剩两条轴可选(差一个 y 旋转),本格固定一条轴,'
            + '而真题那列出自 Rust eo_cross_analyzer —— 它对两条轴取更短的那条。'
            + '差距是系统性的:固定轴均值 7.531,真题那列 7.219。',
          en: 'No WCA overlay here: with the bottom face fixed, EO still has two possible axes (a y rotation apart). '
            + 'This cell fixes one axis, while the empirical column comes from the Rust eo_cross_analyzer, which takes '
            + 'the shorter of the two. The gap is systematic: 7.531 moves fixed-axis vs 7.219 for that column.',
        },
      },
    },
  },
  // ── 伪十字(pseudo cross)────────────────────────────────────────────────
  // dist_cross_6col --pseudo --faces {U,UD,LRFB,UDLRFB}。
  // 与上面的 Cross 是同一份 12!·2¹¹ 商空间、同一个分母,只把目标集从「还原」放宽成
  // 「还原 / D / D' / D2」—— 底十字拼好即可,整体绕 D 轴偏一格不算错(F2L 阶段用
  // AUF 补回)。四档均值单调下降 5.3566 → 4.9304 → 4.5313 → 4.3073,且每一档都
  // 严格低于同底色的标准 Cross(放宽目标集只会变近)。
  pseudo_cross: {
    unfixed: {
      W: {
        kind: 'full',
        total: '980995276800',
        counts: ['20643840', '247726080', '2270822400', '18455592960', '110919352320',
          '385317273600', '422063308800', '41617981440', '82575360'],
      },
      WY: {
        kind: 'full',
        total: '980995276800',
        counts: ['41284608', '495194112', '4528035840', '36302346240', '203316470784',
          '514595773440', '220007574528', '1708548096', '49152'],
      },
      BGOR: {
        kind: 'full',
        total: '980995276800',
        counts: ['82561551', '989639320', '9016537732', '70527627394', '342939567939',
          '501802189777', '55631618351', '5534736'],
      },
      BGORWY: {
        kind: 'full',
        total: '980995276800',
        counts: ['123831014', '1483362354', '13467931869', '102912176921', '439912207732',
          '409964837408', '13130901687', '27815'],
      },
    },
  },
};

/**
 * 页面的 subsetKey(SubsetColorPicker 产出,如 'W' / 'Y' / 'BG' / 'BGOR' / 'BGORWY')
 * → 精确集的四个底色键。同档内各配色分布完全相同(颜色对称性),故 6 个单色键折到 'W'、
 * 3 个双色键折到 'WY'、3 个四色键折到 'BGOR'。长度就是色数,不看具体是哪几个色。
 */
export function exactColorsOf(subsetKey: string): ExactColors | null {
  const n = subsetKey.length;
  if (n === 1) return 'W';
  if (n === 2) return 'WY';
  if (n === 4) return 'BGOR';
  if (n === 6) return 'BGORWY';
  return null;
}

export function getExactCell(stage: string, slot: string, subsetKey: string): ExactCell | null {
  const st = EXACT_DIST[stage as ExactStage];
  if (!st) return null;
  if (!SLOT_OK[stage as ExactStage]?.includes(slot as ExactSlot)) return null;
  const colors = exactColorsOf(subsetKey);
  if (!colors) return null;
  return st[slot as ExactSlot]?.[colors] ?? null;
}

/** 该 (stage, slot, subset) 是否在这个阶段说得通 —— 用来区分「不适用」与「未计算」。 */
export function isSlotApplicable(stage: string, slot: string): boolean {
  return SLOT_OK[stage as ExactStage]?.includes(slot as ExactSlot) ?? false;
}

// ── BigInt 算术 ─────────────────────────────────────────────────────────
// 放大因子必须给足。第一版用 1e6 时,XXCross 的 d=0(1 / 21,459,271,680)整数除法后
// 直接变 0,柱子和表格行一起消失且不报错 —— 这类静默错值是这批数据的主要风险面。
// 1e14 下最小的一档(4.66e-9%)仍有 4 位有效数字。
const SCALE = 100000000000000n; // 1e14
const SCALE_N = 1e14;

/** 单档占比,返回 0..1 的归一化值(不是百分数)。 */
export function exactRatio(count: string, total: string): number {
  return Number((BigInt(count) * SCALE) / BigInt(total)) / SCALE_N;
}

/** 整条分布的归一化值表,键为深度字符串 —— 直接喂给 DiscreteHistogram 的 pct 字段。 */
export function exactRatios(cell: ExactFull): Record<string, number> {
  const out: Record<string, number> = {};
  cell.counts.forEach((c, d) => { out[String(d)] = exactRatio(c, cell.total); });
  return out;
}

/**
 * 精确平均深度。必须直接 Σ d·count / total ——
 * 先转百分比再加权求和会在第 4 位小数上偏掉(单色底 Cross 会算出 5.8120 而非金标的 5.8121)。
 */
export function exactMean(cell: ExactFull): number {
  let num = 0n;
  cell.counts.forEach((c, d) => { num += BigInt(d) * BigInt(c); });
  return Number((num * 1000000n) / BigInt(cell.total)) / 1e6;
}

/** 千分位在 `lib/group-digits.ts`(全站单一实现),这里转出去,老的 import 路径不动。 */
export { groupDigits };

/**
 * 占比显示。这批分布跨 10 个数量级(51% ↔ 4.7e-9%),定宽小数位在小档全显示成 0.0000%,
 * 故小值切科学计数。
 */
export function formatExactPct(ratio: number): string {
  if (ratio === 0) return '0%';
  const p = ratio * 100;
  return p >= 0.0001 ? `${p.toFixed(4)}%` : `${p.toExponential(2)}%`;
}

// 紧凑写法的进位表。必须一路带到 E(10^18)—— 双色底 XCross 的 d=7 是 2.5×10^19,
// 只到 P 会写出「25284.7P」这种东西。
const COMPACT_UNITS: readonly [number, string][] = [
  [18, 'E'], [15, 'P'], [12, 'T'], [9, 'B'], [6, 'M'], [3, 'k'],
];

/**
 * 柱顶用的紧凑计数。完整的 11~20 位数字在 13 个柱子上会横向撞成一片,
 * 故图上走紧凑写法,完整精确值由图下方的数据表承担(两者同源,都从 counts 字符串来)。
 */
export function compactExact(s: string): string {
  const len = s.length;
  if (len <= 4) return s;
  for (const [exp, suffix] of COMPACT_UNITS) {
    if (len > exp) {
      const intLen = len - exp;
      const head = s.slice(0, intLen);
      // 4 位以上整数部分不再带小数(1234B 已够长);否则补一位小数
      if (intLen >= 3) return `${head}${suffix}`;
      const dec = s[intLen];
      return dec === '0' ? `${head}${suffix}` : `${head}.${dec}${suffix}`;
    }
  }
  return groupDigits(s);
}

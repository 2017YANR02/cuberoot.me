/**
 * 精确穷举分布 —— 三阶各子阶段在**全状态空间**上的深度分布。
 *
 * 与本页其它数据的根本区别:distribution.json 是拿真实 WCA 打乱跑分析器得到的**经验分布**
 * (n = 130 万条),本文件是把整个状态空间穷举 BFS 得到的**理论分布**,与任何打乱池无关。
 * 两者同图叠加即可看出 TNoodle 打乱离均匀随机态有多近(实测最大逐档偏差 0.07 个百分点)。
 *
 * ## 三种口径,不能混着读
 *
 * 同一个阶段问「几步」可以问出三件不同的事,本文件把它们分到不同的**槽/帧档**里:
 *
 *   取最优帧(`unfixed`)  该底色下所有帧取最小 —— **站内口径**,与真题那列可以直接叠加。
 *                        六色底十字 = 六个面取最优,单色底 XCross = 该色四个槽取最优。
 *   固定单帧(`fixed1`)  把度量钉死在一个具体的帧上(一个槽 / 一条 EO 轴 / 一个块)。
 *                        它是站内口径的**上界**,与真题那列不是同一个问题,不叠加。
 *   固定双槽(`adj`/`diag`) 两个槽的相邻 / 对角两种形状,是两个不同的谜题,分开列。
 *
 * 「固定单帧」不是凑数:一个帧的坐标空间往往小到能整表 BFS,而同一阶段的站内口径要读整只
 * 魔方(多帧取最小),动辄 1e14 以上。本文件里有数的格子多半是前者。
 *
 * **固定帧那两档没有底色维度**:帧 = (面, 槽 / 轴 / 块),钉死一个帧就把底面一并钉死了,
 * 「允许几个底色」在这一档下不是一个问题(换个底色就是换个帧,同一条曲线)。故 `fixed1` /
 * `adj` / `diag` 每个阶段只存一份,存在 `W` 键下 —— 那是存储位置,不读作「单色底」。
 * 查表一律走 `getExactCell()`,它按 `isColorFreeCell()` 把底色档忽略掉;直接索引
 * `EXACT_DIST[st].fixed1[colors]` 会让四档底色里的三档凭空「查无此格」。
 *
 * ## 数据来源(每一格都标了)
 *
 *   - `solver/src/bin/dist_*.rs` 头注释里的 GOLDEN 常量:「C++ 先出金标 → Rust 独立复算 →
 *     逐位一致」。十字族的 14 格出自这里。
 *   - 四色底那 4 个「仅 0 步」格:`lib/skip-probability` 的容斥现算,同一套代码把其余 12 个
 *     0 步金标逐位复现(`tests/skip_probability.test.ts`)。
 *   - EOCross:`lib/eocross-dist.ts` 在纯 TS 里 BFS 全部 24,330,240 个态。
 *   - 纯 EO 的多轴档:`lib/eo-axis-dist.ts`,70,963,200 的联合商空间(`tests/eo_axis_dist.test.ts`)。
 *   - 122 / 123 / 222 三个块:`lib/cross-trainer/tracked.ts` 的通用整表 BFS,同一台引擎逐位
 *     复现了十字与 222 两条已知曲线(`tests/cross_trainer_tracked.test.ts`)。
 *   - 基态 / 伪基态 / 伪 XCross 三个定槽档:72,990,720 全表 BFS,`tests/cross_trainer_pair.test.ts`
 *     (`PAIR_FULL_BFS=1`)与 `tests/cross_trainer_multi.test.ts`(`PX_FULL_BFS=1`)。后者顺带
 *     用纯 TS 复算了 `dist_xcross_1col_fixed.rs` 的 GOLDEN,逐位相同。
 *   - 整体:`lib/god-distance-333.ts`(cube20.org)。**这一格不是全穷举**,d ≥ 16 是估计值,
 *     故带 `caveat`。
 *
 * 数据量不到 20KB,故走 TS 常量而非 stats/*.json 的 rsync 管道。
 *
 * ## 还没算的格子也要说话
 *
 * 菜单与 WCA 那套逐项相同(守卫:`tests/scramble_exact_dist.test.ts`),所以绝大多数格子是空的。
 * 空格不写「暂无数据」,一律给 `kind: 'todo'`:坐标空间多大、可行性哪一档(代码就位 / 有路线没代码 /
 * 现有硬件够不着)、卡在哪。要跑的单元列在 `solver/EXACT_DIST_EXPANSION.md`。
 *
 * ⚠ counts / total 一律是**字符串**,不是 number。双色底 XCross 的 d=7 是
 * 25,284,688,565,714,070,184,比 Number.MAX_SAFE_INTEGER 大三个数量级 —— 存成 number
 * 会静默丢精度且不报错。一切算术走 BigInt(见本文件底部的 exactRatio / exactMean)。
 */

import { groupDigits } from '@/lib/group-digits';
import { CUBE3_STATES, GOD_DIST_333_NORMALIZED } from '@/lib/god-distance-333';

/** 双语文案。 */
export interface Text { zh: string; en: string }

/**
 * 阶段键 —— 与 lib/scramble-variants.ts 的 VARIANT_STAGES / distribution.json 的
 * `variants[*].stages` 逐字相同,可与经验分布直接对照。全部 39 个都在,包括一个数都还没算的。
 */
export type ExactStage =
  | '333'
  | 'cross' | 'xcross' | 'xxcross' | 'xxxcross' | 'xxxxcross'
  | 'pseudo_cross' | 'pseudo_xcross' | 'pseudo_xxcross' | 'pseudo_xxxcross'
  | 'cross_pair' | 'xcross_pair' | 'xxcross_pair' | 'xxxcross_pair'
  | 'pseudo_cross_pseudo_pair' | 'pseudo_xcross_pseudo_pair'
  | 'pseudo_xxcross_pseudo_pair' | 'pseudo_xxxcross_pseudo_pair'
  | 'eo' | 'eoline'
  | 'eo_cross' | 'eo_xcross' | 'eo_xxcross' | 'eo_xxxcross' | 'eo_xxxxcross'
  | 'f2leo_cross' | 'f2leo_xcross' | 'f2leo_xxcross' | 'f2leo_xxxcross'
  | 'pseudo_f2leo_cross' | 'pseudo_f2leo_xcross' | 'pseudo_f2leo_xxcross' | 'pseudo_f2leo_xxxcross'
  | 'fbsquare' | 'rouxs1' | 'block222' | 'block223' | 'f2b'
  | 'dr';

/**
 * 每个**数据变体**的阶段序 —— 与 `stats/scramble/distribution.json` 的 `sets.wca.variants`
 * 逐键逐项相同,页面据此把精确集的方法 / 阶段下拉做成和 WCA 那套一模一样。
 * 漏一项、多一项、顺序不同都会被 `tests/scramble_exact_dist.test.ts` 抓住。
 */
export const EXACT_VARIANT_STAGES: Record<string, ExactStage[]> = {
  '333': ['333'],
  std: ['cross', 'xcross', 'xxcross', 'xxxcross', 'xxxxcross'],
  pseudo: ['pseudo_cross', 'pseudo_xcross', 'pseudo_xxcross', 'pseudo_xxxcross'],
  pair: ['cross_pair', 'xcross_pair', 'xxcross_pair', 'xxxcross_pair'],
  pseudo_pair: [
    'pseudo_cross_pseudo_pair', 'pseudo_xcross_pseudo_pair',
    'pseudo_xxcross_pseudo_pair', 'pseudo_xxxcross_pseudo_pair',
  ],
  eoline: ['eo', 'eoline'],
  eo: ['eo_cross', 'eo_xcross', 'eo_xxcross', 'eo_xxxcross', 'eo_xxxxcross'],
  f2leo: ['f2leo_cross', 'f2leo_xcross', 'f2leo_xxcross', 'f2leo_xxxcross'],
  pseudo_f2leo: [
    'pseudo_f2leo_cross', 'pseudo_f2leo_xcross', 'pseudo_f2leo_xxcross', 'pseudo_f2leo_xxxcross',
  ],
  '123': ['fbsquare', 'rouxs1'],
  '123x2': ['f2b'],
  '222': ['block222'],
  '223': ['block223'],
  dr: ['dr'],
};

/**
 * 变体的展示序,矩阵按它排行。= lib/scramble-variants 的 VARIANT_ORDER 展开到数据变体,
 * 且展开顺序必须让**同一个 UI 方法的数据变体连成一段**、段内阶段序与阶段下拉一致:
 * 砖那一段展平后是 122 / 123 / 222 / 223 / F2B(= VARIANT_STAGES.block),
 * EO 那一段是 EO / EOLine / 十字…(= EO_UI_STAGES)。
 */
export const EXACT_VARIANT_ORDER: string[] = [
  '333', 'std', 'pseudo', 'pair', 'pseudo_pair', 'eoline', 'eo', 'f2leo', 'pseudo_f2leo',
  '123', '222', '223', '123x2', 'dr',
];

/** 全部阶段,按变体展示序展平 —— 覆盖矩阵与守卫测试按这个枚举。 */
export const EXACT_STAGES: ExactStage[] = EXACT_VARIANT_ORDER.flatMap((v) => EXACT_VARIANT_STAGES[v]);

/** 阶段 → 它属于哪个数据变体(矩阵分组、深链的 variant 参数都用它)。 */
export const EXACT_STAGE_VARIANT: Record<string, string> = Object.fromEntries(
  EXACT_VARIANT_ORDER.flatMap((v) => EXACT_VARIANT_STAGES[v].map((s) => [s, v])),
);

/** 精确集里 std 变体的阶段序(= VARIANT_STAGES.std)。 */
export const EXACT_STD_STAGES: ExactStage[] = EXACT_VARIANT_STAGES.std;
/** 精确集里 pseudo 变体的阶段序。 */
export const EXACT_PSEUDO_STAGES: ExactStage[] = EXACT_VARIANT_STAGES.pseudo;
/** 精确集里 eo 变体的阶段序。 */
export const EXACT_EO_STAGES: ExactStage[] = EXACT_VARIANT_STAGES.eo;

/**
 * 帧档。经验分布只有「取最优帧」这一种语义(分析器对该底色的所有帧取 min),
 * 固定帧是精确集独有的额外内容,与真题无可比对象 → 叠加对照只在 unfixed 时可用。
 *
 * 键名沿用最早那版(`fixed1` 当时只有 XCross 的定槽一种含义),换名会把已经发出去的深链打断;
 * 含义已经推广成「一个具体的帧」,具体是哪个帧见 FRAME_NOTE。
 */
export type ExactSlot = 'unfixed' | 'fixed1' | 'adj' | 'diag';

export const SLOT_LABEL: Record<ExactSlot, Text> = {
  unfixed: { zh: '取最优帧', en: 'Best frame' },
  fixed1: { zh: '固定单帧', en: 'One fixed frame' },
  adj: { zh: '固定相邻双槽', en: 'Fixed adjacent pair' },
  diag: { zh: '固定对角双槽', en: 'Fixed diagonal pair' },
};

/**
 * 每个阶段有意义的帧档。其余组合是**不适用**而非「未计算」——
 * 十字 / 伪十字 / F2LEO 十字单色底只有一个帧(取最优 = 那个帧本身),故不另列固定档;
 * XCross 只解 1 个槽,谈不上相邻 / 对角;XXCross 要 2 个槽,谈不上固定单槽;
 * DR 只依赖轴,一个底色恰好一条轴。不适用的入口直接不给(帧档下拉按阶段动态列出)。
 */
export const SLOT_OK: Record<ExactStage, ExactSlot[]> = {
  '333': ['unfixed'],

  cross: ['unfixed'],
  xcross: ['unfixed', 'fixed1'],
  xxcross: ['unfixed', 'adj', 'diag'],
  xxxcross: ['unfixed', 'fixed1'],
  xxxxcross: ['unfixed'],

  pseudo_cross: ['unfixed'],
  pseudo_xcross: ['unfixed', 'fixed1'],
  pseudo_xxcross: ['unfixed', 'adj', 'diag'],
  pseudo_xxxcross: ['unfixed', 'fixed1'],

  cross_pair: ['unfixed', 'fixed1'],
  xcross_pair: ['unfixed', 'adj', 'diag'],
  xxcross_pair: ['unfixed'],
  xxxcross_pair: ['unfixed'],

  pseudo_cross_pseudo_pair: ['unfixed', 'fixed1'],
  pseudo_xcross_pseudo_pair: ['unfixed', 'adj', 'diag'],
  pseudo_xxcross_pseudo_pair: ['unfixed'],
  pseudo_xxxcross_pseudo_pair: ['unfixed'],

  eo: ['unfixed', 'fixed1'],
  eoline: ['unfixed', 'fixed1'],

  eo_cross: ['unfixed', 'fixed1'],
  eo_xcross: ['unfixed', 'fixed1'],
  eo_xxcross: ['unfixed', 'adj', 'diag'],
  eo_xxxcross: ['unfixed', 'fixed1'],
  eo_xxxxcross: ['unfixed'],

  // 底面定死之后 EO 还剩两条轴(差一个 y 旋转),F2LEO 一族因此每个底色都有两个帧 ——
  // 分析器 f2leo_solver::get_stats 的折叠正是 min(rot, rot·y)。所以十字这档也有固定帧可谈。
  f2leo_cross: ['unfixed', 'fixed1'],
  f2leo_xcross: ['unfixed', 'fixed1'],
  f2leo_xxcross: ['unfixed', 'adj', 'diag'],
  f2leo_xxxcross: ['unfixed', 'fixed1'],

  pseudo_f2leo_cross: ['unfixed', 'fixed1'],
  pseudo_f2leo_xcross: ['unfixed', 'fixed1'],
  pseudo_f2leo_xxcross: ['unfixed', 'adj', 'diag'],
  pseudo_f2leo_xxxcross: ['unfixed', 'fixed1'],

  fbsquare: ['unfixed', 'fixed1'],
  rouxs1: ['unfixed', 'fixed1'],
  block222: ['unfixed', 'fixed1'],
  block223: ['unfixed', 'fixed1'],
  f2b: ['unfixed', 'fixed1'],

  dr: ['unfixed'],
};

/** 「固定单帧」到底固定的是什么 —— 每个阶段不一样,列头写不下,落到格子里。 */
const SLOT_ONE = { zh: '一个 F2L 槽', en: 'one F2L slot' };
const SLOT_THREE = { zh: '三个 F2L 槽', en: 'three F2L slots' };
// F2LEO 一族的帧还多一个自由度:EO 的轴。底面定死后还剩两条(差一个 y 旋转),
// 站内那列对这两条取最短,所以「固定单帧」在这一族里连轴一起钉死。
const SLOT_ONE_EO = { zh: '一个 F2L 槽 + 一条 EO 轴', en: 'one F2L slot and one EO axis' };
const SLOT_THREE_EO = { zh: '三个 F2L 槽 + 一条 EO 轴', en: 'three F2L slots and one EO axis' };
export const FRAME_NOTE: Partial<Record<ExactStage, Text>> = {
  xcross: SLOT_ONE,
  xxxcross: SLOT_THREE,
  pseudo_xcross: SLOT_ONE,
  pseudo_xxxcross: SLOT_THREE,
  cross_pair: SLOT_ONE,
  pseudo_cross_pseudo_pair: SLOT_ONE,
  eo_xcross: SLOT_ONE,
  eo_xxxcross: SLOT_THREE,
  f2leo_cross: { zh: '一条 EO 轴', en: 'one EO axis' },
  pseudo_f2leo_cross: { zh: '一条 EO 轴', en: 'one EO axis' },
  f2leo_xcross: SLOT_ONE_EO,
  f2leo_xxxcross: SLOT_THREE_EO,
  pseudo_f2leo_xcross: SLOT_ONE_EO,
  pseudo_f2leo_xxxcross: SLOT_THREE_EO,
  eo: { zh: '一条 EO 轴', en: 'one EO axis' },
  eoline: { zh: '一条线(面 + 轴)', en: 'one line (face + axis)' },
  eo_cross: { zh: '一条 EO 轴', en: 'one EO axis' },
  fbsquare: { zh: '一个 1×2×2', en: 'one 1×2×2' },
  rouxs1: { zh: '一个 1×2×3', en: 'one 1×2×3' },
  block222: { zh: '一个 2×2×2', en: 'one 2×2×2' },
  block223: { zh: '一个 2×2×3', en: 'one 2×2×3' },
  f2b: { zh: '一对 1×2×3', en: 'one pair of 1×2×3' },
};

/**
 * 一个具体帧上的坐标空间大小。「这一格有多贵」的第一判据,也是矩阵行头那一行小字。
 * 全部由块的构成算出:追踪 k 个角 = ∏(8−i)·3,追踪 m 条棱 = ∏(12−i)·2;
 * EO 族把「全部 12 条棱的翻转字」(2¹¹)乘上被追踪棱的有序位置。
 */
export const FRAME_STATES: Partial<Record<ExactStage, string>> = {
  cross: '190080',
  xcross: '72990720',
  xxcross: '21459271680',
  xxxcross: '4635202682880',
  xxxxcross: '695280402432000',

  pseudo_cross: '190080',
  pseudo_xcross: '72990720',
  pseudo_xxcross: '21459271680',
  pseudo_xxxcross: '4635202682880',

  cross_pair: '72990720',
  xcross_pair: '21459271680',
  xxcross_pair: '4635202682880',
  xxxcross_pair: '695280402432000',

  pseudo_cross_pseudo_pair: '72990720',
  pseudo_xcross_pseudo_pair: '21459271680',
  pseudo_xxcross_pseudo_pair: '4635202682880',
  pseudo_xxxcross_pseudo_pair: '695280402432000',

  eo: '2048',
  eoline: '270336',

  // EO 族:(4 条底棱的有序位置)×(被解的 n 个槽棱在剩下 8 个槽里的有序位置)×(角位)× 2¹¹ 翻转字。
  eo_cross: '24330240',
  eo_xcross: '4671406080',
  eo_xxcross: '686696693760',
  eo_xxxcross: '74163242926080',
  eo_xxxxcross: '5562243219456000',

  // F2LEO 族:棱那一半恒是「4 条底棱 + 4 条中层棱的有序位置 × 这 8 条的翻转位」= 51 亿,
  // 阶段越深只是多乘几个角位(被解的那几个槽的角)。
  f2leo_cross: '5109350400',
  f2leo_xcross: '122624409600',
  f2leo_xxcross: '2575112601600',
  f2leo_xxxcross: '46352026828800',

  pseudo_f2leo_cross: '5109350400',
  pseudo_f2leo_xcross: '122624409600',
  pseudo_f2leo_xxcross: '2575112601600',
  pseudo_f2leo_xxxcross: '46352026828800',

  fbsquare: '12672',
  rouxs1: '5322240',
  block222: '253440',
  block223: '1532805120',
  f2b: '5794003353600',

  dr: '2217093120',
};

export const COLORS_LABEL: Record<ExactColors, Text> = {
  W: { zh: '单色底', en: 'Single color' },
  WY: { zh: '双色底', en: 'Dual color' },
  BGOR: { zh: '四色底', en: 'Four colors' },
  BGORWY: { zh: '六色底', en: 'Color neutral' },
};

/**
 * 底色档。**同档内各配色的分布完全相同**(魔方的颜色对称性:任选一个面当底,穷举出的分布
 * 逐位一样),故每档只存一份,查表时把 single 的 6 个键、dual 的 3 个键、quad 的 3 个键
 * 分别折到 'W' / 'WY' / 'BGOR'。四色底那条对称性不是假设 —— `dist_cross_6col --faces`
 * 把 LRFB / UDFB / UDLR 三种取法各跑了一遍,九档逐位相同。
 */
export type ExactColors = 'W' | 'WY' | 'BGOR' | 'BGORWY';
export const EXACT_COLOR_KEYS: ExactColors[] = ['W', 'WY', 'BGOR', 'BGORWY'];

/**
 * 与底色无关的阶段。整体(最优解长度)不看你打算把哪个面当底,四档底色是同一个问题、
 * 同一份答案 —— 页面上也不给底色选择器(`is333`)。
 */
export const COLOR_FREE: ReadonlySet<string> = new Set<string>(['333']);

/** 完整深度分布:counts[d] = 距离恰为 d 的状态数(字符串十进制),下标即深度,从 0 起。 */
export interface ExactFull {
  kind: 'full';
  total: string;
  counts: string[];
  /**
   * 有真题分布、但**与本格不是同一个口径**,故不叠加。文案直接摆给用户看。
   * 固定帧那几档天然如此(页面按 slot !== 'unfixed' 一律禁掉叠加,不必逐格写);
   * 这里只写「口径看着像、其实不是」的例外,目前是 EOCross。
   */
  noOverlay?: Text;
  /** 这一格不是全穷举,或者有别的必须先说清楚的前提。 */
  caveat?: Text;
}

/** 只算出了 0 步状态数(完整分布跑不动或无可信金标)。blocked = 卡在哪,直接显示给用户。 */
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
    label: Text;
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
  blocked: Text;
}

/**
 * 还没算的格子。空着不写「暂无数据」—— 多大、可不可行、卡在哪,这三件事本身就是内容。
 *
 *   ready  算法与代码都就位,只差机时(单元号见 solver/EXACT_DIST_EXPANSION.md)
 *   plan   路线清楚、代码还没写
 *   oor    现有硬件够不着(out of reach),写清楚要多少
 */
export interface ExactPending {
  kind: 'todo';
  feasible: 'ready' | 'plan' | 'oor';
  /** 该格坐标空间大小(十进制字符串);说不准就留空。 */
  states?: string;
  note: Text;
  /** 跟踪文档里的单元号。 */
  unit?: string;
}

export type ExactCell = ExactFull | ExactZeroOnly | ExactPending;

type StageTable = Partial<Record<ExactSlot, Partial<Record<ExactColors, ExactCell>>>>;

/** 四档底色同一份数据(与底色无关的阶段用)。 */
const allColors = (cell: ExactCell): Partial<Record<ExactColors, ExactCell>> =>
  Object.fromEntries(EXACT_COLOR_KEYS.map((c) => [c, cell]));

/**
 * 已经算出来的格子。数值逐位抄自各自的来源(见文件头),每组的和必须等于 total ——
 * tests/scramble_exact_dist.test.ts 用 toBe 锁死。没列出来的格子走 pendingCell() 的兜底。
 */
export const EXACT_DIST: Record<ExactStage, StageTable> = {
  // ── 整体 ──────────────────────────────────────────────────────────────
  // lib/god-distance-333.ts(cube20.org)。唯一一格不是自己穷举出来的。
  '333': {
    unfixed: allColors({
      kind: 'full',
      total: CUBE3_STATES,
      counts: [...GOD_DIST_333_NORMALIZED],
      caveat: {
        zh: '这一格只有 d ≤ 15 是穷举精确值(Rokicki 等人,2010)。d = 16..19 cube20.org 只公布两位'
          + '有效数字,这里按「|G| − Σ(d ≤ 15)」这个精确的尾部总和等比归一化;d = 20 的 4.9 亿是'
          + '「已经找到这么多个」的下界。别把这四档的位数当真。',
        en: 'Only d ≤ 15 is an exact enumeration here (Rokicki et al., 2010). cube20.org publishes '
          + 'd = 16..19 to two significant figures; those four bins are scaled to the exact tail total '
          + '|G| − Σ(d ≤ 15), and the 490 million at d = 20 is a lower bound, not a count.',
      },
    }),
  },

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
  // dist_xcross_1col(不固定槽,4 槽取 min)/ dist_xcross_1col_fixed(固定单槽)
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

  // ── 伪 XCross ──────────────────────────────────────────────────────────
  // 定槽档 = or18 公布的层大小,`tests/cross_trainer_multi.test.ts`(PX_FULL_BFS=1)
  // 从目标集出发把 72,990,720 个态全 BFS 了一遍,逐位相同。
  pseudo_xcross: {
    fixed1: {
      W: {
        kind: 'full',
        total: '72990720',
        counts: ['4', '48', '568', '6556', '70495', '693185', '5618257',
          '27845257', '36570024', '2186315', '11'],
      },
    },
  },

  // ── 基态(Pair)─────────────────────────────────────────────────────────
  // 十字解好 + 一个 F2L 对「已配好」(Setup × Insert 能一把塞进去),定义见
  // solver/DEFINITIONS.md § Pair Analyzer。全表 BFS:tests/cross_trainer_pair.test.ts
  // (PAIR_FULL_BFS=1),0 步 17 个态就是 or18 公布的那 17 个。
  cross_pair: {
    fixed1: {
      W: {
        kind: 'full',
        total: '72990720',
        counts: ['17', '255', '3102', '35217', '367070', '3184390',
          '18621816', '41028188', '9746797', '3868'],
      },
    },
  },

  // ── 伪基态 ─────────────────────────────────────────────────────────────
  // 同上,目标集再按底面四个 D 偏移闭包一次 → 68 = 4 × 17,无碰撞。
  pseudo_cross_pseudo_pair: {
    fixed1: {
      W: {
        kind: 'full',
        total: '72990720',
        counts: ['68', '816', '9256', '103681', '1012687', '7689281',
          '32089788', '30868369', '1216774'],
      },
    },
  },

  // ── 纯 EO ──────────────────────────────────────────────────────────────
  // lib/eo-axis-dist.ts。固定轴那格是 2,048 个翻转字的整表;取最优帧那两格是
  // 70,963,200 的联合商空间(三条轴的 EO 字在这上面同时定义得下来)。
  // 单色底 = 双色底(一对对面色共用一条面轴 → 垂直轴恒为同两条);
  // 四色底 = 六色底(四色已经把三条轴占满)。这两条等式是数据本身,不是近似。
  eo: {
    unfixed: {
      W: {
        kind: 'full',
        total: '70963200',
        counts: ['69230', '138320', '1716120', '12886020', '31047310', '23418220', '1681750', '6230'],
      },
      WY: {
        kind: 'full',
        total: '70963200',
        counts: ['69230', '138320', '1716120', '12886020', '31047310', '23418220', '1681750', '6230'],
      },
      BGOR: {
        kind: 'full',
        total: '70963200',
        counts: ['103741', '207066', '2550149', '17895502', '34885236', '14971488', '349617', '401'],
      },
      BGORWY: {
        kind: 'full',
        total: '70963200',
        counts: ['103741', '207066', '2550149', '17895502', '34885236', '14971488', '349617', '401'],
      },
    },
    fixed1: {
      W: {
        kind: 'full',
        total: '2048',
        counts: ['1', '2', '25', '202', '620', '900', '285', '13'],
      },
    },
  },

  // ── EOLine ─────────────────────────────────────────────────────────────
  // lib/cross-trainer/eoline.ts 的整表 BFS(2,048 翻转字 × 132 有序线位)。
  eoline: {
    fixed1: {
      W: {
        kind: 'full',
        total: '270336',
        counts: ['1', '9', '91', '851', '6831', '41703', '130239', '88683', '1927', '1'],
      },
    },
  },

  // ── EOCross ───────────────────────────────────────────────────────────
  // lib/eocross-dist.ts 现场 BFS(11,880 × 2,048 = 24,330,240),与 3x3.xlsx 的
  // `fixed eocross` 表逐档相同;d=10 的 140 个态在 /scramble/hardest 列全了。
  // 这一格是**固定轴**,不是站内的单色底口径(那是两条垂直轴取最优),故落在固定帧列。
  eo_cross: {
    fixed1: {
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

  // ── 砖 ─────────────────────────────────────────────────────────────────
  // lib/cross-trainer/tracked.ts 的整表 BFS。同一台引擎逐位复现了十字(190,080)与
  // 222(253,440)两条已知曲线,见 tests/cross_trainer_tracked.test.ts。
  fbsquare: {
    fixed1: {
      W: {
        kind: 'full',
        total: '12672',
        counts: ['1', '9', '78', '590', '2922', '6523', '2525', '24'],
      },
    },
  },
  rouxs1: {
    fixed1: {
      W: {
        kind: 'full',
        total: '5322240',
        counts: ['1', '12', '132', '1406', '14099', '122279', '797145', '2638638', '1715068', '33460'],
      },
    },
  },
  block222: {
    fixed1: {
      W: {
        kind: 'full',
        total: '253440',
        counts: ['1', '9', '90', '852', '7169', '44182', '131636', '68940', '561'],
      },
    },
  },
  // solver/src/bin/dist_tracked.rs 的 `223` preset(15.3 亿态,14s)。同一台引擎在同一次
  // 运行里逐档复现了十字 / 122 / 222 / 123 / XCross 五条已知曲线,见该文件头注。
  block223: {
    fixed1: {
      W: {
        kind: 'full',
        total: '1532805120',
        counts: ['1', '12', '141', '1746', '20935', '243092', '2698935', '27258179',
          '216204042', '830686751', '453825501', '1865784', '1'],
      },
    },
  },
  f2b: {},

  // ── 一个数都还没有的阶段 ────────────────────────────────────────────────
  // 空表 = 每一格都走 pendingCell() 的兜底,那里按阶段说清楚多大、可不可行、卡在哪。
  pseudo_xxcross: {},
  pseudo_xxxcross: {},
  xcross_pair: {},
  xxcross_pair: {},
  xxxcross_pair: {},
  pseudo_xcross_pseudo_pair: {},
  pseudo_xxcross_pseudo_pair: {},
  pseudo_xxxcross_pseudo_pair: {},
  // solver/src/bin/dist_tracked.rs 的 `eo_xcross` preset(46.7 亿态,40s):
  // 12 条棱的翻转字 × 五条棱的有序位置 × 一个角。固定一条 EO 轴 + 一个 F2L 槽。
  eo_xcross: {
    fixed1: {
      W: {
        kind: 'full',
        total: '4671406080',
        counts: ['1', '15', '186', '2317', '28337', '335934', '3837763', '40923897',
          '371417146', '2016467967', '2190899897', '47492614', '6'],
      },
    },
  },
  eo_xxcross: {},
  eo_xxxcross: {},
  eo_xxxxcross: {},
  // ── F2LEO 十字 ─────────────────────────────────────────────────────────
  // solver/src/bin/dist_tracked.rs 的 `f2leo_cross` / `f2leo_cross_1axis`,各 2.6s。
  //
  // 这一格曾经标着「51 亿态、11.2GB nibble、等机时」。贵在把四条中层棱当成**可区分的**
  // 棋子追:P(12,4)·2⁴ = 190,080。但目标只是「这四条都朝向好」—— 谁在哪个位不影响达标,
  // 也不影响任何一条转动的作用(翻转只看位和转动)。4! 种贴法是同一个态,商掉之后
  // C(12,4)·2⁴ = 7,920,整问题 2.13 亿、nibble 753MB。counts 是商空间的 24 倍还原值,
  // 总数逐次断言 = 5,109,350,400。
  f2leo_cross: {
    // 站内口径:两条 EO 轴取最短(分析器的 min(rot, rot·y))。四条中层棱同属 E 层一个类,
    // 所以「按另一条轴算朝向」在同一个坐标里表达得下来 —— 只是并上 y 共轭那组目标。
    // 与 131.8 万条真题逐档对得上,最大偏差 0.027 个百分点。
    unfixed: {
      W: {
        kind: 'full',
        total: '5109350400',
        counts: ['3336', '50040', '572688', '5883792', '54026472', '396366384',
          '1837667304', '2578068384', '236664768', '47232'],
      },
    },
    // 固定一条轴 —— 站内口径的上界(均值 6.768 vs 6.495),与真题那列不是同一个问题。
    fixed1: {
      W: {
        kind: 'full',
        total: '5109350400',
        counts: ['1680', '25200', '289344', '3021840', '28839744', '230681352',
          '1287282000', '2894881104', '664001160', '326976'],
        noOverlay: {
          zh: '这一格不叠真题对照:底面定死后 EO 还剩两条轴(差一个 y 旋转),本格固定一条轴,'
            + '而真题那列出自 Rust f2leo_analyzer —— 它对两条轴取更短的那条(取最优帧那一格就是它)。'
            + '差距是系统性的:固定轴均值 6.768,两轴取最短 6.495。',
          en: 'No WCA overlay here: with the bottom face fixed, EO still has two possible axes (a y rotation apart). '
            + 'This cell fixes one axis, while the empirical column comes from the Rust f2leo_analyzer, which takes '
            + 'the shorter of the two — that is the best-frame cell. The gap is systematic: 6.768 moves fixed-axis '
            + 'vs 6.495 over both.',
        },
      },
    },
  },
  f2leo_xcross: {},
  f2leo_xxcross: {},
  f2leo_xxxcross: {},
  // ── 伪 F2LEO 十字 ──────────────────────────────────────────────────────
  // 与 F2LEO 十字同一个坐标、同一个 EdgeSet 商,只把目标集按 D / D2 / D' 闭包一次
  // (底十字拼好即可,整体绕 D 轴偏一格不算错)。dist_tracked 的
  // `pseudo_f2leo_cross` / `_1axis`,各 2.6s。与真题逐档最大偏差 0.052 个百分点。
  pseudo_f2leo_cross: {
    unfixed: {
      W: {
        kind: 'full',
        total: '5109350400',
        counts: ['13344', '160128', '1650240', '16478016', '139695264', '869949888',
          '2688265824', '1382214816', '10922688', '192'],
      },
    },
    fixed1: {
      W: {
        kind: 'full',
        total: '5109350400',
        counts: ['6720', '80640', '834816', '8522880', '76372032', '540112704',
          '2229223488', '2184453792', '69743136', '192'],
        noOverlay: {
          zh: '这一格不叠真题对照:与 F2LEO 十字同理,本格固定一条 EO 轴,真题那列对两条取更短。'
            + '固定轴均值 6.314,两轴取最短 6.039。',
          en: 'No WCA overlay here: as with F2LEO cross, this cell fixes one EO axis while the empirical column '
            + 'takes the shorter of the two. 6.314 moves fixed-axis vs 6.039 over both.',
        },
      },
    },
  },
  pseudo_f2leo_xcross: {},
  pseudo_f2leo_xxcross: {},
  pseudo_f2leo_xxxcross: {},
  dr: {},
};

// ── 还没算的格子怎么说话 ────────────────────────────────────────────────────

/** 兜底文案的模板:阶段级的一句话 + 该档的可行性。 */
interface PendingPlan {
  /** 固定单帧那一列的可行性与说明。 */
  frame?: { feasible: ExactPending['feasible']; unit?: string; note: Text };
  /** 取最优帧(站内口径)那几列的说明;不写就用通用那条。 */
  best?: { feasible: ExactPending['feasible']; unit?: string; note: Text };
}

// 'ready'(算法与代码就位、只差机时)这一档目前一个格子都没有 —— E3 本来在这儿,
// 后来发现它根本不用等机时(见 f2leo_cross 那段),2.6s 就跑完了。档位保留在类型里,
// 下一个真要排队的格子直接用;图例按数量为 0 隐藏,不占一行。
const PLAN = (unit: string, zh: string, en: string) =>
  ({ feasible: 'plan' as const, unit, note: { zh, en } });
const OOR = (zh: string, en: string) => ({ feasible: 'oor' as const, note: { zh, en } });

/** 多帧取最优要读整只魔方 —— 十字族之外几乎所有阶段的共同死因。 */
const BEST_TOO_BIG = OOR(
  '多帧取最优要同时知道所有帧的棋子,空间跳出商空间、直奔整只魔方(4.3×10¹⁹),穷举无从谈起',
  'Taking the best over frames needs every frame\'s pieces at once, which leaves the quotient and lands on the '
  + 'whole cube (4.3×10¹⁹) — no enumeration is possible',
);

/**
 * 每个阶段的兜底说法。写不出具体路线的就一句「太大」,别编。
 * 单元号对应 solver/EXACT_DIST_EXPANSION.md 的 backlog 项。
 */
const STAGE_PLAN: Partial<Record<ExactStage, PendingPlan>> = {
  xcross: { best: BEST_TOO_BIG },
  xxcross: { best: BEST_TOO_BIG },
  xxxcross: {
    frame: OOR('固定三槽 4.6×10¹² 个态,visited 位图就要 2.2TB', 'The fixed-3-slot space is 4.6×10¹² states — 2.2 TB just for the visited bitmap'),
    best: BEST_TOO_BIG,
  },
  xxxxcross: { best: OOR('6.95×10¹⁴ 个态,350TB visited', '6.95×10¹⁴ states, 350 TB of visited state') },

  pseudo_xcross: { best: BEST_TOO_BIG },
  pseudo_xxcross: {
    frame: PLAN('P2', '与标准 XXCross 同一个 214 亿坐标,只换目标集(四个 D 偏移)—— 路线现成,表也是 21GB 那一档', 'Same 21.5-billion coordinate as plain XXCross with a four-goal set — the route exists, the table is in the 21 GB class'),
    best: BEST_TOO_BIG,
  },
  pseudo_xxxcross: {
    frame: OOR('同标准 XXXCross,4.6×10¹²', 'Same as plain XXXCross, 4.6×10¹²'),
    best: BEST_TOO_BIG,
  },

  cross_pair: { best: BEST_TOO_BIG },
  xcross_pair: {
    frame: PLAN('E4', '与 XXCross 定双槽同一个 214 亿坐标,BFS 那头 dist_tracked 已经能跑;缺的是把「配好一对」的 17 个目标态从 lib/cross-trainer/pair.ts 导出来喂进去', 'Same 21.5-billion coordinate as fixed-two-slot XXCross, and dist_tracked can already run that BFS; what is missing is exporting the 17 "pair formed" goal states out of lib/cross-trainer/pair.ts and feeding them in'),
    best: BEST_TOO_BIG,
  },
  xxcross_pair: {
    frame: OOR('4.6×10¹²', '4.6×10¹²'),
    best: BEST_TOO_BIG,
  },
  xxxcross_pair: {
    frame: OOR('6.95×10¹⁴', '6.95×10¹⁴'),
    best: BEST_TOO_BIG,
  },

  pseudo_cross_pseudo_pair: { best: BEST_TOO_BIG },
  pseudo_xcross_pseudo_pair: {
    frame: PLAN('P3', '214 亿坐标 + 「D 偏移 × 插入公式」目标集;口径本身还没和 Rust 引擎对齐(1344 里只对上 911),先修口径再谈穷举', '21.5-billion coordinate with a "D-offset × insert" goal set; the definition itself still disagrees with the Rust engine (911/1344), so the parity fix comes first'),
    best: BEST_TOO_BIG,
  },
  pseudo_xxcross_pseudo_pair: { best: BEST_TOO_BIG },
  pseudo_xxxcross_pseudo_pair: { best: BEST_TOO_BIG },

  eo: {},
  eoline: {
    best: PLAN('E6', '一个底色两条线、六色十二条线取最优,要读全部 12 条棱的位置与朝向 —— 12!·2¹¹ = 9.81×10¹¹,和六色底十字同一个量级,同一套走法(dist_cross_6col)能拿下', 'Best over a colour\'s two lines (twelve for CN) needs every edge\'s slot and flip: 12!·2¹¹ = 9.81×10¹¹, the same scale and the same route as colour-neutral cross'),
  },
  eo_cross: {
    best: PLAN('E5', '一个底色两条垂直轴取最优,要 (4 条底棱的有序位置 + 其余按类) × 翻转字 = 1.02×10¹⁰;类商空间这套已经在 lib/eo-axis-dist.ts 上验过(纯 EO 那份),带十字的这版还没写', 'Best over a colour\'s two perpendicular axes needs (ordered slots of the four bottom edges + the rest by class) × the flip word = 1.02×10¹⁰; the class quotient itself is already proven in lib/eo-axis-dist.ts for plain EO, but the version carrying the cross is not written yet'),
  },
  eo_xcross: { best: BEST_TOO_BIG },
  eo_xxcross: {
    frame: OOR('6.87×10¹¹,343GB nibble', '6.87×10¹¹ states, a 343 GB nibble table'),
    best: BEST_TOO_BIG,
  },
  eo_xxxcross: { best: BEST_TOO_BIG },
  eo_xxxxcross: { best: BEST_TOO_BIG },

  f2leo_cross: {
    best: OOR('单色底那格已经算完(两条 EO 轴取最短)。多色底还要跨底面取最优 —— 那要同时知道每个面的十字四棱与各自的中层四棱,跳出商空间',
      'The single-colour cell is done (shortest over both EO axes). More colours means taking the best across bottom faces too, which needs every face\'s cross edges and its own middle four at once — outside the quotient'),
  },
  f2leo_xcross: {
    frame: OOR('再乘 24 个角位 = 1.23×10¹¹', 'Times 24 corner placements = 1.23×10¹¹'),
    best: BEST_TOO_BIG,
  },
  f2leo_xxcross: { best: BEST_TOO_BIG },
  f2leo_xxxcross: { best: BEST_TOO_BIG },
  pseudo_f2leo_cross: {
    best: OOR('单色底那格已经算完(两条 EO 轴取最短)。多色底同 F2LEO 十字:跨底面取最优要同时读每个面的四棱',
      'The single-colour cell is done (shortest over both EO axes). More colours has the same blocker as F2LEO cross: taking the best across faces needs every face\'s four edges at once'),
  },
  pseudo_f2leo_xcross: { best: BEST_TOO_BIG },
  pseudo_f2leo_xxcross: { best: BEST_TOO_BIG },
  pseudo_f2leo_xxxcross: { best: BEST_TOO_BIG },

  fbsquare: {
    best: OOR('一个底色八个 1×2×2 取最优,要 4 个角 + 8 条棱 —— 跳出商空间', 'Best over a colour\'s eight 1×2×2 blocks needs 4 corners and 8 edges — outside the quotient'),
  },
  rouxs1: { best: OOR('一个底色四个 1×2×3 取最优,同上', 'Best over a colour\'s four 1×2×3 blocks — same reason') },
  block222: {
    best: OOR('一个底色四个 2×2×2 取最优,要 4 个角 + 8 条棱 = 6.95×10¹⁴', 'Best over a colour\'s four 2×2×2 blocks needs 4 corners and 8 edges = 6.95×10¹⁴'),
  },
  block223: {
    best: OOR('四个块取最优,跳出商空间', 'Best over the four blocks leaves the quotient'),
  },
  f2b: {
    frame: OOR('两个 1×2×3 = 4 个角 + 6 条棱 = 5.79×10¹²,单帧就已经够不着', 'Two 1×2×3 blocks = 4 corners + 6 edges = 5.79×10¹² — even one frame is out of reach'),
    best: OOR(
      '一个底色两对 1×2×3 取最优,而单帧的 5.79×10¹² 就已经够不着了',
      'Best over a colour\'s two block pairs — and even a single frame\'s 5.79×10¹² is already out of reach',
    ),
  },

  dr: {
    best: PLAN('E7', 'Kociemba 第一阶段那个坐标:2¹¹ × 3⁷ × C(12,4) = 22.2 亿。一个底色只有一条轴,所以单 / 双色底就是定轴那份;四 / 六色底是三条轴取最优,要三条轴的联合', 'Kociemba\'s phase-1 coordinate: 2¹¹ × 3⁷ × C(12,4) = 2.22 billion. A colour has exactly one axis, so the single/dual-colour cells ARE the fixed-axis table; four/six-colour needs the three axes jointly'),
  },
};

const GENERIC_PENDING: Text = {
  zh: '还没算 —— 这一格的空间与算法都还没定下来',
  en: 'Not computed — neither the space nor the route is settled for this cell',
};

/** 没有显式数据的格子,兜底出一个「说得清楚」的 todo。 */
export function pendingCell(stage: ExactStage, slot: ExactSlot): ExactPending {
  const plan = STAGE_PLAN[stage];
  const side = slot === 'unfixed' ? plan?.best : plan?.frame;
  const states = slot === 'unfixed' ? undefined : FRAME_STATES[stage];
  return {
    kind: 'todo',
    feasible: side?.feasible ?? 'plan',
    states,
    note: side?.note ?? GENERIC_PENDING,
    unit: side?.unit,
  };
}

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

/**
 * 这一格有没有底色维度。两种情况没有:
 *
 *   整体(COLOR_FREE)  最优解长度不看你打算把哪个面当底。
 *   任何固定帧          「帧」= (面, 槽 / 轴 / 块)。钉死一个帧就把底面一并钉死了,
 *                      「允许几个底色」这个问题在这一档下根本不存在 —— 换个底色就是换个帧,
 *                      同一条曲线。故这几档每个阶段只存一份,存在 `W` 这个键下;那里的
 *                      `W` 只是**存储位置**,不读作「单色底」。
 *
 * 底色档只在「取最优帧」下才有意义 —— 它决定的正是对多少个帧取 min。
 */
export function isColorFreeCell(stage: string, slot: string): boolean {
  return COLOR_FREE.has(stage) || (slot !== 'unfixed' && isSlotApplicable(stage, slot));
}

/**
 * 定帧那一列里能把**一整档状态列全**的阶段 —— 度量只读固定的那几块,于是它就是
 * lib/cross-trainer/tracked 那台通用穷举 BFS 的一张表,某一档就是那张表的一层。
 *
 * 名单只此一份:引擎那边的帧表按 `ExactCaseStage` 建,漏一个阶段直接编译不过。
 * 名单外的定帧格子不是「不该列」,是浏览器里没有那张整表:2×2×3 15 亿、F2LEO 十字 51 亿
 * 建不起来;XCross / 配对 那几档有表但只到某个深度为止(剪枝式),要列得先有别的路线。
 */
export const EXACT_CASE_FIXED_STAGES = ['fbsquare', 'rouxs1', 'block222', 'eo', 'eoline', 'eo_cross'] as const;
export type ExactCaseStage = typeof EXACT_CASE_FIXED_STAGES[number];

/**
 * 这一格能不能把一档列全:`everyDepth` = 每一档都能,否则只有最深那一档。
 *
 * 只有多色底的「取最优帧」受这个限制 —— 那里的度量是「颜色里取最优」,唯独在最深处
 * 「最好的那个颜色是 d」与「每个颜色都是 d」才是同一句话,别的档求交求的是另一个集合。
 * 定帧与单色底都没有可取最优的东西,每一档都是老老实实的一层。
 */
export function exactCasePlan(
  stage: string, slot: string, subsetKey: string,
): { everyDepth: boolean } | null {
  if (slot === 'fixed1') {
    return (EXACT_CASE_FIXED_STAGES as readonly string[]).includes(stage) ? { everyDepth: true } : null;
  }
  if (slot === 'unfixed' && stage === 'cross') return { everyDepth: subsetKey.length === 1 };
  return null;
}

/**
 * 一档最多这么多个才列(现场枚举 + 逐条现算打乱)。
 *
 * 这是**翻页预算**,不是能力边界 —— 枚举一档只是扫一遍那张已经在内存里的距离表,4 万条也就
 * 几十毫秒;真正受不了的是让人一页 50 条翻下去。定帧那几格的最深档(2×2×2 的 561、1×2×3 的
 * 33,460、EOCross 的 140)都在这个数以内,所以它们该能点的都能点。
 */
export const EXACT_CASE_CAP = 40000;

/** 这一格哪几档能点开看状态。图上按它决定柱子可不可点,守卫测试按它决定查哪几档。 */
export function exactCaseDepths(
  stage: string, slot: string, subsetKey: string, counts: readonly string[],
): number[] {
  const plan = exactCasePlan(stage, slot, subsetKey);
  if (!plan) return [];
  const top = counts.length - 1;
  return counts
    .map((c, d) => ({ n: Number(c), d }))
    .filter(({ n, d }) => n > 0 && n <= EXACT_CASE_CAP && (plan.everyDepth || d === top))
    .map(({ d }) => d);
}

/**
 * 一格的内容。没有显式数据但组合说得通 → 兜底 todo;组合本身不适用 → null。
 * 没有底色维度的格(见 isColorFreeCell)忽略 subsetKey —— 否则底色档一切,
 * 明明算好的固定帧曲线会被读成「还没算」。
 */
export function getExactCell(stage: string, slot: string, subsetKey: string): ExactCell | null {
  const st = EXACT_DIST[stage as ExactStage];
  if (!st) return null;
  if (!SLOT_OK[stage as ExactStage]?.includes(slot as ExactSlot)) return null;
  const colors = isColorFreeCell(stage, slot) ? 'W' : exactColorsOf(subsetKey);
  if (!colors) return null;
  return st[slot as ExactSlot]?.[colors] ?? pendingCell(stage as ExactStage, slot as ExactSlot);
}

/**
 * 这一格的 0 步状态数。完整分布取 counts[0],「仅 0 步」格取 zero,还没算的格子没有 ——
 * 两种格子的 0 步是同一个量,消费方(容斥守卫、速查表对账)不该各写一遍这个三元。
 */
export function zeroStates(cell: ExactCell): string | null {
  if (cell.kind === 'full') return cell.counts[0];
  return cell.kind === 'zero' ? cell.zero : null;
}

/** 该 (stage, slot) 在这个阶段说得通 —— 用来区分「不适用」与「未计算」。 */
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
  const scaled = Number((BigInt(count) * SCALE) / BigInt(total)) / SCALE_N;
  // 比 1e-14 还小的档定标后直接归零(整解那张理论表:d ≤ 9 对 4.3e19 的分母,
  // 最小一档 2.3e-20)。这种量级只用于显示,退回浮点相除 —— 双精度还有 16 位有效数字。
  return scaled > 0 ? scaled : Number(count) / Number(total);
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

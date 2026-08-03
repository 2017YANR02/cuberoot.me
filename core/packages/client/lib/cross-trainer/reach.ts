/*
 * cross-trainer/reach — 一个 (阶段 × 底色档 × 槽档) 的步数上限,分成两个数,因为它们回答的是
 * 两个不同的问题:
 *
 *   god   这个难度**存在**吗?滑块的刻度轴到此为止。
 *   draw  这个难度**抽得出来**吗?超过它的刻度照样画,但置灰不可选。
 *
 * 分开的理由:多底色 /「最优槽」的度量是多个帧上的**最小值**,要取到深值就得所有帧同时深。
 * 「双色底 XCross 10 步」= 白、黄两色四槽全部 10 步 —— 站内 `xcross_2_col_10f` 语料(127 万条)
 * 整批都是这种状态,所以它确实存在;但均匀抽样撞上它的概率约 1e-8,给它 30 秒也抽不出来。
 * 旧版只留一个数,于是滑块干脆不标 9、10,看上去像「站内认为没有」—— 那是错的。
 *
 * 只按底色**个数**分档:picker 给的双色都是对面色(WY/BG/OR)、四色都是它们的补集,同档内互为
 * 共轭,可达性一致。
 */

import { corpusDepths } from './corpus';

/** 槽档:定槽(or18 口径)或四槽/槽对取最优(站内口径)。 */
export type SlotMode = 'fixed' | 'best';

/** 底色档 = picker 的四行。 */
export const COLOR_COUNTS = [1, 2, 4, 6] as const;
export type ColorCount = (typeof COLOR_COUNTS)[number];

/** 索引 = COLOR_COUNTS 的下标。 */
type ByColor = [number, number, number, number];
interface StageReach {
  fixed: ByColor;
  best: ByColor;
}

/**
 * 上帝之数的**下界**:站内 `stats/scramble/distribution.json` 八个数据集(WCA 全量 132 万 + 各
 * 项目切片 + 定向收集的 `xcross_2_col_10f` 127 万条「双色底 10f xcross」)里该 (阶段, 底色档)
 * 实际出现过的最大值。每个数字背后都有真实状态,所以它是「至少能到这么深」的证据,不是估计。
 *
 * 口径是**最优槽**(distribution 的 XCross 一族就是四槽取最优),定槽只会更深或相等,所以同一个
 * 数字对 fixed 也是合法下界。
 *
 * 重新生成:distribution.json 换了就重跑
 *   python 脚本见 docs/cross-trainer-difficulty.md §5
 */
export const TRAINER_GOD: Record<string, ByColor> = {
  'std/cross': [8, 8, 8, 8],
  'std/xcross': [10, 10, 10, 10],
  'std/xxcross': [12, 12, 11, 11],
  'eo/eo_cross': [10, 10, 10, 10],
  'pair/cross_pair': [9, 9, 9, 8],
  'pair/xcross_pair': [11, 11, 10, 10],
  'pseudo/pseudo_cross': [8, 8, 7, 7],
  'pseudo/pseudo_xcross': [9, 9, 9, 9],
  'pseudo_pair/pseudo_cross_pseudo_pair': [8, 8, 7, 7],
  // 后三个不是从 distribution.json 读的 —— 它们的单帧空间小到能整表 BFS,所以证据更强:
  // 每格取「40 万次均匀抽样里见过的最深」与「实际抽出来过的最深」的较大者,而单帧直径
  // (EO 7 / EOLine 9 / block222 8)又是所有帧取最小值的天花板。凡是打到直径的格子就不只是
  // 下界,是**准确值**:eo 全部四档、eoline 单色、block222 单色定槽。
  'eoline/eo': [7, 7, 7, 7],
  'eoline/eoline': [9, 7, 7, 7],
  '222/block222': [7, 7, 7, 7],
};

/**
 * 实测:按线上一条打乱的预算(`GEN_BUDGET_MS` = 3 s)**连抽 5 次都中**的最大步数。
 * 比 god 浅的那一段就是置灰区。重测脚本见 docs/cross-trainer-difficulty.md 附录 A;
 * 守卫见 tests/cross_trainer_reach.test.ts(同样用 3 s 预算,允许像取题池那样重试)。
 */
const DRAW: Record<string, StageReach> = {
  'std/cross': { fixed: [8, 8, 7, 7], best: [8, 8, 7, 7] },
  'std/xcross': { fixed: [10, 9, 9, 9], best: [9, 9, 8, 8] },
  'std/xxcross': { fixed: [11, 11, 11, 10], best: [10, 10, 10, 10] },
  'eo/eo_cross': { fixed: [10, 9, 9, 8], best: [10, 9, 9, 8] },
  'pair/cross_pair': { fixed: [9, 8, 8, 7], best: [8, 8, 7, 7] },
  'pair/xcross_pair': { fixed: [10, 10, 9, 9], best: [9, 9, 9, 8] },
  'pseudo/pseudo_cross': { fixed: [8, 8, 7, 6], best: [8, 8, 7, 6] },
  'pseudo/pseudo_xcross': { fixed: [9, 9, 8, 8], best: [8, 8, 8, 8] },
  'pseudo_pair/pseudo_cross_pseudo_pair': { fixed: [8, 8, 7, 7], best: [8, 7, 7, 6] },
  // 枚举型阶段:单帧任何一层都是 O(1) 抽,所以 draw 直接顶到 god,一格不置灰。
  // eo / eoline 没有槽维度(面板不显示槽选择器),两行相同只是为了对齐类型。
  'eoline/eo': { fixed: [7, 7, 7, 7], best: [7, 7, 7, 7] },
  'eoline/eoline': { fixed: [9, 7, 7, 7], best: [9, 7, 7, 7] },
  // 两个对面色的四个块合起来就是全部 8 个块,所以 best 的双 / 四 / 六色三档必然相同。
  '222/block222': { fixed: [8, 8, 7, 7], best: [7, 7, 7, 7] },
};

/**
 * 单帧(单色 + 定槽)真最大值,且**有穷举依据**的那些 —— 全空间距离表或完整 BFS 数出来的,
 * 不是搜索用的上界。这一格没有语料也知道答案:它就是该阶段被枚举过的直径。
 *
 * XXCross 与 XCross+配对**不在此列**:`XXCROSS_MAX_DEPTH = 13` / `XPAIR_MAX_DEPTH = 11` 是
 * or18 报的数,`multi.ts` / `xpair.ts` 都注明「只当搜索上界,没验证过」,拿它当「已知存在的最深」
 * 会在滑块上画出一格没有任何证据的刻度。那两个阶段照样退回语料证据。
 */
const FRAME_MAX_VERIFIED: Record<string, number> = {
  'std/cross': 8,
  'eo/eo_cross': 10,
  'pseudo/pseudo_cross': 8,
  'pair/cross_pair': 9,
  'pseudo/pseudo_xcross': 10,
  '222/block222': 8,
};

const colorIndex = (n: number): number => {
  let idx = 0;
  for (let i = 0; i < COLOR_COUNTS.length; i++) if (COLOR_COUNTS[i] <= n) idx = i;
  return idx;
};

export interface DepthBounds {
  /** 滑块刻度到这里(已知存在的最深)。 */
  god: number;
  /** 真能出题的步数,升序。中间的空档 = 存在、但既抽不出来也没被枚举 —— 刻度照画,置灰。 */
  allowed: number[];
}

/**
 * 该组合的刻度轴与可选档。表里没有的阶段(新增还没测)整段全开 —— 新阶段先给全,
 * 而不是被一张空表卡死。
 *
 * 可选档有两个来源,它们是两回事:
 *   抽  [min, draw] —— 采样够得着的那一段,连续。
 *   枚举 corpusDepths —— 采样够不着但整档能列全的那几个点(六色底十字 8 / 六色底 XCross 10)。
 * 所以 allowed 可能不连续:六色底 XCross 到 8 能抽、9 抽不到也没枚举、10 有那 438 个。
 */
export function trainerDepthBounds(
  variant: string, stage: string, colors: number, slot: SlotMode, fallback: number, min = 0,
): DepthBounds {
  const key = `${variant}/${stage}`;
  const i = colorIndex(colors);
  const god = TRAINER_GOD[key];
  const draw = DRAW[key];
  const listed = corpusDepths(variant, stage, COLOR_COUNTS[i], slot).filter((d) => d <= fallback);
  if (!god || !draw) {
    return { god: fallback, allowed: rangeOf(min, fallback) };
  }
  // 刻度轴的顶 = 四种证据里最强的一条:语料里出现过、我们自己抽出来过、这一格被穷举过、
  // 或者整档已经列全了。四条都是「有东西在那儿」的证据 —— 绝不拿只当搜索上界用的常数充数
  // (见 FRAME_MAX_VERIFIED)。
  const top = Math.min(fallback, Math.max(
    god[i],
    draw[slot][i],
    ...listed,
    slot === 'fixed' && colors <= 1 ? (FRAME_MAX_VERIFIED[key] ?? 0) : 0,
  ));
  const sampled = Math.min(top, draw[slot][i]);
  const allowed = new Set([...rangeOf(min, sampled), ...listed.filter((d) => d <= top)]);
  return { god: top, allowed: [...allowed].sort((a, b) => a - b) };
}

const rangeOf = (a: number, b: number): number[] =>
  (b < a ? [] : Array.from({ length: b - a + 1 }, (_, k) => a + k));

/** 把一个步数夹到最近的可选档(滑块拖过空档时用)。 */
export function snapAllowed(v: number, allowed: number[]): number {
  if (!allowed.length) return v;
  let best = allowed[0];
  for (const a of allowed) if (Math.abs(a - v) < Math.abs(best - v)) best = a;
  return best;
}

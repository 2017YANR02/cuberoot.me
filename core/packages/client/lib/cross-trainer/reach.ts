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
};

const colorIndex = (n: number): number => {
  let idx = 0;
  for (let i = 0; i < COLOR_COUNTS.length; i++) if (COLOR_COUNTS[i] <= n) idx = i;
  return idx;
};

export interface DepthBounds {
  /** 滑块刻度到这里(已知存在的最深)。 */
  god: number;
  /** 到这里为止可选,再深的刻度置灰。 */
  draw: number;
}

/**
 * 该组合的两个上限。表里没有的阶段(新增还没测)两个都退 fallback —— 新阶段先全开,
 * 而不是被一张空表卡死。
 */
export function trainerDepthBounds(
  variant: string, stage: string, colors: number, slot: SlotMode, fallback: number,
): DepthBounds {
  const key = `${variant}/${stage}`;
  const i = colorIndex(colors);
  const god = TRAINER_GOD[key];
  const draw = DRAW[key];
  if (!god || !draw) return { god: fallback, draw: fallback };
  // 刻度轴的顶 = 三种证据里最强的一条:语料里出现过、我们自己抽出来过、或者这一格被穷举过。
  // 三条都是「有东西在那儿」的证据 —— 绝不拿只当搜索上界用的常数充数(见 FRAME_MAX_VERIFIED)。
  const top = Math.min(fallback, Math.max(
    god[i],
    draw[slot][i],
    slot === 'fixed' && colors <= 1 ? (FRAME_MAX_VERIFIED[key] ?? 0) : 0,
  ));
  return { god: top, draw: Math.min(top, draw[slot][i]) };
}

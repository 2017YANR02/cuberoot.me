/**
 * 把智能魔方记下来的那条流写成人看的谱子 —— 中层还原 + 消掉它带来的换名。
 *
 * ## 魔方报的是「相对核心」的转动
 *
 * 六个面各有一圈编码器,报的是**这一层相对中心核转了多少**。所以:
 *
 *   - 转体(x/y/z):所有层跟着核心一起动,一手也不报 —— 现有代码已经知道这件事。
 *   - **中层(M/E/S):报成一对相对面。** 做 `S` 的时候手按住前后两层、把中间那层
 *     拧过去,实际是**核心转了**,于是前后两层相对核心各转了一下:魔方报 `F' B`。
 *     而且核心转过去之后**后面每一手都被换了名** —— 人手上的 `U2'` 会被报成 `L2'`。
 *
 * 这不是推测。用户报的那把:他做的是 `R2 U' S' U2' S U' R2`(公式库里 U- perm 的
 * 第一条),报告里印出来的是
 *
 *     L2 U'  B F'  L2  F B'  U' L2 U2
 *              ↑    ↑    ↑
 *            第一个 S'  被换名的 U2'   第二个 S
 *
 * 两个中层各自变成一对相对面,夹在中间的 `U2'` 被换名成 `L2'` —— 一手不差。所以那行
 * 谱子既不像 U- perm,也不像任何公式,因为它根本不是在人的视角里写的。
 *
 * ## 做法
 *
 * 从左往右扫,维护一个「到这里为止核心一共转了多少」的 ρ:
 *
 *   - 普通一手 `r`:输出 `ρ r ρ⁻¹`(把它搬回人的视角),ρ 不变;
 *   - 相对面一对 `r r'` 且能拆成 `s·σ`(中层 + 转体):输出 `ρ s ρ⁻¹`,`ρ ← ρ·σ`。
 *
 * 拆分表不手写,拿魔方模型现搜:对每一种相对面组合,枚举 9 个中层 × 9 个转体,找
 * 作用完全相同的那一对。解唯一(两个解相除会得到「一个中层等于一个转体」)。
 *
 * 末尾会剩一个累积的整体旋转,直接丢掉:这把最后是**复原态**,复原态转过去还是
 * 复原态,谱子不写收尾转体也是通行写法。丢掉之前 `rotation` 会把它报出来,
 * 测试拿它验「重写前后作用完全一致」。
 *
 * ## 什么时候才敢合
 *
 * 光看动作流是分不出来的:真做了一个 `S'`,和真的分两手拧了 `B'` 再 `F`,报上来
 * **逐字相同**。所以判据得从别处来。
 *
 * ### 主判据:中心块必须回家(算出来的,常开)
 *
 * 中层会把中心块转走,而**每个步骤边界上中心块都必须在家**:十字要和中心块对上才
 * 算十字,一对 F2L 要和中心块对上才算插好,OLL / PLL 更是 —— 末层公式净转了中心块
 * 的话,已经拼好的 F2L 就跟着错位了。所以有
 *
 *     一个步骤之内,那些中层带的核心旋转,乘起来必须是恒等。
 *
 * 这不是阈值,是定理(WCA 打乱只有面转,所以起点的中心块也是在家的)。判据于是变成
 * 一道小搜索:在这一步里挑一组互不重叠的相对面对,要求它们的旋转乘积抵消,并且合得
 * 最多。用户那把 PLL 里两对分别是 `z` 和 `z'`,只有「两对都合」和「一对都不合」抵消
 * 得掉,前者合得多 —— 于是 `R2 U' B' F R2 F' B U' R2` 被写回 `R2 U' S' U2 S U' R2`。
 * 只合一对(旧的时间判据恰好这么干过)乘出来是 `z`,直接出局。
 *
 * 附带一条更要紧的性质:**判错也漏不出这一步**。抵消掉的 ρ 到边界就归零,下一步的
 * 记号不会跟着错。旧判据没有这条约束,漏掉一对就把后面**整把**换了名。
 *
 * ### 姿态流只做加法:实测证据不能降低代数解的质量
 *
 * 中层的定义就是核心转过去,两手真转则核心一动不动。所以姿态流在这一对的时间窗里
 * **认下了一次核心换格**,就是直接的物理证据。它先产生一份「这些位置必须合」的
 * 候选方案；只有这份方案比纯代数方案认出更多中层时才采用。合并数相同时保留代数
 * 方案,避免握持倾斜恰好吸附到另一格后改写一整段记号。
 *
 * 反过来**不成立,而这里返过一次工**:姿态流**没**认出换格,不等于核心没转。中间
 * 隔着三道没在真机上标定过的闸 —— 录制端 4° 死区(`gyro_track.ts`)、进格 35°、
 * 保持 120ms(`rotation_detect.ts`)—— 任何一道漏了,和「真的没转」长得一模一样。
 * 曾经这条阴性读数是有姿态的把的**唯一**判据,于是用户 2026-08-04 那把 U perm 里
 * 两个 S 一个都没合:整个 PLL 姿态流一次换格都没认出来(证据在输出本身 —— 那一行
 * 连一个转体记号都没有,而没被中层认领的换格一定会被打印出来)。
 *
 * 两种判错的代价也不对等:少合(把 `S` 写成 `F' B`)出来的是没人读得懂的一行,而且
 * 一对里只漏一个就把这一步后面全换错名;多合(把两手真转写成 `S`)出来的是**同一个
 * 置换的另一种写法**,ρ 照样在边界归零。所以阴性读数不给否决权。
 *
 * 钉死的那些自己抵不掉时(比如一个孤零零的、实测过的 `M2`),以实测为准 —— 定理只对
 * 「不净转中心块的步骤」成立,而实测说这一步就是净转了。没有实测时这条退路走不到:
 * 「一对都不合」永远是一个恒等解。
 *
 * **时间彻底退场。** 它曾经是唯一判据,而那两个没在真机上标定过的毫秒数把用户那把
 * PLL 拦下来过一次。定理不需要标定,也不需要设备时钟 —— 那些时间戳只是通知到达时间
 * 的牌子,现在和有时钟的牌子一样准。
 *
 * ## 转体也在这一趟里
 *
 * 转体(x/y/z)和中层带的核心转动是同一个量的两种来源,所以必须在**同一个 ρ** 上
 * 记账:先前转体是在这个文件之外插进谱子的,插完不换名 —— 于是一条带转体的谱子
 * 照着拧出来是错的(`y` 后面那些手仍按转之前写)。现在两者一起走:
 *
 *   - 中层:ρ ← ρ·σ,σ 从拆分表来(算出来的,不用姿态流);
 *   - 转体:ρ ← ρ·R,R 从姿态流来,写出来的是 `ρ R ρ⁻¹`。
 *
 * 两条一模一样,因为它们本来就是一件事:「从这里往后,我写谱子的那个系,相对魔方
 * 报名字的那个系,转过去了。」
 *
 * ## 相邻的同族要并起来 —— 而且必须排在认中层**之后**
 *
 * `M2` 是一个手势,但编码器按四分之一圈报,常常报成 `R L' R L'` 两对 —— 拆完就是
 * `M M`。人不会那么写。所以合完之后紧挨着的同族按四分之一圈相加(满四圈的直接
 * 抵消掉)。中间隔着转体的不并:那两下之间人把魔方转过,不是一个手势;跨步骤边界
 * 的也不并 —— 边界是表和谱子共用的那把刀。
 *
 * 面也走这一条,原因不是对称好看,是**顺序**:合同面以前在 `htmMoves` 里,排在认
 * 中层之前。用户 2026-08-04 那把 Z perm 报上来是 `L R' | R' L | U U | ...`,中间那对
 * `R' R'` 先被合成 `R2`,`L R2 L` 就再也配不出两个 M —— 印出来是
 * `R2 L D2 M D M2 D L R2 L U M U2`,谁也认不出那是 Z perm。所以这一层现在吃的是
 * **一手一条**的四分之一转流(`htm.ts` 的 `quarterMoves`),先认中层,再合同族。
 * 计步仍然走 `htmMoves`(魔方确实转了那么多下面)。
 *
 * ## 只改谱子,不改数字
 *
 * 重写只作用在**文字复盘**上。分步分析表里的步数照旧数物理面转(魔方真的转了两下,
 * 效率对比也是按面转算的),所以一行谱子可能比表里的步数**少一个记号** —— 少的那个
 * 就是被写成中层的那一对。步骤边界一手没动:合并不许跨过 `boundaries`。
 */

import { sliceSplitTable } from '@/lib/slice-pair';
import type { SliceSplit } from '@/lib/slice-pair';

import { coreTurnsIn } from './core_track';
import type { CoreTrack } from './core_track';
import type { HtmMove } from './htm';
import { conjugateToken, facePermFor, CUBE_FACES } from './orient';
import type { CubeFace, FacePerm } from './orient';

export interface HumanizeOptions {
  /**
   * 原始流里的步骤边界(每一步最后一手的下标)。跨过边界的一对不合 —— 合了会把
   * 一个记号从后一步挪到前一步,而边界是分步分析表和这里共用的那把刀。
   *
   * 它还有第二个身份:**中心块必须回家的那条线**。合并方案按边界分段搜,每一段里的
   * 旋转乘积要抵消,见文件头。
   */
  boundaries?: ReadonlySet<number>;
  /**
   * 这把的核心轨迹(姿态流)。给了它:实测到核心换格的相对面对成为增量候选,只有能
   * 比纯代数方案认出更多中层时才采用；转体也一并写进谱子。不给 = 没录姿态,中层
   * 全靠定理配、一个转体也不写。
   *
   * 注意它只做加法:**没**实测到换格不构成「这不是中层」的证据,见文件头。
   */
  core?: CoreTrack | null;
}

/** 一次写进谱子的转体。 */
export interface HumanRotation {
  /** 发生的时刻(距起表毫秒),和动作流同一根轴 —— 调用方按它插进对应那一行。 */
  tMs: number;
  /** 人的视角里的记号,如 `y` / `x'`。 */
  token: string;
  /** 只有被动作流独立证实的宽层事件，才允许吸收相邻外层动作。 */
  wide?: true;
}

export interface HumanizedStream {
  /** 重写后的流。合掉的那一对变成一条,`startIdx`/`endIdx` 覆盖原来两条的范围。 */
  moves: HtmMove[];
  /** 合了几对。0 = 一个中层都没认出来。 */
  merges: number;
  /**
   * 累积下来、没有写进谱子的整体旋转。`原流 ≡ 重写后的流 + 这个旋转`,测试拿它
   * 验等价性。`''` = ρ 从头到尾没动过。
   */
  rotation: string;
  /** 人做的那些转体(中层带的已经减掉了),按时刻。没有姿态流时是空数组。 */
  rotations: HumanRotation[];
  /**
   * **中心块那条判据没能定下来**的相对面对数:摆在那里像中层,但把它当中层会让这一
   * 步的旋转乘积对不上恒等,于是只能按两手真转写。
   *
   * 它们是这一层剩下的全部不确定性。合上的那些不算 —— 那是算出来的(或者姿态流实测
   * 钉死的),不是猜的。没合上的这些则两种可能都说得通:要么人真的分两手拧了,要么
   * 这一步里还有一个中层没被认出来配对。
   *
   * 所以这个数是给 UI 用的:>0 且这把没录姿态,就该明说一句,而不是默默端上去。
   * 录了姿态的把也可能 >0(那一对既没被实测钉死、又配不成对),但那时用户手里已经
   * 有姿态这条线索了,提示词不适用 —— 所以 UI 只在没姿态流时才拿它说话。
   */
  blindPairs: number;
}

/**
 * 逆序列。`conjugateToken(t, facePermFor(ρ))` 算的是 `ρ⁻¹ t ρ`(换名:同一个物理层
 * 在**转过 ρ 之后**那个系里叫什么),而这里要的是反向的 `ρ t ρ⁻¹` —— 把魔方系里的
 * 记号搬回人的系。所以喂给它的是 ρ 的逆。
 */
function invertRotation(seq: string): string {
  return seq.trim().split(/\s+/).filter(Boolean).reverse()
    .map(t => (t.endsWith("2'") ? t.slice(0, -1) : t.endsWith('2') ? `${t}'`
      : t.endsWith("'") ? t.slice(0, -1) : `${t}'`))
    .join(' ');
}

/** 记号是不是「某一面转某个量」。中层 / 转体 / 宽层都不是。 */
function faceToken(token: string): CubeFace | null {
  const m = /^([UDFBLR])(?:2'?|'?)$/.exec(token.trim());
  return m ? (m[1] as CubeFace) : null;
}

/** `M2'` → `{ family:'M', signedQuarters:-2 }`;`R'` → `{ family:'R', signedQuarters:-1 }`。
 *  面和中层用同一条规则拆 —— 「相邻的同族按四分之一圈相加」对两者一字不差。 */
function familyToken(token: string): { family: string; signedQuarters: number } | null {
  const m = /^([UDFBLRMES])(2'?|'?)$/.exec(token.trim());
  if (!m) return null;
  const suffix = m[2];
  return {
    family: m[1],
    signedQuarters: suffix === "2'" ? -2 : suffix === '2' ? 2 : suffix === "'" ? -1 : 1,
  };
}

/** 有向四分之一圈数 → 记号后缀。0 圈的调用方自己处理(那一对抵消了)。 */
function sliceFor(family: string, quarters: number, signedQuarters: number): string {
  if (quarters === 1) return family;
  if (quarters === 2) return `${family}2${signedQuarters < 0 ? "'" : ''}`;
  return `${family}'`;
}

/** 面置换复合:先 `p` 再 `q`。`p[a]=b` 读作「原来在 a 面的东西转到了 b 面」。 */
function composePerm(p: FacePerm, q: FacePerm): FacePerm {
  const out: Record<string, CubeFace> = {};
  for (const f of CUBE_FACES) out[f] = q[p[f]];
  return out as FacePerm;
}

function permKey(p: FacePerm): string {
  return CUBE_FACES.map(f => p[f]).join('');
}

const IDENTITY_PERM = facePermFor('');
const IDENTITY_KEY = permKey(IDENTITY_PERM);

/** DP 的一格:走到这一层、累计旋转是这个的最优走法。 */
interface PlanCell {
  merges: number;
  /** 从哪一层过来的(合并跨两层,不合跨一层)。 */
  fromLayer: number;
  fromKey: string;
  /** 这一步是不是合并;是的话合的就是 `fromLayer` 那个位置。 */
  merged: boolean;
}

/**
 * 一段(两个步骤边界之间)里该合哪几对。
 *
 * 约束是「这一段里中层带的旋转乘起来是恒等」—— 中心块在每个边界上都必须在家,
 * 见文件头。目标是合得最多;同样多的两组保留先搜到的那一组(左边先合)。
 * `forced[i]` 为真的位置是姿态流**实测**到核心换过格的,不给「不合」那条路。
 *
 * 时间在这里一个字都没有。间隔曾经是唯一判据,而那两个没标定过的毫秒数把用户那把
 * PLL 拦下来过一次 —— 现在它连并列裁判都不当:并列在真数据里出不来(一段里的中层
 * 怎么配对,基本被「相邻、同族、能抵消」钉死了),而为出不来的情况留一条没测过的
 * 分支,是给下一个 bug 留位置。
 *
 * DP 的状态是**累计旋转**(只有 24 种),所以段有多长都不会炸。
 */
function planSegment(
  counted: readonly HtmMove[],
  table: ReadonlyMap<string, SliceSplit>,
  forced: readonly boolean[],
  eligible: readonly boolean[],
  from: number,
  to: number,
  chosen: Set<number>,
): void {
  const len = to - from + 1;
  if (len < 2) return;

  const cand: Array<FacePerm | null> = [];
  let any = false;
  for (let p = 0; p < len; p++) {
    const a = counted[from + p];
    const b = p + 1 < len ? counted[from + p + 1] : undefined;
    const split = b ? table.get(`${a.m} ${b.m}`) : undefined;
    if (!split || faceToken(a.m) === null || !eligible[from + p]) { cand.push(null); continue; }
    cand.push(facePermFor(split.rotation));
    any = true;
  }
  if (!any) return;

  const perms = new Map<string, FacePerm>([[IDENTITY_KEY, IDENTITY_PERM]]);
  const layers: Array<Map<string, PlanCell>> = Array.from({ length: len + 1 }, () => new Map());
  layers[0].set(IDENTITY_KEY, { merges: 0, fromLayer: -1, fromKey: '', merged: false });
  const relax = (layer: number, key: string, cell: PlanCell): void => {
    const cur = layers[layer].get(key);
    if (!cur || cell.merges > cur.merges) layers[layer].set(key, cell);
  };

  for (let p = 0; p < len; p++) {
    const sigma = cand[p];
    // 姿态流实测到这一对带着核心换格 —— 那它就是中层,「不合」这条路直接封掉。
    const mustMerge = sigma !== null && forced[from + p];
    for (const [key, cell] of layers[p]) {
      if (!mustMerge) {
        relax(p + 1, key, { merges: cell.merges, fromLayer: p, fromKey: key, merged: false });
      }
      if (!sigma || p + 2 > len) continue;
      const next = composePerm(perms.get(key) as FacePerm, sigma);
      const nk = permKey(next);
      if (!perms.has(nk)) perms.set(nk, next);
      relax(p + 2, nk, { merges: cell.merges + 1, fromLayer: p, fromKey: key, merged: true });
    }
  }

  let layer = len;
  let key = IDENTITY_KEY;
  if (!layers[len].has(key)) {
    // 走到这里只有一种可能:钉死的那些中层自己抵不掉(孤零零一个实测过的 `M2`
    // 之类)。此时以实测为准 —— 定理只对「不净转中心块的步骤」成立,而实测说这一步
    // 就是净转了。没有实测钉死时这条退路走不到:「一对都不合」永远是一个恒等解。
    let best: string | null = null;
    let bestMerges = -1;
    for (const [k, c] of layers[len]) {
      if (c.merges > bestMerges) { bestMerges = c.merges; best = k; }
    }
    if (best === null) return;
    key = best;
  }
  while (layer > 0) {
    const cell = layers[layer].get(key) as PlanCell;
    if (cell.merged) chosen.add(from + cell.fromLayer);
    layer = cell.fromLayer;
    key = cell.fromKey;
  }
}

/**
 * 整条流该合哪几对。按步骤边界切段,每段各自搜。
 * 没有姿态流时 `forced` 全假,搜出来的就是纯定理解。
 */
function planMerges(
  counted: readonly HtmMove[],
  table: ReadonlyMap<string, SliceSplit>,
  forced: readonly boolean[],
  eligible: readonly boolean[],
  boundaries: ReadonlySet<number> | undefined,
): Set<number> {
  const chosen = new Set<number>();
  const n = counted.length;
  let from = 0;
  while (from < n) {
    let to = from;
    while (to < n - 1 && !(boundaries?.has(counted[to].endIdx) ?? false)) to++;
    planSegment(counted, table, forced, eligible, from, to, chosen);
    from = to + 1;
  }
  return chosen;
}

/**
 * 重写一条流。识别不出来的记号原样留着 —— 这一层的失败方式必须是「少写一个中层」,
 * 不能是「多写一个错的」。
 */
export function humanizeStream(
  counted: readonly HtmMove[],
  opts: HumanizeOptions = {},
): HumanizedStream {
  const boundaries = opts.boundaries;
  const table = sliceSplitTable();

  const core = opts.core ?? null;
  // 姿态流实测到核心换格的那些位置:生成一份强制中层的增量方案。**只有阳性读数
  // 算数** —— 没读到不等于没转(三道没标定的闸都能吃掉它),见文件头。
  const forced = counted.map((a, i) => {
    const b = counted[i + 1];
    const split = b ? table.get(`${a.m} ${b.m}`) : undefined;
    return !!core && !!b && !!split
      && coreTurnsIn(core, a.ts, b.endTs, split.rotation).length > 0;
  });
  const eligible = counted.map(() => true);
  // Cross algorithms often contain two unrelated opposite-face turns whose
  // implied centre rotations happen to cancel algebraically. With a recorded
  // core track, require positive physical evidence before rewriting such a pair
  // as M/E/S in the first step; later algorithmic slices keep the algebraic
  // fallback because the sensor may miss a brief middle-layer gesture.
  if (core && boundaries && boundaries.size > 0) {
    const firstBoundary = Math.min(...boundaries);
    for (let i = 0; i < counted.length; i++) {
      if (counted[i].endIdx > firstBoundary) break;
      if (!forced[i]) eligible[i] = false;
    }
  }
  // 「哪几对是中层」整段解出来再走下面这一趟。先求纯代数方案,再求带姿态阳性的
  // 增量方案；判据是中心块必须回家,不是间隔,也不是「姿态流没看见就算没有」。
  const algebraicPlan = planMerges(counted, table, counted.map(() => false), eligible, boundaries);
  const measuredPlan = planMerges(counted, table, forced, eligible, boundaries);
  // 姿态阳性只在它能认出更多中层时介入。相同合并数时纯代数方案已经满足中心
  // 回位,而真机姿态里的短暂倾斜可能恰好落进别的相对面对,不能拿它改写整段。
  const planned = measuredPlan.size > algebraicPlan.size ? measuredPlan : algebraicPlan;

  const out: HtmMove[] = [];
  const rotations: HumanRotation[] = [];
  let merges = 0;
  let blindPairs = 0;
  // ρ:到这里为止核心一共转了多少。记号串,不是置换 —— 置换要复合,串只要接上。
  let rot = '';
  let perm: FacePerm = facePermFor('');

  const rename = (token: string): string => {
    if (rot === '') return token;
    return conjugateToken(token, perm) ?? token;
  };
  /**
   * ρ ← ρ·σ。ρ 是「写谱子的那个系,相对魔方报名字的那个系,转过去了多少」。
   *
   * 中层和转体喂进来的 σ 差一个逆,而这不是符号 bug,是两件不同的事:
   *
   *   - **中层**:身子不动,**核心**转过去 σ —— 写的系没动,报的系动了。
   *   - **转体**:身子和核心一起转 σ —— 报的系(粘在核心/中心块上)相对**写的系**
   *     反过来转了 σ⁻¹。
   *
   * 判据不靠直觉,靠一条等式:`重写后的谱子 · ρ_final ≡ 原流`。两个方向都试过,
   * 只有这一组能让它成立(测试里那条「照着拧还是复原」就是它)。
   */
  const advance = (sigma: string): void => {
    rot = rot === '' ? sigma : `${rot} ${sigma}`;
    perm = facePermFor(invertRotation(rot));
  };

  // 姿态流认下来的每一次核心换格。被某个中层认领掉的划走(那一次已经写成 M/E/S
  // 了),剩下的按时刻写成转体。
  const events = core?.events ?? [];
  const claimed = new Set<number>();
  // Pair by physical rotation first (axis, direction, and directed half-turn).
  // A timestamp is only a tie-breaker between otherwise identical candidates.
  // Each detected core event is consumed at most once; one event may still have
  // supplied positive evidence for adjacent M2 quarter-pairs above.
  for (const i of planned) {
    const a = counted[i], b = counted[i + 1];
    if (!a || !b || !core) continue;
    const split = table.get(`${a.m} ${b.m}`);
    if (!split) continue;
    const pairMid = (a.ts + b.endTs) / 2;
    const match = coreTurnsIn(core, a.ts, b.endTs, split.rotation)
      .filter(idx => !claimed.has(idx))
      .sort((left, right) => (
        Math.abs(events[left].tMs - pairMid) - Math.abs(events[right].tMs - pairMid)
      ))[0];
    if (match !== undefined) claimed.add(match);
  }
  const inverseToken = (token: string): string => (
    token.endsWith("2'") ? token.slice(0, -1) : token.endsWith('2') ? `${token}'`
      : token.endsWith("'") ? token.slice(0, -1) : `${token}'`
  );
  // 握持倾斜有时会被吸附成一次转体又立刻回原格。成对去掉比把中间整段换错面名
  // 安全；真正需要改变记号系的转体不会在不足一秒内原路返回。
  const suppressed = new Set<number>();
  const leftover = events.map((event, idx) => ({ event, idx })).filter(x => !claimed.has(x.idx));
  for (let i = 0; i + 1 < leftover.length; i += 1) {
    const a = leftover[i], b = leftover[i + 1];
    if (a.event.wide || b.event.wide) continue;
    if (b.event.tMs - a.event.tMs <= 750 && inverseToken(a.event.token) === b.event.token) {
      suppressed.add(a.idx);
      suppressed.add(b.idx);
      i += 1;
    }
  }
  // 真机握持漂移可能只在某个格点附近停一百多毫秒就继续走。这种候选不能一律删:
  // 用户这把真正的 y 也只停了 180ms。只把它标成「待复核」,等写到对应动作位置时
  // 比较转体前后紧接着三手的记号；若转体反而把 U/R/L/F 变成 D/B,才判为漂移。
  const briefSettle = new Set<number>();
  for (let i = 0; i + 1 < leftover.length; i += 1) {
    const current = leftover[i], next = leftover[i + 1];
    if (current.event.wide || next.event.wide) continue;
    if (current.event.startMs === undefined || next.event.startMs === undefined) continue;
    if (next.event.startMs - current.event.tMs < 250) briefSettle.add(current.idx);
  }
  const awkwardFaceCost = (token: string): number => {
    const face = /^([UDFBLR])/.exec(token)?.[1];
    return face === 'D' || face === 'B' ? 1 : 0;
  };
  const renamedWith = (token: string, p: FacePerm): string => conjugateToken(token, p) ?? token;
  const makesNextTurnsWorse = (event: (typeof events)[number], token: string): boolean => {
    const nextTurns = counted.filter(move => move.ts >= event.tMs).slice(0, 3);
    if (nextTurns.length < 2) return false;
    const before = nextTurns.reduce((sum, move) => sum + awkwardFaceCost(renamedWith(move.m, perm)), 0);
    const sigma = invertRotation(token);
    const testRot = rot === '' ? sigma : `${rot} ${sigma}`;
    const afterPerm = facePermFor(invertRotation(testRot));
    const after = nextTurns.reduce((sum, move) => sum + awkwardFaceCost(renamedWith(move.m, afterPerm)), 0);
    return after > before;
  };
  // 正常转体在几百毫秒内完成。长事件通常用落格时刻避开前面的握持慢漂；但若事件
  // 区间横跨了已由动作流还原出的中层,说明检测器把「独立转体 + 中层核心运动」并成了
  // 一段。这时开始时刻才是独立转体的位置,不能按结尾把它塞给最后一个中层。
  const eventTime = (event: (typeof events)[number]): number => {
    const start = event.startMs ?? event.tMs;
    if (event.tMs - start <= 1200) return start;
    const spansPlannedSlice = [...planned].some(i => {
      const a = counted[i], b = counted[i + 1];
      return !!a && !!b && a.ts >= start && b.endTs <= event.tMs;
    });
    return spansPlannedSlice ? start : event.tMs;
  };
  let evPtr = 0;
  /** `out` 里从这个下标起才允许和前一条并 —— 转体会把它推到末尾。 */
  let noJoinBefore = 0;
  /** 这一手开始之前还没被认领的换格 = 人在这儿做了转体。 */
  const writeRotationsBefore = (tMs: number): void => {
    while (evPtr < events.length && eventTime(events[evPtr]) <= tMs) {
      const idx = evPtr++;
      if (claimed.has(idx) || suppressed.has(idx)) continue;
      const event = events[idx];
      const token = event.wide ? (event.wideToken ?? inverseToken(event.token)) : event.token;
      // `?` = 复合转体(两次挨太近被并成一步)。宁可不写也不硬塞一个名字 —— 但 ρ
      // 也就跟着不准了,所以这里连 ρ 都不动:写错的谱子比缺一个转体的谱子更糟。
      if (!/^[xyz]/.test(token)) continue;
      if (briefSettle.has(idx) && makesNextTurnsWorse(event, token)) continue;
      rotations.push(event.wide
        ? { tMs: eventTime(event), token: rename(token), wide: true }
        : { tMs: eventTime(event), token: rename(token) });
      if (event.wide) {
        // A wide turn moves the sensor-bearing core while the user's view stays
        // put. The written rotation half of the wide move determines the same
        // face-name update as an ordinary woven rotation.
        advance(invertRotation(token));
        noJoinBefore = out.length;
        continue;
      }
      advance(invertRotation(token));    // 转体的方向和中层相反,见 `advance`
      // 转体把「相邻」打断了:它前后那两手中间人把魔方转过,不是一个手势。
      noJoinBefore = out.length;
    }
  };
  /**
   * 刚写下的这一条能不能和前一条并成一个(`M M` → `M2`,`U U` → `U2`)。并不了就
   * 原样推入。抵消干净的(`M M'` / `R R'`)两条一起去掉 —— 那两下人没写在谱子上,
   * 它们在废动作那一轴。
   *
   * 中层和面走同一条规则,而且必须走同一条:合同面这一步以前在 `htmMoves` 里、
   * 排在认中层**之前**,于是 `L R' R' L`(两个 M)被先合成 `L R2 L`,中层再也配
   * 不出来。现在顺序反过来 —— 谱子这一层吃的是一手一条的四分之一转流
   * (`quarterMoves`),合同面在这里做,排在认中层之后。
   *
   * 三条不许并:跨步骤边界(边界是表和谱子共用的那把刀)、隔着转体(那两下之间人
   * 把魔方转过,不是一个手势)、以及中间夹了别的记号(本来就不相邻)。
   */
  const pushMove = (move: HtmMove): void => {
    const prev = out[out.length - 1];
    const cur = familyToken(move.m);
    const before = prev ? familyToken(prev.m) : null;
    const joinable = prev !== undefined && cur !== null && before !== null
      && before.family === cur.family
      && out.length - 1 >= noJoinBefore
      && !(boundaries?.has(prev.endIdx) ?? false);
    if (!joinable || !cur || !before || !prev) { out.push(move); return; }
    const signed = before.signedQuarters + cur.signedQuarters;
    const net = ((signed % 4) + 4) % 4;
    out.pop();
    if (net === 0) {
      // 抵消干净之后**不许**让两边再并到一起:`R U2 R' R U` 里那对 `R' R` 走掉了,
      // 剩下的 `U2 U` 在原流里隔着两手,不是一个手势。`htmMoves` 也是这条规矩
      // (「只并相邻的」),两边一致,谱子和步数才对得上。
      noJoinBefore = out.length;
      return;
    }
    out.push({
      ...prev,
      m: sliceFor(cur.family, net, signed),
      endTs: move.endTs,
      endIdx: move.endIdx,
      quarters: net === 3 ? 1 : net,
    });
  };

  for (let i = 0; i < counted.length; i++) {
    const a = counted[i];
    const b = counted[i + 1];
    const split = b ? table.get(`${a.m} ${b.m}`) : undefined;
    const pairable = !!split
      && faceToken(a.m) !== null
      && !(boundaries?.has(a.endIdx) ?? false);
    // 合不合只看这一份方案:定理配的 + 姿态流钉死的,都已经在里面了。
    const canMerge = pairable && planned.has(i);
    // 这一对既没被实测钉死、中心块那条判据也没能认下来:两种可能都说得通,记一笔让
    // UI 有机会说出口。合上的那些不记 —— 那是算出来的。
    if (pairable && !canMerge) blindPairs += 1;

    if (canMerge && split && b) {
      // 先认领再写转体:这一对的那次换格是中层带的,不能在它前面漏出一个 `x'`。
      writeRotationsBefore(a.ts);
      pushMove({
        ...a,
        m: rename(split.slice),
        endTs: b.endTs,
        endIdx: b.endIdx,
        // 中层是一手,不是两手 —— 这条只喂谱子,计步照旧走原始 `counted`。
        quarters: split.slice.includes('2') ? 2 : 1,
      });
      advance(split.rotation);
      merges += 1;
      i += 1;
      continue;
    }
    writeRotationsBefore(a.ts);
    pushMove(rot === '' ? a : { ...a, m: rename(a.m) });
  }
  // 最后一手之后还有转体:拧完把魔方摆正。照写 —— 那也是这把发生过的事。
  writeRotationsBefore(Infinity);

  return { moves: out, merges, rotation: rot, rotations, blindPairs };
}

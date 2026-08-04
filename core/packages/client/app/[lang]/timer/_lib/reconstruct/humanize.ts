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
 *     而且核心转过去之后**后面每一手都被换了名** —— 人手上的 `U2` 会被报成 `L2`。
 *
 * 这不是推测。用户报的那把:他做的是 `R2 U' S' U2' S U' R2`(公式库里 U- perm 的
 * 第一条),报告里印出来的是
 *
 *     L2 U'  B F'  L2  F B'  U' L2 U2
 *              ↑    ↑    ↑
 *            第一个 S'  被换名的 U2'   第二个 S
 *
 * 两个中层各自变成一对相对面,夹在中间的 `U2'` 被换名成 `L2` —— 一手不差。所以那行
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
 * **逐字相同**。所以判据得从别处来,而有两个别处:
 *
 * ### 录了姿态的把:问中心核(准的那条)
 *
 * 中层的定义就是核心转过去,两手真转则核心一动不动 —— 这不是相关性,是同一件事的
 * 两个面。所以有 `core` 的时候直接问它:这一对的时间窗里核心换格了没有?换了就是
 * 中层,没换就是两手。判据到此为止,不掺时间。细节见 `core_track.ts`。
 *
 * ### 没录姿态的把:问中心块回没回家(算出来的那条)
 *
 * 中层会把中心块转走,而**每个步骤边界上中心块都必须在家**:十字要和中心块对上才
 * 算十字,一对 F2L 要和中心块对上才算插好,OLL / PLL 更是。所以有
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
 * 记号不会跟着错。旧判据没有这条约束,漏掉一对就把后面**整把**换了名 —— 用户看到的
 * 那段乱码正是这么来的。
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
 * ## 相邻的同一个中层要并起来
 *
 * `M2` 是一个手势,但编码器按四分之一圈报,常常报成 `R L' R L'` 两对 —— 拆完就是
 * `M M`。人不会那么写。所以合完之后紧挨着的同族中层按四分之一圈相加(满四圈的
 * 直接抵消掉)。中间隔着转体的不并:那两下之间人把魔方转过,不是一个手势。
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
   * 没录姿态时它还有第二个身份:**中心块必须回家的那条线**。合并方案按边界分段搜,
   * 每一段里的旋转乘积要抵消,见文件头。
   */
  boundaries?: ReadonlySet<number>;
  /**
   * 这把的核心轨迹(姿态流)。给了它:中层不再靠时间猜,转体也一并写进谱子。
   * 不给 = 没录姿态,退回时间判据、一个转体也不写。见文件头。
   */
  core?: CoreTrack | null;
}

/** 一次写进谱子的转体。 */
export interface HumanRotation {
  /** 发生的时刻(距起表毫秒),和动作流同一根轴 —— 调用方按它插进对应那一行。 */
  tMs: number;
  /** 人的视角里的记号,如 `y` / `x'`。 */
  token: string;
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
   * 没录姿态、而且**中心块那条判据也没能定下来**的相对面对数:摆在那里像中层,但把
   * 它当中层会让这一步的旋转乘积对不上恒等,于是只能按两手真转写。有姿态流时恒为 0。
   *
   * 它们是这一层剩下的全部不确定性。合上的那些不算 —— 那是算出来的,不是猜的
   * (见文件头「问中心块回没回家」)。没合上的这些则两种可能都说得通:要么人真的
   * 分两手拧了,要么这一步里还有一个中层没被认出来配对。
   *
   * 所以这个数是给 UI 用的:>0 且这把没录姿态,就该明说一句,而不是默默端上去。
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
    .map(t => (t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : `${t}'`))
    .join(' ');
}

/** 记号是不是「某一面转某个量」。中层 / 转体 / 宽层都不是。 */
function faceToken(token: string): CubeFace | null {
  const m = /^([UDFBLR])[2']?$/.exec(token.trim());
  return m ? (m[1] as CubeFace) : null;
}

/** `M2` → `{ family:'M', quarters:2 }`。不是中层就是 null。 */
function sliceToken(token: string): { family: string; quarters: number } | null {
  const m = /^([MES])([2'])?$/.exec(token.trim());
  if (!m) return null;
  return { family: m[1], quarters: m[2] === '2' ? 2 : m[2] === "'" ? 3 : 1 };
}

/** 四分之一圈数 → 记号后缀。0 圈的调用方自己处理(那一对抵消了)。 */
function sliceFor(family: string, quarters: number): string {
  return quarters === 1 ? family : quarters === 2 ? `${family}2` : `${family}'`;
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
    if (!split || faceToken(a.m) === null) { cand.push(null); continue; }
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
    for (const [key, cell] of layers[p]) {
      relax(p + 1, key, { merges: cell.merges, fromLayer: p, fromKey: key, merged: false });

      const sigma = cand[p];
      if (!sigma || p + 2 > len) continue;
      const next = composePerm(perms.get(key) as FacePerm, sigma);
      const nk = permKey(next);
      if (!perms.has(nk)) perms.set(nk, next);
      relax(p + 2, nk, { merges: cell.merges + 1, fromLayer: p, fromKey: key, merged: true });
    }
  }

  // 「一对都不合」永远是可行解(空积就是恒等),所以这里一定取得到。
  let layer = len;
  let key = IDENTITY_KEY;
  while (layer > 0) {
    const cell = layers[layer].get(key) as PlanCell;
    if (cell.merged) chosen.add(from + cell.fromLayer);
    layer = cell.fromLayer;
    key = cell.fromKey;
  }
}

/**
 * 整条流该合哪几对(只在没录姿态时用 —— 录了就问核心,那条是实测)。
 * 按步骤边界切段,每段各自搜。
 */
function planMerges(
  counted: readonly HtmMove[],
  table: ReadonlyMap<string, SliceSplit>,
  boundaries: ReadonlySet<number> | undefined,
): Set<number> {
  const chosen = new Set<number>();
  const n = counted.length;
  let from = 0;
  while (from < n) {
    let to = from;
    while (to < n - 1 && !(boundaries?.has(counted[to].endIdx) ?? false)) to++;
    planSegment(counted, table, from, to, chosen);
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
  // 没录姿态:先把「哪几对是中层」整段解出来,再走下面这一趟。判据是中心块必须
  // 回家,不是间隔 —— 见文件头。录了姿态的把逐对问核心,用不上这个。
  const planned = core ? null : planMerges(counted, table, boundaries);

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
  let evPtr = 0;
  /** `out` 里从这个下标起才允许和前一条并 —— 转体会把它推到末尾。 */
  let noJoinBefore = 0;
  /** 这一手开始之前还没被认领的换格 = 人在这儿做了转体。 */
  const writeRotationsBefore = (tMs: number): void => {
    while (evPtr < events.length && events[evPtr].tMs <= tMs) {
      const idx = evPtr++;
      if (claimed.has(idx)) continue;
      const token = events[idx].token;
      // `?` = 复合转体(两次挨太近被并成一步)。宁可不写也不硬塞一个名字 —— 但 ρ
      // 也就跟着不准了,所以这里连 ρ 都不动:写错的谱子比缺一个转体的谱子更糟。
      if (!/^[xyz]/.test(token)) continue;
      rotations.push({ tMs: events[idx].tMs, token: rename(token) });
      advance(invertRotation(token));    // 转体的方向和中层相反,见 `advance`
      // 转体把「相邻」打断了:它前后那两手中间人把魔方转过,不是一个手势。
      noJoinBefore = out.length;
    }
  };
  /** 这一对是中层 → 它那段时间里的换格都归它,不再算成转体。 */
  const claimCoreTurns = (fromMs: number, toMs: number): void => {
    if (!core) return;
    for (const idx of coreTurnsIn(core, fromMs, toMs)) claimed.add(idx);
  };

  /**
   * 刚写下的中层能不能和前一条并成一个(`M M` → `M2`)。并不了就原样推入。
   * 抵消干净的(`M M'`)两条一起去掉 —— 那两下人没写在谱子上,它们在废动作那一轴。
   */
  const pushSlice = (move: HtmMove): void => {
    const prev = out[out.length - 1];
    const cur = sliceToken(move.m);
    const before = prev ? sliceToken(prev.m) : null;
    const joinable = prev !== undefined && cur !== null && before !== null
      && before.family === cur.family
      && out.length - 1 >= noJoinBefore
      && !(boundaries?.has(prev.endIdx) ?? false);
    if (!joinable || !cur || !before || !prev) { out.push(move); return; }
    const net = (before.quarters + cur.quarters) % 4;
    out.pop();
    if (net === 0) return;
    out.push({ ...prev, m: sliceFor(cur.family, net), endTs: move.endTs, endIdx: move.endIdx, quarters: net === 3 ? 1 : net });
  };

  for (let i = 0; i < counted.length; i++) {
    const a = counted[i];
    const b = counted[i + 1];
    const split = b ? table.get(`${a.m} ${b.m}`) : undefined;
    const pairable = !!split
      && faceToken(a.m) !== null
      && !(boundaries?.has(a.endIdx) ?? false);
    // 录了姿态就问核心,没录就照 `planned` 走 —— 两条判据的分工见文件头。
    const byCore = !!core && !!b && coreTurnsIn(core, a.ts, b.endTs).length > 0;
    const canMerge = pairable && (core ? byCore : (planned as Set<number>).has(i));
    // 没录姿态、这一对又没被中心块那条判据认下来:两种可能都说得通,记一笔让 UI
    // 有机会说出口。合上的那些不记 —— 那是算出来的。
    if (pairable && !core && !canMerge) blindPairs += 1;

    if (canMerge && split && b) {
      // 先认领再写转体:这一对的那次换格是中层带的,不能在它前面漏出一个 `x'`。
      claimCoreTurns(a.ts, b.endTs);
      writeRotationsBefore(a.ts);
      pushSlice({
        ...a,
        m: rename(split.slice),
        endTs: b.endTs,
        endIdx: b.endIdx,
        // 中层是一手,不是两手 —— 这条只喂谱子,计步照旧走原始 `counted`。
        quarters: split.slice.endsWith('2') ? 2 : 1,
      });
      advance(split.rotation);
      merges += 1;
      i += 1;
      continue;
    }
    writeRotationsBefore(a.ts);
    out.push(rot === '' ? a : { ...a, m: rename(a.m) });
  }
  // 最后一手之后还有转体:拧完把魔方摆正。照写 —— 那也是这把发生过的事。
  writeRotationsBefore(Infinity);

  return { moves: out, merges, rotation: rot, rotations, blindPairs };
}

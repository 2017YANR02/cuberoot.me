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
 * 光看动作流是分不出来的:真做了一个 `S'`,和真的分两手拧了 `B` 再 `F'`,报上来
 * **逐字相同**。所以判据得从别处来,而有两个别处:
 *
 * ### 录了姿态的把:问中心核(准的那条)
 *
 * 中层的定义就是核心转过去,两手真转则核心一动不动 —— 这不是相关性,是同一件事的
 * 两个面。所以有 `core` 的时候直接问它:这一对的时间窗里核心换格了没有?换了就是
 * 中层,没换就是两手。判据到此为止,不掺时间。细节见 `core_track.ts`。
 *
 * ### 没录姿态的把:退回时间(猜的那条)
 *
 * 中层是一个动作出两个事件,两手是两个动作。GAN v3/v4 的帧自带毫秒计数器(见
 * `move_clock.ts`),所以这个间隔是真的。两条都要过:
 *   - 绝对:间隔 ≤ `MAX_PAIR_GAP_MS`;
 *   - 相对:间隔 ≤ 这把中位间隔的 `MAX_PAIR_GAP_RATIO`。
 *
 * 相对那条是给**没有设备时钟**的牌子兜底的:那些牌子的时间戳是通知到达时间,同一个
 * BLE 包里的几手会挤成 0 间隔 —— 于是中位间隔也接近 0,没有哪一对能「明显更短」,
 * 整条规则自己退化成不合并。宁可少写一个 `S`,不能把两手真转的写成中层再把后面
 * 一整段换名。
 *
 * **这两个数还没在真机上标定过。** 机制本身有用户那把作证,阈值是按「一个动作 vs
 * 两个动作」推的。真机上若发现该合的没合,先调 `MAX_PAIR_GAP_MS` —— 或者干脆把
 * 「录姿态」打开,那条路不需要标定。
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

import { facesEqual, solved } from '../cube/state';
import { applyOneToken } from '../cube/apply_token';
import { coreTurnsIn } from './core_track';
import type { CoreTrack } from './core_track';
import type { HtmMove } from './htm';
import { conjugateToken, facePermFor } from './orient';
import type { CubeFace, FacePerm } from './orient';

/** 一对相对面之间超过这么久就当两个动作。 */
export const MAX_PAIR_GAP_MS = 70;
/** 而且要明显短于这把自己的节奏。 */
export const MAX_PAIR_GAP_RATIO = 0.45;
/**
 * 中位间隔低于这个数就当这条流的时间戳不可信,整把不合并。
 *
 * 40ms 的中位间隔等于 25 TPS —— 人类做不到(世界纪录级也就 13 上下),所以只可能是
 * 时间戳来自**通知到达时间**:没有设备时钟的牌子会把同一个 BLE 包里的几手挤成同一
 * 刻(见 `move_clock.ts` 的头注)。那种流分不出「一个动作」和「两个动作」,只能不合。
 */
export const MIN_MEDIAN_GAP_MS = 40;

const SUFFIXES = ['', "'", '2'] as const;

/** 六种有序相对面。顺序有意义:`F B'` 和 `B' F` 拆出来的转体方向相反。 */
const OPPOSITE: Readonly<Record<CubeFace, CubeFace>> = Object.freeze({
  U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F',
});

const SLICE_TOKENS: readonly string[] = ['M', 'E', 'S'].flatMap(f => SUFFIXES.map(s => `${f}${s}`));
const ROT_TOKENS: readonly string[] = ['x', 'y', 'z'].flatMap(f => SUFFIXES.map(s => `${f}${s}`));

function apply(tokens: readonly string[]) {
  let st = solved(3);
  for (const t of tokens) st = applyOneToken(st, t);
  return st;
}

export interface SliceSplit {
  /** 这一对其实是哪个中层。 */
  slice: string;
  /** 顺带把核心转了多少 —— 后面每一手被换名就是它干的。 */
  rotation: string;
}

let SPLIT_TABLE: Map<string, SliceSplit> | null = null;

/**
 * `"F B'" → { slice: "S'", rotation: 'z' }` 之类。拆不开的组合(比如 `R L`、
 * 或者两边转的量不一样)不在表里。
 *
 * 表是搜出来的不是抄的:抄六个面 × 三个量的符号是给手误留位置,而符号写反的表现
 * 是「谱子看着像公式但拧出来不对」,比现在这个 bug 更难发现。
 */
export function sliceSplitTable(): ReadonlyMap<string, SliceSplit> {
  if (SPLIT_TABLE) return SPLIT_TABLE;
  const t = new Map<string, SliceSplit>();
  for (const a of Object.keys(OPPOSITE) as CubeFace[]) {
    for (const sa of SUFFIXES) {
      for (const sb of SUFFIXES) {
        const t1 = `${a}${sa}`;
        const t2 = `${OPPOSITE[a]}${sb}`;
        const goal = apply([t1, t2]);
        let hit: SliceSplit | null = null;
        for (const slice of SLICE_TOKENS) {
          for (const rotation of ROT_TOKENS) {
            if (facesEqual(apply([slice, rotation]), goal)) { hit = { slice, rotation }; break; }
          }
          if (hit) break;
        }
        if (hit) t.set(`${t1} ${t2}`, hit);
      }
    }
  }
  SPLIT_TABLE = t;
  return t;
}

export interface HumanizeOptions {
  /**
   * 原始流里的步骤边界(每一步最后一手的下标)。跨过边界的一对不合 —— 合了会把
   * 一个记号从后一步挪到前一步,而边界是分步分析表和这里共用的那把刀。
   */
  boundaries?: ReadonlySet<number>;
  maxGapMs?: number;
  maxGapRatio?: number;
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
}

/** 这把的中位手间间隔(ms)。不足两手时是 null。 */
function medianGap(moves: readonly HtmMove[]): number | null {
  const gaps: number[] = [];
  for (let i = 1; i < moves.length; i++) gaps.push(moves[i].ts - moves[i - 1].endTs);
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  return gaps[gaps.length >> 1];
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

/**
 * 重写一条流。识别不出来的记号原样留着 —— 这一层的失败方式必须是「少写一个中层」,
 * 不能是「多写一个错的」。
 */
export function humanizeStream(
  counted: readonly HtmMove[],
  opts: HumanizeOptions = {},
): HumanizedStream {
  const maxGap = opts.maxGapMs ?? MAX_PAIR_GAP_MS;
  const ratio = opts.maxGapRatio ?? MAX_PAIR_GAP_RATIO;
  const boundaries = opts.boundaries;
  const median = medianGap(counted);
  const table = sliceSplitTable();

  const core = opts.core ?? null;

  const out: HtmMove[] = [];
  const rotations: HumanRotation[] = [];
  let merges = 0;
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
    // 录了姿态就问核心,没录才退回时间 —— 两条判据的分工见文件头。
    const gap = b ? b.ts - a.endTs : Infinity;
    const byClock = gap >= 0
      && gap <= maxGap
      && median !== null && median >= MIN_MEDIAN_GAP_MS && gap <= median * ratio;
    const byCore = !!core && !!b && coreTurnsIn(core, a.ts, b.endTs).length > 0;
    const canMerge = pairable && (core ? byCore : byClock);

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

  return { moves: out, merges, rotation: rot, rotations };
}

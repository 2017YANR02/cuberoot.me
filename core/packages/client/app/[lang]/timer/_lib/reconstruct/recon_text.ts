/**
 * 文字复盘 —— 把一把智能魔方的动作流写成 /recon 详情页那种带注释的谱子。
 *
 *     50 HTM / 12.36s = 4.05 TPS
 *     D R' D' R B' U' R' F2 L' F2 D' U2 L' D2 F L' B R'
 *
 *     U R' F R' B2 L            // W cross (1.02)
 *     U F2 R' F2 U2 R           // GR (0.31+1.20)
 *     U B' U2 B                 // RB/ZBLS (0.44+0.62)
 *     ...
 *
 * **一行标注都不是这里写的。** 站里 `/recon/submit` 早就有一整套识别:
 * `lib/stage_detect.ts` 认阶段(cross / xcross / f2l / oll / pll)、
 * `lib/popup_suggest.ts` 的 `buildCommentSuggestions` 把两个局面之差翻译成
 * cubedb 那种标签(`W xcross (OB)`、`GR`、`RB/ZBLS`、`OLL-K2`、`ZBLL-Pi61`、
 * `OLL-K2/PLL Skip`),case 名来自 `lib/{oll,pll,zbll}_lookup.ts`。这套东西已经
 * 对着 cubedb 的真值集校准过。这个模块做的只有一件事:
 *
 *     把 timer 自己的步骤边界翻译成「上一行末局面 / 这一行末局面」两个 KPattern,
 *     交给那个函数,取它排在第一位的建议。
 *
 * 排序不是我们重新定的 —— 弹窗里排第一的那条就是 /recon 认为最该填的那条,
 * 在这里换个挑法等于把复用来的模块又猜一遍。
 *
 * ## 边界用 timer 自己的,不重新切
 *
 * 行的切点 = 表里那几列的切点(十字末手、四对各自末手、OLL 末手、PLL 末手),
 * 直接读 `stage_segments` / `f2l_slots` 已经算好的 `endIdx`。这样文字复盘和
 * 分步分析表**永远是同一把刀切的**:表里第 3 组写 7 步,文字里第 3 组就是 7 个
 * 记号。要是这里另起一套识别去切,两处一旦不一致,用户看到的是两个都不可信的东西。
 *
 * 空的一步(白给的那一对 / OLL 跳过)`endIdx` 是 null,不占一行 —— 一行零个记号
 * 配一个标签是噪声,它在表里已经写着「跳过」了。
 *
 * 唯一一处「表里的步数 ≠ 这里的记号数」是**中层**:魔方把一个 `S` 报成一对相对面,
 * `humanize.ts` 把它写回一个 `S`,于是那一行比表里少一个记号。切点一手没动,少的
 * 那个就是被并进中层的那一半 —— 详见 `humanize.ts` 头注。
 *
 * ## 转体
 *
 * 魔方不报 x/y/z(陀螺仪装在中心核里,转体不改状态字节),所以动作流里没有它们。
 * 录了姿态流的把能从姿态里把它们推出来 —— 但**推出来之后不能只是插进去**:转体
 * 一插,后面每一手都得跟着换名,否则那条谱子照着拧是错的(这正是 Sprint 28 留下
 * 的 bug)。换名的账本 ρ 在 `humanize.ts` 手里(中层也在改它),所以转体现在也交给
 * 它,一趟走完 —— 这里只负责把它给的那几个记号按时刻插回对应的行。
 *
 * 没录姿态的把照旧一个转体也没有:不为它编造任何东西。
 *
 * ## 成本
 *
 * 每个切点算一次 `KPattern`,每一行调一次 `buildCommentSuggestions`(它内部两次
 * `detectStage` + 可能的 OLL/PLL/ZBLL 查表)。7 行的一把 ≈ 8 个 pattern + 7 次识别。
 * 全异步,所以调用方按需算(展开那一节的时候),不要在打开报告时同步等它。
 */

import { patternFromAlg } from '@/lib/cube3';
import { buildCommentSuggestions } from '@/lib/popup_suggest';

import { conjugateCoreTrack } from './core_track';
import type { CoreTrack } from './core_track';
import { htmMoves } from './htm';
import { humanizeStream } from './humanize';
import type { HumanRotation } from './humanize';
import type { F2lSlotsResult } from './f2l_slots';
import { facePermFor } from './orient';
import type { SolveMove, StageSegments } from './stage_segments';
import { stepTimeBounds } from './rotation_detect';
import { tokensForRange } from './step_metrics';
import type { StepMetricsResult } from './step_metrics';

/** 一行属于哪一类。UI 用它决定缩进和配色,和表里的 `tone` 对得上。 */
export type ReconLineKind = 'inspection' | 'cross' | 'f2l' | 'oll' | 'pll';

export interface ReconTextLine {
  kind: ReconLineKind;
  /** 和 `StepAnalysis` 的列 key 同名(`cross` / `slot-FR` / `f2l` / `oll` / `pll`),
   *  这样点表里某一列能高亮文字里对应那一行。 */
  key: string;
  /** 这一行的动作,已按 HTM 合并(和表里的步数格同一口径)。 */
  moves: string[];
  /** 在原始动作流里的闭区间。 */
  fromIdx: number;
  toIdx: number;
  /** `//` 后面那串,不含斜杠。识别不出时是 null —— 宁可留白也不编。 */
  label: string | null;
  recognitionMs: number | null;
  executionMs: number | null;
  stepMs: number | null;
}

export interface ReconTextResult {
  scramble: string;
  lines: ReconTextLine[];
  /** HTM 步数(不是 STM:我们全站按 HTM 计,见 Sprint 17)。 */
  turns: number;
  /**
   * STM 步数 —— 谱子里真写出来的记号数:一个中层算一个(`S`,不是 `F' B`),
   * 转体算零。就是 `turns` 减掉合并掉的那几对。
   *
   * 报告顶上那个数用它,因为读者能对着谱子数出来;效率比对、分步分析表仍然吃
   * `turns`(魔方确实转了两下面,参考解法也是按 HTM 报的),见 `humanize.ts` 头注。
   */
  stm: number;
  seconds: number;
  /** turns / seconds。seconds 为 0 时是 null。 */
  tps: number | null;
  /** 整段文字,可直接粘进 /recon/submit 的动作框。 */
  text: string;
  /**
   * 这把里人做的转体(中层带的核心转动已经减掉了)。谱子里已经写进各行,这里再报
   * 一份是给分步分析表数「每一步转了几次」用的 —— 两处必须是同一份,不然会出现
   * 「文字里有那次转体、表里没有」。
   */
  rotations: HumanRotation[];
  /**
   * 这把里「配不上中层」的相对面对数(见 `humanize.ts` 的 `blindPairs`)。没录姿态
   * 的把才可能非 0。UI 拿它决定要不要说一句「这几处判不准」—— 少认一个中层和正常
   * 输出长得一样,用户看不出来。
   */
  blindPairs: number;
}

/** 一行要切在哪、时间是多少。纯数据,不碰魔方。 */
interface Span {
  kind: ReconLineKind;
  key: string;
  endIdx: number;
  recognitionMs: number | null;
  executionMs: number | null;
  stepMs: number | null;
}

/**
 * 步骤边界,按解法顺序。规则和 `StepAnalysis` 的列一字不差:
 * 十字 →(四对 或 整块 F2L)→ OLL → PLL,`endIdx` 为 null 的一步不占行。
 */
function stepSpans(
  segs: StageSegments,
  metrics: StepMetricsResult | null,
  slots: F2lSlotsResult | null,
): Span[] {
  const step = (k: string) => metrics?.steps.find(s => s.step === k) ?? null;
  const out: Span[] = [];

  const cross = step('cross');
  if (segs.crossEndIdx !== null && segs.crossEndIdx !== undefined) {
    out.push({
      kind: 'cross', key: 'cross', endIdx: segs.crossEndIdx,
      recognitionMs: cross?.recognitionMs ?? null,
      executionMs: cross?.executionMs ?? null,
      stepMs: cross?.stepMs ?? segs.crossMs,
    });
  }

  if (slots && slots.slots.length > 0) {
    for (const s of slots.slots) {
      if (s.endIdx === null) continue;   // 白给的一对:没动作,不占行
      out.push({
        kind: 'f2l', key: `slot-${s.slot}`, endIdx: s.endIdx,
        recognitionMs: s.recognitionMs,
        executionMs: s.executionMs,
        stepMs: s.stepMs,
      });
    }
  } else if (segs.f2lEndIdx !== null && segs.f2lEndIdx !== undefined) {
    const f2l = step('f2l');
    out.push({
      kind: 'f2l', key: 'f2l', endIdx: segs.f2lEndIdx,
      recognitionMs: f2l?.recognitionMs ?? null,
      executionMs: f2l?.executionMs ?? null,
      stepMs: f2l?.stepMs ?? segs.f2lMs,
    });
  }

  for (const k of ['oll', 'pll'] as const) {
    const endIdx = k === 'oll' ? segs.ollEndIdx : segs.solvedEndIdx;
    if (endIdx === null || endIdx === undefined) continue;
    const st = step(k);
    out.push({
      kind: k, key: k, endIdx,
      recognitionMs: st?.recognitionMs ?? null,
      executionMs: st?.executionMs ?? null,
      stepMs: st?.stepMs ?? (k === 'oll' ? segs.ollMs : segs.pllMs),
    });
  }

  // 同一手同时收尾两步(XCross、OLL skip、PLL skip)时后一步的 endIdx 和前一步
  // 相等 —— 那一步一个记号也没有,同样不占行。前面按顺序推入,所以只用比上一个。
  return out.filter((s, i) => i === 0 || s.endIdx > out[i - 1].endIdx);
}

/** `['// GR', '// GR (6)', ...]` → `'GR'`。空数组 → null。 */
function firstLabel(suggestions: string[]): string | null {
  const first = suggestions[0];
  if (!first) return null;
  const bare = first.replace(/^\/\/\s*/, '').trim();
  return bare === '' ? null : bare;
}

/** 括号里那串时间。识别/执行都有就写 `识别+执行`,只有一个数就写那个数。 */
function timeSuffix(line: ReconTextLine): string {
  const s = (ms: number) => (ms / 1000).toFixed(3);
  if (line.recognitionMs !== null && line.executionMs !== null) {
    return ` (${s(line.recognitionMs)}+${s(line.executionMs)})`;
  }
  if (line.stepMs !== null) return ` (${s(line.stepMs)})`;
  return '';
}

/** 一行渲染成 `<动作> // <标签> (<时间>)`。标签缺席时只留动作。 */
export function formatReconLine(line: ReconTextLine): string {
  const moves = line.moves.join(' ');
  if (!line.label) return moves;
  return `${moves} // ${line.label}${timeSuffix(line)}`;
}

export interface ReconTextInput {
  scramble: string;
  moves: SolveMove[];
  totalMs: number;
  segs: StageSegments;
  metrics: StepMetricsResult | null;
  slots: F2lSlotsResult | null;
  /**
   * 这把的核心轨迹(姿态流)。给了它两件事一起变准:中层不再靠时间猜,转体按时刻
   * 插进各行,谱子于是长得和人写的一样:`y R U R' U'`。
   *
   * 转体**不计步** —— HTM 里它是 0 步,表里的步数格也不含它,所以插进来之后
   * 「序列比步数长」本身就是信息(那一步里有转体 / 有废动作),和点列名看动作那条
   * 规则同一套,见 Sprint 20。
   */
  core?: CoreTrack | null;
  /**
   * 同一把在**魔方自己的配色系**里的样子 —— 也就是没有转进「十字朝下」的那一对
   * (`orient.ts` 的 `normalizeSolve` 之前)。不给就当 `scramble`/`moves` 本身就是。
   *
   * 为什么要分开:转视角是把记号**换名**,换完颜色也跟着换 —— 白面被叫成了 D,
   * 而 D 在标准配色里是黄。谱子的**记号**要用换过名的(顶层公式才写成 U 层,和人
   * 手上的动作对得上),但喂给识别器的**局面**必须是真颜色的,否则明明做的白十字
   * 会被标成「Y cross」。
   */
  physical?: { scramble: string; moves: SolveMove[] };
  /**
   * 把 `physical` 转到「十字朝下」的那个整体旋转(`normalizeSolve` 的 `rotation`)。
   * 接在局面末尾 —— 转的是整颗魔方,颜色跟着块走,所以十字落到 D 而且还是白的。
   */
  viewRotation?: string;
}

/**
 * 产出整段文字复盘。异步:识别那一层是 cubing.js 的活。
 *
 * 任何一行识别失败(查表抛异常、打乱有引擎读不了的记号)只让那一行的 `label`
 * 变成 null,不会带走整段 —— 一份只差几个标签的谱子仍然有用。
 */
/**
 * 把转体按时刻插进一行的动作里。
 *
 * 位置靠**时刻**定,而不是靠下标 —— 转体压根不在动作流里,没有下标可用。一次转体
 * 排在「它之后发生的第一手」前面;比这一行所有动作都晚的排在末尾。
 *
 * 记号本身已经是人的视角了(`humanize.ts` 换过名,和它旁边那些动作同一个 ρ),
 * 这里只管摆位置。
 *
 * `lineMoves` 是 `tokensForRange` 已经按 HTM 合并过的记号,和原始动作流不是一一对应
 * (半转会被并成一条),所以插入位置按**原始**动作的时刻算出下标,再按「这是这一行
 * 的第几手」折算到合并后的序列上 —— 合并只会让位置提前,不会把转体挪到别的行去。
 */
function weaveRotations(
  lineMoves: string[],
  rots: readonly HumanRotation[],
  moves: SolveMove[],
  from: number,
  to: number,
): string[] {
  if (rots.length === 0) return lineMoves;
  const n = to - from + 1;
  if (n <= 0) return lineMoves;
  // 原始下标 → 合并后下标。第 k 手原始动作落在合并序列的哪个位置,按比例折算:
  // 合并只会缩短,`lineMoves.length <= n`,所以这个映射单调不减且不越界。
  const mapIdx = (rawOffset: number): number =>
    Math.min(lineMoves.length, Math.round((rawOffset / n) * lineMoves.length));
  const out: string[] = [];
  let cursor = 0;
  const placed = rots.map((r) => {
    let off = 0;
    while (off < n && moves[from + off].ts < r.tMs) off++;
    return { token: r.token, at: mapIdx(off) };
  }).sort((a, b) => a.at - b.at);
  for (const p of placed) {
    while (cursor < p.at) out.push(lineMoves[cursor++]);
    out.push(p.token);
  }
  while (cursor < lineMoves.length) out.push(lineMoves[cursor++]);
  return out;
}

export async function buildReconText(input: ReconTextInput): Promise<ReconTextResult> {
  const { scramble, moves, totalMs, segs, metrics, slots } = input;
  const spans = stepSpans(segs, metrics, slots);
  const counted = htmMoves(moves);
  // 姿态流是魔方自己配色系里的,而 `moves` 已经被 `orient.ts` 转进「十字朝下」——
  // 转体的记号得跟着换,不然谱子里的 `x` 和它旁边的动作不是一个系的。
  const core = input.core
    ? conjugateCoreTrack(input.core, facePermFor(input.viewRotation ?? ''))
    : null;
  // 中层还原 + 转体。魔方按「相对中心核」报手法,所以一个 `S` 到这里是一对相对面 +
  // 后面每一手都被换了名 —— 那行谱子于是不像任何公式。转体同理,而且它和中层改的是
  // 同一个 ρ,所以一趟走完。只重写**写出来的记号**:计步、识别、参考解仍然吃
  // `counted`(魔方确实转了两下面)。
  const humanized = humanizeStream(counted, {
    boundaries: new Set(spans.map(s => s.endIdx)),
    core,
  });
  const rotations = humanized.rotations;
  const shownFor = (from: number, to: number): string[] => (
    tokensForRange(moves, humanized.moves, from, to)
  );

  // 识别走真颜色那一份(见 `physical`);显示走换过名的 `moves`。两者一一对应,
  // 下标通用 —— 换名不增不减记号。
  const phys = input.physical ?? { scramble, moves };
  const physCounted = phys.moves === moves ? counted : htmMoves(phys.moves);
  const viewRot = input.viewRotation ?? '';
  const alg = (...parts: string[]) => parts.filter(t => t.trim() !== '').join(' ');

  // 每个切点一个局面,顺带复用:第 i 行的「上一行末局面」就是第 i-1 行的末局面。
  // 打乱本身算一次(第 0 个),所以 spans.length + 1 个 pattern。
  const rawUpTo = (end: number) =>
    phys.moves.slice(0, end + 1).map(m => m.m).filter(Boolean).join(' ');

  const lines: ReconTextLine[] = [];
  let prevEnd = -1;
  let prevPattern = await patternFromAlg(alg(phys.scramble, viewRot));

  // 这一行的时间窗:上一行最后一手之后 → 自己最后一手为止。第一行往前开口到无穷,
  // 因为起表前后那次「把魔方摆正」属于它。
  let prevEndMs = -Infinity;
  // 时间窗的界和分步分析表用的是同一份规矩(收尾那步开口到无穷),所以共用一个
  // `stepTimeBounds` —— 两边各写一遍迟早会分叉,而分叉的表现是「同一把,文字里
  // 有那次转体、表里没有」。
  const spanEndMs = stepTimeBounds(spans.map(s => s.endIdx), moves);

  for (const [spanIdx, span] of spans.entries()) {
    const from = prevEnd + 1;
    // 识别用的动作和显示用的动作要分开:转体不是转动,喂给识别器会把局面算错、
    // 把步数撑大。识别永远只看 `turnTokens`。
    const turnTokens = tokensForRange(moves, counted, from, span.endIdx);
    const endMs = spanEndMs[spanIdx];
    const mine = rotations.filter(r => r.tMs > prevEndMs && r.tMs <= endMs);
    const lineMoves = weaveRotations(shownFor(from, span.endIdx), mine, moves, from, span.endIdx);
    prevEndMs = endMs;
    const currPattern = await patternFromAlg(alg(phys.scramble, rawUpTo(span.endIdx), viewRot));

    let label: string | null = null;
    try {
      label = firstLabel(await buildCommentSuggestions({
        prevPattern,
        currPattern,
        // 局面是真颜色的,喂给它的动作也必须是同一系的原始记号。
        lineMovesText: tokensForRange(phys.moves, physCounted, from, span.endIdx).join(' '),
        prevMovesText: prevEnd >= 0 ? rawUpTo(prevEnd) : '',
        moveCount: turnTokens.length,
      }));
    } catch (err) {
      console.warn('[recon-text] label failed for', span.key, err);
    }

    lines.push({
      kind: span.kind,
      key: span.key,
      moves: lineMoves,
      fromIdx: from,
      toIdx: span.endIdx,
      label,
      recognitionMs: span.recognitionMs,
      executionMs: span.executionMs,
      stepMs: span.stepMs,
    });

    prevEnd = span.endIdx;
    prevPattern = currPattern;
  }

  // 最后一手之后还有动作(拧过头了、或者切分没走到底)——照实补一行,不丢。
  if (prevEnd < moves.length - 1) {
    const tail = weaveRotations(
      shownFor(prevEnd + 1, moves.length - 1),
      rotations.filter(r => r.tMs > prevEndMs),
      moves, prevEnd + 1, moves.length - 1,
    );
    if (tail.length > 0) {
      lines.push({
        kind: 'pll', key: 'tail', moves: tail,
        fromIdx: prevEnd + 1, toIdx: moves.length - 1,
        label: null, recognitionMs: null, executionMs: null, stepMs: null,
      });
    }
  }

  const turns = counted.length;
  const seconds = totalMs / 1000;
  return {
    scramble,
    lines,
    turns,
    stm: turns - humanized.merges,
    seconds,
    tps: seconds > 0 ? turns / seconds : null,
    text: lines.map(formatReconLine).join('\n'),
    rotations,
    blindPairs: humanized.blindPairs,
  };
}

/** 头一行:`50 HTM / 12.36s = 4.05 TPS`。 */
export function reconTextHeader(r: ReconTextResult): string {
  const tps = r.tps === null ? '–' : r.tps.toFixed(2);
  return `${r.turns} HTM / ${r.seconds.toFixed(2)}s = ${tps} TPS`;
}

/** 剪贴板里那一份:头 + 打乱 + 谱子,和 /recon/submit 的输入格式一致。 */
export function reconTextForClipboard(r: ReconTextResult): string {
  return [reconTextHeader(r), r.scramble, '', r.text].join('\n');
}

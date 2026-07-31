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
 * 分步分析表**永远是同一把刀切的**:表里第 3 对写 7 步,文字里第 3 对就是 7 个
 * 记号。要是这里另起一套识别去切,两处一旦不一致,用户看到的是两个都不可信的东西。
 *
 * 空的一步(白给的那一对 / OLL 跳过)`endIdx` 是 null,不占一行 —— 一行零个记号
 * 配一个标签是噪声,它在表里已经写着「跳过」了。
 *
 * ## 智能魔方没有转体
 *
 * 魔方不报 x/y/z,所以这里几乎不会出现 `// insp` 那一行。逻辑照旧留着(手输动作
 * 的复盘、以后真能推出转体时都会用到),但不为它编造任何东西。
 *
 * ## 成本
 *
 * 每个切点算一次 `KPattern`,每一行调一次 `buildCommentSuggestions`(它内部两次
 * `detectStage` + 可能的 OLL/PLL/ZBLL 查表)。7 行的一把 ≈ 8 个 pattern + 7 次识别。
 * 全异步,所以调用方按需算(展开那一节的时候),不要在打开报告时同步等它。
 */

import { patternFromAlg } from '@/lib/cube3';
import { buildCommentSuggestions } from '@/lib/popup_suggest';

import { htmMoves } from './htm';
import type { F2lSlotsResult } from './f2l_slots';
import type { SolveMove, StageSegments } from './stage_segments';
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
  seconds: number;
  /** turns / seconds。seconds 为 0 时是 null。 */
  tps: number | null;
  /** 整段文字,可直接粘进 /recon/submit 的动作框。 */
  text: string;
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
}

/**
 * 产出整段文字复盘。异步:识别那一层是 cubing.js 的活。
 *
 * 任何一行识别失败(查表抛异常、打乱有引擎读不了的记号)只让那一行的 `label`
 * 变成 null,不会带走整段 —— 一份只差几个标签的谱子仍然有用。
 */
export async function buildReconText(input: ReconTextInput): Promise<ReconTextResult> {
  const { scramble, moves, totalMs, segs, metrics, slots } = input;
  const spans = stepSpans(segs, metrics, slots);
  const counted = htmMoves(moves);

  // 每个切点一个局面,顺带复用:第 i 行的「上一行末局面」就是第 i-1 行的末局面。
  // 打乱本身算一次(第 0 个),所以 spans.length + 1 个 pattern。
  const rawUpTo = (end: number) =>
    moves.slice(0, end + 1).map(m => m.m).filter(Boolean).join(' ');

  const lines: ReconTextLine[] = [];
  let prevEnd = -1;
  let prevPattern = await patternFromAlg(scramble);

  for (const span of spans) {
    const from = prevEnd + 1;
    const lineMoves = tokensForRange(moves, counted, from, span.endIdx);
    const currPattern = await patternFromAlg(
      [scramble, rawUpTo(span.endIdx)].filter(t => t.trim() !== '').join(' '),
    );

    let label: string | null = null;
    try {
      label = firstLabel(await buildCommentSuggestions({
        prevPattern,
        currPattern,
        lineMovesText: lineMoves.join(' '),
        prevMovesText: prevEnd >= 0 ? rawUpTo(prevEnd) : '',
        moveCount: lineMoves.length,
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
    const tail = tokensForRange(moves, counted, prevEnd + 1, moves.length - 1);
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
    seconds,
    tps: seconds > 0 ? turns / seconds : null,
    text: lines.map(formatReconLine).join('\n'),
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

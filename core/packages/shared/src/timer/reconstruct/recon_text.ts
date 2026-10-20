import { decodeGyroTrack, type GyroSample } from '../../smart_cube/gyro_track';
import { canonicalize3x3WideMoves, toMoveStringStrict } from '../../alg_notation';
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
 * ## 边界沿用 timer 的阶段,但不能切开一个物理手势
 *
 * 行的切点 = 表里那几列的切点(十字末手、四对各自末手、OLL 末手、PLL 末手),
 * 先读 `stage_segments` / `f2l_slots` 已经算好的 `endIdx`。唯一修正是:智能魔方把
 * 一个中层/宽层手势报成多条外层通知时,阶段可能在第一条通知后短暂成立;切点必须
 * 推到这个手势的最后一条通知,否则一个 `S` 会被劈到两行、前一行的标签也认不出。
 *
 * 空的一步(白给的那一对 / OLL 跳过)`endIdx` 是 null,不占一行 —— 一行零个记号
 * 配一个标签是噪声,它在表里已经写着「跳过」了。
 *
 * 「表里的步数 ≠ 这里的记号数」主要来自**中层**:魔方把一个 `S` 报成一对相对面,
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

import { patternFromAlg } from '../../recon/cube3';
import { buildCommentSuggestions, crossFamilyCancelInto } from '../../recon/popup_suggest';
import { sliceSplitTable } from '../../recon_slice';
import { detectStage } from '../../recon/stage_detect';
import { solved } from './state';
import { applyOneToken } from './apply-token';
import { isCross, isSolved } from './cfop-detect';

import { buildCoreTrack, conjugateCoreTrack, coreTurnsIn } from './core_track';
import type { CoreTrack } from './core_track';
import { htmMoves, quarterMoves } from './htm';
import { humanizeStream } from './humanize';
import { wastedDisplaySpans } from './error_detect';
import type { HumanRotation } from './humanize';
import { methodFrame, walkMethod } from './method_walk';
import { METHODS, type MethodId } from './methods';
import type { MethodStageMetric } from './method_walk';
import { computeStepMetrics, endsRecognition, metricForRange } from './step_metrics';
import { EVENTS, type EventId } from '../types';
import { computeF2lSlots, type F2lSlotsResult } from './f2l_slots';
import { initialPoseRotation, normalizeSolve, compactCubeRotations, conjugateToken, facePermFor } from './gyro_orient';
import { computeStageSegments, type SolveMove, type StageSegments } from './stage_segments';
import { stepTimeBounds } from './rotation_detect';
import { moveItemsForRange, tokensForRange } from './step_metrics';
import type { RangeMoveItem, StepMetricsResult } from './step_metrics';

/** 一行属于哪一类。UI 用它决定缩进和配色,和表里的 `tone` 对得上。 */
export type ReconstructionType = MethodId | 'training';
export type ReconLineKind = 'inspection' | 'cross' | 'f2l' | 'oll' | 'pll' | 'training';

export interface ReconTextLine {
  /** Explicit phase bounds, including waiting before the first encoder move. */
  fromMs?: number;
  toMs?: number;
  stageKey?: string;
  kind: ReconLineKind;
  /** 和 `StepAnalysis` 的列 key 同名(`cross` / `slot-FR` / `f2l` / `oll` / `pll`),
   *  这样点表里某一列能高亮文字里对应那一行。 */
  key: string;
  /** 显示动作；普通同面动作合并，废步保留原始转动，括号由 wasteGroups 提供。 */
  moves: string[];
  /** Display gestures mapped to lossless encoder ranges/timestamps for playback. */
  moveRanges?: RangeMoveItem[];
  /** Waste group per display token; null denotes an ordinary move. */
  wasteGroups?: Array<number | null>;
  /** Library presentation groups, separate from physically observed waste loops. */
  algorithmGroups?: Array<{ from: number; to: number }>;
  /** Derived correction only; the original notation and timing remain recoverable. */
  libraryCorrection?: { algorithm: string; originalMoves: string[]; originalRanges: RangeMoveItem[];
    originalLine?: Omit<ReconTextLine, 'libraryCorrection'>;
    implicitAuf?: { before: string; after: string } };
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
  /** Confirmed live display projection; later turns must not optimize it again. */
  presentation?: ReconTextResult;
  currentStage?: { key: string; zh: string; en: string };
  /** Method metrics use the exact gesture boundaries rendered by playback. */
  methodStages?: MethodStageMetric[];
  /**
   * **这把真正的打乱** —— 计时器发的那一条,和成绩里存的、和粘到 cubedb 去的
   * 逐字相同。
   *
   * 曾经这里放的是「转进十字朝下」之后共轭过的那一条,理由是谱子写在那个视角里、
   * 配原始打乱对不上。理由本身没错,错的是解决办法:用户 2026-08-04 报的就是这个
   * —— 他做的是 `R2 B' L2 R D' ...`,报告里印出来的是 `R2 F' L2 R U' ...`,
   * 「这不行,必须是原始打乱」。共轭过的那条不是他做的那把打乱,粘到哪里都对不上。
   *
   * 现在换个办法把两边接上:打乱印原始的,视角那一手写成谱子的第一行
   * (`inspection`,`z2 // 观察`),和人写复盘时一模一样 —— 打乱 + 观察转体 + 谱子
   * 三样接起来照着拧,还是这把。
   */
  scramble: string;
  /** Physical face/color of the detected cross, independent of the recorded grip. */
  crossColor?: string;
  /**
   * 观察时把魔方转成「十字朝下」的那一手(`z2` / `x'` / …)。`''` = 不用转。
   *
   * 它是 `orient.ts` 挑的那个 ρ,只是以前只在内部用。写出来之后 `scramble` 才敢印
   * 原始的:谱子后面每一行都在 ρ 之后的那个系里。
   */
  inspection: string;
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

/** The report and native replay must analyze the same physical stream and viewing frame. */
export function prepareReconstruction(record: {
  scramble: string; moves?: SolveMove[]; timeMs: number; gyro?: string; device?: { model?: string };
}, method: MethodId, language: 'zh' | 'en', samples?: GyroSample[]) {
  const moves = record.moves ?? [];
  const gyroSamples = samples ?? decodeGyroTrack(record.gyro);
  const rotation = initialPoseRotation(gyroSamples, record.device?.model);
  const view = method === 'cfop' ? normalizeSolve(record.scramble, moves, {
    preferredRotation: rotation, measuredGrip: gyroSamples[0]?.frame === 'scramble',
  }) : methodFrame(method, record.scramble, moves, rotation);
  const stageSegs = computeStageSegments(record.scramble, moves, record.timeMs);
  const stepMx = stageSegs ? computeStepMetrics(record.scramble, moves, record.timeMs) : null;
  const slots = stageSegs ? computeF2lSlots(record.scramble, moves, record.timeMs, stageSegs) : null;
  const core = gyroSamples.length ? buildCoreTrack(gyroSamples, { brand: record.device?.model, moves }) : null;
  const text: ReconTextInput | null = stageSegs && moves.length ? {
    method, language, scramble: view.scramble, moves: view.moves, totalMs: record.timeMs,
    segs: stageSegs, metrics: stepMx, slots, core, physical: { scramble: record.scramble, moves }, viewRotation: view.rotation,
  } : null;
  return { gyroSamples, view, stageSegs, stepMx, slots, core, text };
}

/** A drill is one algorithm, not a candidate for full-solve method detection. */
function prepareTrainingMetrics(record: {
  event: EventId; scramble: string; moves?: SolveMove[]; timeMs: number; gyro?: string; device?: { model?: string };
}, samples?: GyroSample[], live = false) {
  const raw = record.moves ?? [];
  const gyroSamples = samples ?? decodeGyroTrack(record.gyro);
  // Recover only the viewing grip. Legacy records without a measured grip use
  // the existing cross-face orientation rule; no method or stage walk runs.
  const view = normalizeSolve(record.scramble, raw, {
    preferredRotation: initialPoseRotation(gyroSamples, record.device?.model),
    measuredGrip: gyroSamples[0]?.frame === 'scramble',
  });
  const moves = view.moves;
  const counted = htmMoves(moves);
  const firstExecution = moves.findIndex(move => endsRecognition(move.m));
  const range = moves.length ? metricForRange(moves, counted, -1, 0, moves.length - 1) : null;
  const observationMs = Math.max(0, Math.min(record.timeMs,
    live && firstExecution < 0 ? record.timeMs : range?.recognitionMs ?? record.timeMs));
  const metrics = { observationMs, executionMs: Math.max(0, record.timeMs - observationMs), totalMs: record.timeMs };
  return { gyroSamples, view, moves, counted, firstExecution, observationMs, metrics };
}

/** Immutable completed records keep accumulated statistics linear in new solves. */
const trainingMetricsCache = new WeakMap<object, ReturnType<typeof prepareTrainingMetrics>['metrics']>();

/** Lightweight timing summary with exactly the report's orientation and AUF boundary. */
export function trainingSolveMetrics(record: Parameters<typeof prepareTrainingMetrics>[0]) {
  const cached = trainingMetricsCache.get(record);
  if (cached) return cached;
  const metrics = prepareTrainingMetrics(record).metrics;
  trainingMetricsCache.set(record, metrics);
  return metrics;
}

export function prepareTrainingReconstruction(record: {
  event: EventId; scramble: string; moves?: SolveMove[]; timeMs: number; gyro?: string; device?: { model?: string };
}, language: 'zh' | 'en', samples?: GyroSample[], live = false) {
  const raw = record.moves ?? [];
  const { gyroSamples, view, moves, counted, firstExecution, observationMs, metrics } = prepareTrainingMetrics(record, samples, live);
  const split = firstExecution < 0 ? (live ? moves.length : 0) : firstExecution;
  const rawCore = gyroSamples.length ? buildCoreTrack(gyroSamples, { brand: record.device?.model, moves: raw }) : null;
  const measuredCore = rawCore ? conjugateCoreTrack(rawCore, facePermFor(view.rotation)) : null;
  const core = markWideCoreEvents(measuredCore, measuredCore?.frame === 'scramble' ? wideGestureMoves(moves) : counted);
  const boundaries = new Set([split - 1]);
  const wasteSpans = wastedDisplaySpans(view.scramble, moves, boundaries);
  const preserveMoves = new Set<number>();
  for (const span of wasteSpans) {
    for (let i = span.fromIdx; i <= span.toIdx; i++) preserveMoves.add(i);
  }
  const countedHumanized = humanizeStream(quarterMoves(moves), { core, boundaries });
  const humanized = preserveMoves.size ? humanizeStream(quarterMoves(moves), { core, boundaries, preserveMoves }) : countedHumanized;
  const absorbedRotations = new Set<number>();
  const event = EVENTS.find(event => event.id === record.event);
  const stage = { key: 'training', zh: event?.nameZh ?? record.event.toUpperCase(), en: event?.nameEn ?? record.event.toUpperCase() };
  const observation = { key: 'observation', zh: '观察', en: 'Observation' };
  const lines: ReconTextLine[] = [observation, stage].map((definition, index) => {
    const fromIdx = index === 0 ? 0 : split;
    const toIdx = index === 0 ? split - 1 : moves.length - 1;
    const items = weaveRotations(moveItemsForRange(moves, humanized.moves, fromIdx, toIdx),
      humanized.rotations.filter(rotation => index === 0 ? rotation.tMs < observationMs : rotation.tMs >= observationMs),
      absorbedRotations);
    return {
      kind: index === 0 ? 'inspection' : 'training', key: definition.key, stageKey: definition.key,
      label: definition[language], moves: items.map(item => item.token), moveRanges: playbackRanges(items, moves),
      wasteGroups: items.map(item => {
        const group = wasteSpans.findIndex(span => item.startIdx >= span.fromIdx && item.endIdx <= span.toIdx);
        return group < 0 ? null : group;
      }),
      fromIdx, toIdx, fromMs: index === 0 ? 0 : observationMs, toMs: index === 0 ? observationMs : record.timeMs,
      recognitionMs: 0, executionMs: index === 0 ? 0 : metrics.executionMs,
      stepMs: index === 0 ? observationMs : metrics.executionMs,
    };
  });
  const seconds = record.timeMs / 1000;
  const recon: ReconTextResult = {
    scramble: record.scramble, inspection: view.rotation, lines,
    currentStage: firstExecution < 0 && live ? observation : stage,
    turns: counted.length, stm: countedHumanized.moves.length, seconds,
    tps: metrics.executionMs > 0 ? countedHumanized.moves.length / (metrics.executionMs / 1000) : null,
    text: [...(view.rotation ? [`${view.rotation} // insp`] : []), ...lines.map(formatReconLine)].join('\n'),
    rotations: humanized.rotations.filter(rotation => !absorbedRotations.has(rotation.tMs)), blindPairs: humanized.blindPairs,
  };
  return { type: 'training' as const, view, recon, metrics };
}

/** 一行要切在哪、时间是多少。纯数据,不碰魔方。 */
interface Span {
  label?: string;
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
  moves: readonly SolveMove[],
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

  const ollEnd = segs.ollEndIdx;
  const solvedEnd = segs.solvedEndIdx;
  const oneLookLl = ollEnd !== null && ollEnd !== undefined
    && solvedEnd !== null && solvedEnd !== undefined
    && solvedEnd > ollEnd
    && moves.slice(ollEnd + 1, solvedEnd + 1).every(move => /^U(?:2'?|')?$/.test(move.m));

  if (oneLookLl) {
    const oll = step('oll');
    const pll = step('pll');
    const stepMs = (oll?.stepMs ?? segs.ollMs ?? 0) + (pll?.stepMs ?? segs.pllMs ?? 0);
    const recognitionMs = oll?.recognitionMs ?? null;
    out.push({
      kind: 'oll', key: 'oll', endIdx: solvedEnd,
      recognitionMs,
      executionMs: recognitionMs === null ? null : Math.max(0, stepMs - recognitionMs),
      stepMs,
    });
  } else for (const k of ['oll', 'pll'] as const) {
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

/**
 * A cross/xcross may be complete just before its final U adjustment. When that
 * adjustment is followed by a clear recognition pause, keep it with the cross
 * instead of presenting it as the first move of F2L. This also covers a fast
 * opposite-face follow-through such as `D2 U'` without depending on direction.
 */
function snapCrossAufBeforePause(
  rawEnd: number,
  counted: ReturnType<typeof htmMoves>,
  totalMs: number,
): number {
  const at = counted.findIndex(move => move.endIdx === rawEnd);
  if (at < 0 || at >= counted.length - 1) return rawEnd;
  const next = counted[at + 1];
  if (!/^U(?:2'?|')?$/.test(next.m)) return rawEnd;
  const followingTs = counted[at + 2]?.ts ?? totalMs;
  return followingTs - next.endTs >= 1000 ? next.endIdx : rawEnd;
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
/** A reversible display projection. Raw movements, poses and timing stay untouched. */
export function originalReconNotation(recon: ReconTextResult): ReconTextResult {
  const lines = recon.lines.map(line => {
    if (!line.libraryCorrection) return line;
    const original = line.libraryCorrection.originalLine ?? { ...line, moves: line.libraryCorrection.originalMoves,
      moveRanges: line.libraryCorrection.originalRanges, algorithmGroups: undefined, libraryCorrection: undefined };
    return original.label === line.label ? original : { ...original, label: line.label };
  });
  if (lines.every((line, i) => line === recon.lines[i])) return recon;
  return { ...recon, lines, text: [...(recon.inspection ? [`${recon.inspection} // insp`] : []),
    ...lines.map(formatReconLine)].join('\n') };
}

/** Carry omitted tilts through later moves instead of leaving the cross sideways. */
function reconstructionAlg(tokens: string[]): string {
  return tokens.flatMap(token => token.match(/[RUFLDBrufldbxyzMSE]w?(?:2'?|')?/g) ?? [token]).join(' ');
}

function conjugateReconToken(token: string, perm: ReturnType<typeof facePermFor>): string | null {
  const parts = token.match(/[RUFLDBrufldbxyzMSE]w?(?:2'?|')?/g);
  if (!parts || parts.join('') !== token) return null;
  const mapped = parts.map(part => conjugateToken(part.replace(/^([rludfb])/, face => `${face.toUpperCase()}w`), perm));
  return mapped.some(part => part === null) ? null : mapped.join('');
}

/** Stage-end cross orientation outranks notation preferences, including library algs. */
function restoreCrossAtBoundaries(recon: ReconTextResult, lines: ReconTextLine[]): ReconTextLine[] {
  let state = applyOneToken(solved(3), `${recon.scramble} ${recon.inspection}`);
  const down = recon.crossColor ?? state.D[4];
  let pending = '';
  const inverse = (alg: string) => alg.split(' ').filter(Boolean).reverse()
    .map(token => token.endsWith("'") ? token.slice(0, -1) : `${token}'`).join(' ');
  const result = lines.map(line => {
    const entries: Array<{ token: string; source: number }> = [];
    // Repay a yaw before a matched last-layer algorithm, rather than renaming
    // its M/R moves to S/F. Yaw preserves the cross-down frame.
    if (line.libraryCorrection && (line.kind === 'oll' || line.kind === 'pll')
      && /^y(?:2|')?$/.test(pending)) {
      entries.push({ token: pending, source: -1 });
      pending = '';
    }
    line.moves.forEach((token, source) => {
      const canonical = token.replace(/^([rludfb])/, face => `${face.toUpperCase()}w`);
      const mapped = pending ? conjugateReconToken(canonical, facePermFor(inverse(pending))) : token;
      if (mapped === null) throw new Error('Unsupported reconstruction move');
      // Apply the policy in the current display frame, including debt from
      // earlier stage-end corrections. A later pass must not recreate z turns.
      if (line.kind === 'f2l' && (/^z/.test(mapped)
        || (!line.libraryCorrection && /^x/.test(mapped)))) {
        pending = compactCubeRotations(`${pending} ${token}`.trim());
        return;
      }
      entries.push({ token: /^[rludfb]/.test(token)
        ? mapped.replace(/^([RLUDFB])w/, (_, face: string) => face.toLowerCase()) : mapped, source });
    });
    const moves = entries.map(entry => entry.token);
    state = applyOneToken(state, reconstructionAlg(moves));
    let correction = '';
    if ((line.kind === 'cross' || line.kind === 'f2l') && state.D[4] !== down) {
      correction = ['x', "x'", 'x2', 'z', "z'"].find(rotation => {
        const rotated = applyOneToken(state, rotation);
        return rotated.D[4] === down && isCross(rotated);
      }) ?? '';
      if (correction) {
        moves.push(correction);
        state = applyOneToken(state, correction);
        pending = compactCubeRotations(`${inverse(correction)} ${pending}`.trim());
      }
    }
    if (moves.length === line.moves.length && moves.every((token, i) => token === line.moves[i])) return line;
    const last = line.moveRanges?.at(-1);
    return { ...line, moves,
      moveRanges: line.moveRanges ? [
        ...entries.map(({ token, source }) => source < 0
          ? { ...line.moveRanges![0], token, endTs: line.moveRanges![0].ts, endIdx: line.moveRanges![0].startIdx - 1 }
          : token === line.moveRanges![source].token
          ? line.moveRanges![source] : { ...line.moveRanges![source], token }),
        ...(correction ? [{ ...last!, token: correction, ts: last!.endTs,
          startIdx: last!.endIdx + 1, endIdx: last!.endIdx }] : []),
      ] : undefined,
      wasteGroups: line.wasteGroups ? [...entries.map(entry => entry.source < 0 ? null : line.wasteGroups![entry.source]),
        ...(correction ? [null] : [])] : undefined,
      algorithmGroups: line.algorithmGroups?.flatMap(group => {
        const indices = entries.flatMap((entry, i) => entry.source >= group.from && entry.source < group.to ? [i] : []);
        return indices.length ? [{ from: indices[0], to: indices.at(-1)! + 1 }] : [];
      }),
    };
  });
  if (pending) {
    const last = lines.at(-1)!;
    const range = last.moveRanges?.at(-1);
    const moves = pending.split(' ');
    result.push({ kind: 'inspection', stageKey: 'orientation', key: 'cross-down-final-orientation',
      moves, label: null, fromIdx: last.toIdx + 1, toIdx: last.toIdx,
      recognitionMs: null, executionMs: null, stepMs: null,
      moveRanges: range ? moves.map(token => ({ ...range, token, ts: range.endTs,
        startIdx: last.toIdx + 1, endIdx: last.toIdx })) : undefined });
  }
  return result;
}

/** Boundary corrections and conjugated library moves must also obey no-z. */
function withoutF2lZ(line: ReconTextLine): ReconTextLine {
  if (line.kind !== 'f2l' || !line.moves.some(token => /^z/.test(token))) return line;
  const entries = line.moves.flatMap((token, source) => /^z/.test(token)
    ? ['x', `y${token.slice(1)}`, "x'"].map(token => ({ token, source }))
    : [{ token, source }]);
  return { ...line, moves: entries.map(entry => entry.token),
    moveRanges: line.moveRanges ? entries.map(({ token, source }) => ({ ...line.moveRanges![source], token })) : undefined,
    wasteGroups: line.wasteGroups ? entries.map(({ source }) => line.wasteGroups![source]) : undefined,
    algorithmGroups: line.algorithmGroups?.map(group => ({
      from: entries.findIndex(entry => entry.source === group.from),
      to: entries.filter(entry => entry.source < group.to).length,
    })),
  };
}

function orientInspectionForCross(recon: ReconTextResult): ReconTextResult {
  if (!recon.crossColor) return recon;
  const state = applyOneToken(solved(3), `${recon.scramble} ${recon.inspection}`);
  if (state.D[4] === recon.crossColor) return recon;
  const rotation = ['x', "x'", 'x2', 'z', "z'"].find(rotation =>
    applyOneToken(state, rotation).D[4] === recon.crossColor);
  if (!rotation) return recon;
  const perm = facePermFor(rotation);
  const lines = recon.lines.map(line => {
    const moves = line.moves.map(token => {
      const mapped = conjugateReconToken(token, perm);
      if (mapped === null) throw new Error('Unsupported reconstruction move');
      return /^[rludfb]/.test(token) ? mapped.replace(/^([RLUDFB])w/, (_, face: string) => face.toLowerCase()) : mapped;
    });
    return { ...line, moves, moveRanges: line.moveRanges?.map((range, i) => ({ ...range, token: moves[i] })) };
  });
  return { ...recon, inspection: compactCubeRotations(`${recon.inspection} ${rotation}`), lines };
}

/** Choose reading frames across whole stages; never rewrite a matched library body. */
function preferF2lSideTurns(recon: ReconTextResult): ReconTextResult {
  const yaws = ['', 'y', 'y2', "y'"];
  const mapped = (line: ReconTextLine, yaw: number) => line.moves.map(token => {
    if (!yaw) return token;
    const move = conjugateReconToken(token, facePermFor(yaws[yaw]));
    if (move === null) throw new Error('Unsupported reconstruction move');
    return /^[rludfb]/.test(token) ? move.replace(/^([RLUDFB])w/, (_, face: string) => face.toLowerCase()) : move;
  });
  const cost = (line: ReconTextLine, moves: string[]) => {
    if (line.kind !== 'f2l' || line.libraryCorrection) return 0;
    let score = 0;
    for (const face of ['F', 'B']) {
      let side = 0, up = 0;
      const flush = () => {
        if (side >= 3 && up >= 2) score += side * 100;
        side = up = 0;
      };
      for (const token of moves) {
        if (new RegExp(`^${face}(?:2'?|')?$`).test(token)) side++;
        else if (/^U(?:2'?|')?$/.test(token)) up++;
        else flush();
      }
      flush();
    }
    return score;
  };
  if (!recon.lines.some(line => cost(line, line.moves))) return recon;
  // A mixed stage can contain long triggers on perpendicular faces. Split
  // only those stages at trigger boundaries, so one yaw need not serve both.
  const parts = recon.lines.flatMap((line, source) => {
    const runs: Array<{ start: number; axis: string }> = [];
    if (line.kind === 'f2l' && !line.libraryCorrection) {
      for (let i = 0; i < line.moves.length;) {
        const face = /^([FRBL])(?:2'?|')?$/.exec(line.moves[i])?.[1];
        if (!face) { i++; continue; }
        const start = i;
        let side = 0, up = 0;
        while (i < line.moves.length) {
          if (new RegExp(`^${face}(?:2'?|')?$`).test(line.moves[i])) side++;
          else if (/^U(?:2'?|')?$/.test(line.moves[i])) up++;
          else break;
          i++;
        }
        if (side >= 3 && up >= 2) runs.push({ start, axis: 'FB'.includes(face) ? 'FB' : 'RL' });
      }
    }
    const cuts = new Set([0, line.moves.length]);
    if (new Set(runs.map(run => run.axis)).size > 1) runs.slice(1).forEach(run => cuts.add(run.start));
    const bounds = [...cuts].sort((a, b) => a - b);
    if (bounds.length <= 2) return [{ source, line }];
    return bounds.slice(0, -1).map((from, i) => {
      const to = bounds[i + 1];
      return { source, line: { ...line, moves: line.moves.slice(from, to),
        moveRanges: line.moveRanges?.slice(from, to), wasteGroups: line.wasteGroups?.slice(from, to),
        algorithmGroups: line.algorithmGroups?.flatMap(group => group.from < to && group.to > from
          ? [{ from: Math.max(group.from, from) - from, to: Math.min(group.to, to) - from }] : []),
      } };
    });
  });
  // Four-state dynamic programming: repeated front/back triggers outrank the
  // number of inserted rotations. The initial yaw is free (inspection).
  let paths: Array<{ score: number; yaws: number[] }> = [{ score: 0, yaws: [] }];
  for (const { line } of parts) {
    // An unmatched last layer has no library frame to return to. Keep the
    // chosen reading frame across its boundary instead of inventing a regrip.
    const choices = line.kind === 'cross' || !line.libraryCorrection ? [0, 1, 2, 3] : [0];
    const keepFrame = !line.libraryCorrection && (line.kind === 'oll' || line.kind === 'pll');
    paths = choices.flatMap(yaw => {
      const eligible = paths.filter(path => !keepFrame || !path.yaws.length || path.yaws.at(-1) === yaw);
      if (!eligible.length) return [];
      const best = eligible.map(path => ({
        score: path.score + (path.yaws.length && path.yaws.at(-1) !== yaw ? 1 + (line.kind === 'f2l' ? 0.01 : 0) : 0),
        yaws: [...path.yaws, yaw],
      })).sort((a, b) => a.score - b.score)[0];
      return { ...best, score: best.score + cost(line, mapped(line, yaw)) };
    });
  }
  // Returning to the source frame preserves the complete transformation.
  const best = paths.sort((a, b) => (a.score + (a.yaws.at(-1) ? 1 : 0)) - (b.score + (b.yaws.at(-1) ? 1 : 0)))[0];
  const initial = best.yaws[0] ?? 0;
  let previous = initial;
  const projected = parts.map(({ line }, i) => {
    const yaw = best.yaws[i];
    const delta = (yaw - previous + 4) % 4;
    previous = yaw;
    if (!yaw && !delta) return line;
    const moves = [...(delta ? [yaws[delta]] : []), ...mapped(line, yaw)];
    const first = line.moveRanges?.[0];
    return { ...line, moves,
      moveRanges: line.moveRanges ? [
        ...(delta && first ? [{ ...first, token: yaws[delta], endTs: first.ts, endIdx: first.startIdx - 1 }] : []),
        ...line.moveRanges.map((range, j) => ({ ...range, token: moves[j + (delta ? 1 : 0)] })),
      ] : undefined,
      wasteGroups: line.wasteGroups ? [...(delta ? [null] : []), ...line.wasteGroups] : undefined,
      algorithmGroups: line.algorithmGroups?.map(group => ({ from: group.from + (delta ? 1 : 0), to: group.to + (delta ? 1 : 0) })),
    };
  });
  const lines: ReconTextLine[] = [];
  projected.forEach((line, i) => {
    if (i === 0 || parts[i].source !== parts[i - 1].source) { lines.push(line); return; }
    const last = lines.at(-1)!;
    const offset = last.moves.length;
    lines[lines.length - 1] = { ...last, moves: [...last.moves, ...line.moves],
      moveRanges: last.moveRanges && line.moveRanges ? [...last.moveRanges, ...line.moveRanges] : undefined,
      wasteGroups: last.wasteGroups && line.wasteGroups ? [...last.wasteGroups, ...line.wasteGroups] : undefined,
      algorithmGroups: last.algorithmGroups && line.algorithmGroups
        ? [...last.algorithmGroups, ...line.algorithmGroups.map(group => ({ from: group.from + offset, to: group.to + offset }))] : undefined,
    };
  });
  if (previous) {
    const last = lines.at(-1)!;
    lines.push({ ...last, key: 'f2l-reading-final-orientation', kind: 'inspection', label: null,
      moves: [yaws[(4 - previous) % 4]], fromIdx: last.toIdx + 1,
      moveRanges: undefined, wasteGroups: undefined, algorithmGroups: undefined,
      recognitionMs: null, executionMs: null, stepMs: null });
  }
  const inspection = compactCubeRotations(`${recon.inspection} ${yaws[initial]}`.trim());
  return { ...recon, inspection, lines,
    text: [...(inspection ? [`${inspection} // insp`] : []), ...lines.map(formatReconLine)].join('\n') };
}

/** Final grip is replay information, not another step after the cube is solved. */
/** A replacement's final rotation may own its complete encoder span. Removing
 * that rotation transfers ownership to the preceding step, never drops events. */
function retainOmittedRanges(retained: RangeMoveItem[] | undefined, omitted: RangeMoveItem[]): RangeMoveItem[] | undefined | null {
  if (!retained) return undefined;
  const anchor = retained.at(-1);
  if (!anchor) return omitted.some(range => range.endIdx >= range.startIdx) ? null : retained;
  const covered = new Set<number>();
  for (const range of [anchor, ...omitted]) for (let n = range.startIdx; n <= range.endIdx; n++) covered.add(n);
  const from = covered.size ? Math.min(...covered) : anchor.startIdx;
  const to = covered.size ? Math.max(...covered) : anchor.endIdx;
  if (covered.size && to - from + 1 !== covered.size) return null;
  return [...retained.slice(0, -1), { ...anchor, startIdx: from, endIdx: to,
    seekEndIdx: to, endTs: Math.max(anchor.endTs, ...omitted.map(range => range.endTs)) }];
}

function omitSolvedTailRotations(recon: ReconTextResult): ReconTextResult {
  let lastLine = recon.lines.length - 1;
  let end = 0;
  while (lastLine >= 0) {
    const moves = recon.lines[lastLine].moves;
    end = moves.length;
    while (end && /^[xyz](?:2'?|')?$/.test(moves[end - 1])) end--;
    if (end) break;
    lastLine--;
  }
  const line = recon.lines[lastLine];
  if (!line || (line.kind !== 'pll' && line.kind !== 'oll')
    || (lastLine === recon.lines.length - 1 && end === line.moves.length)) return recon;
  const moves = recon.lines.slice(0, lastLine).flatMap(line => line.moves).concat(line.moves.slice(0, end));
  if (!isSolved(applyOneToken(solved(3), `${recon.scramble} ${recon.inspection} ${reconstructionAlg(moves)}`))) return recon;
  const ranges = retainOmittedRanges(line.moveRanges?.slice(0, end), [
    ...(line.moveRanges?.slice(end) ?? []), ...recon.lines.slice(lastLine + 1).flatMap(line => line.moveRanges ?? []),
  ]);
  if (ranges === null) return recon;
  const lines = [...recon.lines.slice(0, lastLine), { ...line, moves: line.moves.slice(0, end),
    moveRanges: ranges, wasteGroups: line.wasteGroups?.slice(0, end),
    algorithmGroups: line.algorithmGroups?.filter(group => group.from < end)
      .map(group => ({ ...group, to: Math.min(group.to, end) })),
  }];
  return { ...recon, lines,
    text: [...(recon.inspection ? [`${recon.inspection} // insp`] : []), ...lines.map(formatReconLine)].join('\n') };
}

/** Cross-down can rename an already matched algorithm. Restore its library yaw
 * only when the complete library body matches token for token in that frame. */
function restoreLibraryYaw(recon: ReconTextResult): ReconTextResult {
  const lines = recon.lines.map(line => {
    if (!line.libraryCorrection || line.kind === 'f2l' || line.kind === 'cross') return line;
    let body: string[];
    try { body = toMoveStringStrict(line.libraryCorrection.algorithm).split(' ').filter(Boolean); }
    catch { return line; }
    while (/^U(?:\d+)?'?$/.test(body[0] ?? '')) body.shift();
    while (/^U(?:\d+)?'?$/.test(body.at(-1) ?? '')) body.pop();
    if (!body.length) return line;
    const containsBody = (moves: string[]) => {
      const ordinary = moves.filter((_, i) => line.wasteGroups?.[i] == null);
      return ordinary.some((_, i) => body.every((token, j) => ordinary[i + j] === token));
    };
    if (containsBody(line.moves)) return line;
    for (const yaw of ['y', 'y2', "y'"]) {
      const moves = line.moves.map(token => conjugateReconToken(token, facePermFor(yaw)));
      if (moves.some(token => token === null) || !containsBody(moves as string[])) continue;
      const inverse = yaw === 'y' ? "y'" : yaw === "y'" ? 'y' : 'y2';
      const first = line.moveRanges?.[0], last = line.moveRanges?.at(-1);
      // A prior reading-frame adjustment can cancel this yaw. Compact only
      // leading rotations with empty encoder ranges, never physical turns.
      let from = 0;
      while (from < moves.length && /^[xyz](?:2'?|')?$/.test(moves[from]!)
        && line.moveRanges && line.moveRanges[from].endIdx < line.moveRanges[from].startIdx
        && line.wasteGroups?.[from] == null) from++;
      const prefix = compactCubeRotations([yaw, ...moves.slice(0, from)].join(' ')).split(' ').filter(Boolean);
      const offset = prefix.length - from;
      return { ...line, moves: [...prefix, ...moves.slice(from) as string[], inverse],
        moveRanges: first && last ? [
          ...prefix.map(token => ({ ...first, token, endTs: first.ts, endIdx: first.startIdx - 1 })),
          ...line.moveRanges!.slice(from).map((range, i) => ({ ...range, token: moves[from + i]! })),
          { ...last, token: inverse, ts: last.endTs, startIdx: last.endIdx + 1 },
        ] : undefined,
        wasteGroups: [...prefix.map(() => null), ...(line.wasteGroups ?? line.moves.map(() => null)).slice(from), null],
        algorithmGroups: line.algorithmGroups?.map(group => ({ from: group.from + offset, to: group.to + offset })),
      };
    }
    return line;
  });
  return lines.every((line, i) => line === recon.lines[i]) ? recon : { ...recon, lines,
    text: [...(recon.inspection ? [`${recon.inspection} // insp`] : []), ...lines.map(formatReconLine)].join('\n') };
}

/** Library reframing can leave inverse rotations on opposite sides of a stage
 * boundary. Remove the complete identity loop, retaining its encoder coverage. */
function omitBoundaryRotationLoops(recon: ReconTextResult): ReconTextResult {
  const lines = [...recon.lines];
  let changed = false;
  for (let i = 1; i < lines.length; i++) {
    const left = lines[i - 1], right = lines[i];
    // F2L boundaries must keep the cross down. Their compensating rotations
    // are not disposable last-layer library framing, even if they later cancel.
    if (!left.libraryCorrection || !['oll', 'pll'].includes(left.kind)
      || !['oll', 'pll'].includes(right.kind)) continue;
    let end = left.moves.length, start = 0;
    while (end > 0 && /^[xyz](?:2'?|')?$/.test(left.moves[end - 1])) end--;
    while (start < right.moves.length && /^[xyz](?:2'?|')?$/.test(right.moves[start])) start++;
    if (!end || end === left.moves.length || !start
      || compactCubeRotations([...left.moves.slice(end), ...right.moves.slice(0, start)].join(' '))) continue;
    const ranges = retainOmittedRanges(left.moveRanges?.slice(0, end), [
      ...(left.moveRanges?.slice(end) ?? []), ...(right.moveRanges?.slice(0, start) ?? []),
    ]);
    if (ranges === null) continue;
    lines[i - 1] = { ...left, moves: left.moves.slice(0, end), moveRanges: ranges,
      wasteGroups: left.wasteGroups?.slice(0, end),
      algorithmGroups: left.algorithmGroups?.filter(group => group.from < end)
        .map(group => ({ ...group, to: Math.min(group.to, end) })) };
    lines[i] = { ...right, moves: right.moves.slice(start), moveRanges: right.moveRanges?.slice(start),
      wasteGroups: right.wasteGroups?.slice(start),
      algorithmGroups: right.algorithmGroups?.filter(group => group.to > start)
        .map(group => ({ from: Math.max(0, group.from - start), to: group.to - start })) };
    changed = true;
  }
  return changed ? { ...recon, lines,
    text: [...(recon.inspection ? [`${recon.inspection} // insp`] : []), ...lines.map(formatReconLine)].join('\n') } : recon;
}

export function simplifyF2lRotations(source: ReconTextResult): ReconTextResult {
  if (source.presentation) return source.presentation;
  let recon: ReconTextResult;
  try { recon = orientInspectionForCross(source); } catch { return source; }
  const expanded = recon.lines.map(line => {
    if (line.kind !== 'f2l') return line;
    // A closed wide-turn trigger is an intentional fingertrick, even when
    // the library does not contain the complete F2L algorithm.
    const wideTriggers = new Set<number>();
    for (let start = 0; start < line.moves.length - 2; start++) {
      const opening = line.moves[start].match(/^([rludfb]|[RLUDFB]w)(2'?|')?$/);
      if (!opening) continue;
      const amount = (suffix: string) => suffix.startsWith('2') ? 2 : suffix === "'" ? -1 : 1;
      let end = start + 1;
      while (/^[RLUDFB](?:2'?|')?$/.test(line.moves[end] ?? '')) end++;
      const closing = line.moves[end]?.match(/^([rludfb]|[RLUDFB]w)(2'?|')?$/);
      if (end > start + 1 && closing && opening[1][0].toLowerCase() === closing[1][0].toLowerCase()
        && (amount(opening[2] ?? '') + amount(closing[2] ?? '')) % 4 === 0) {
        wideTriggers.add(start);
        wideTriggers.add(end);
      }
    }
    const entries: Array<{ token: string; from: number; to: number; range?: RangeMoveItem }> = [];
    for (let i = 0; i < line.moves.length;) {
      const from = i;
      const wide = line.moves[i].match(/^([rludfb]|[RLUDFB]w)(2'?|')?$/);
      if (wide && !line.libraryCorrection && !wideTriggers.has(i)) {
        const definition = WIDE_TURN_DEFS.find(([family]) => family === wide[1][0].toLowerCase())!;
        const [, axis, rotationQuarter, face] = definition;
        const q = wide[2]?.startsWith('2') ? (wide[2].endsWith("'") ? -2 : 2)
          : wide[2] === "'" ? -1 : 1;
        const tokens = [quarterToken(face, q), quarterToken(axis, (rotationQuarter === 3 ? -1 : 1) * q)];
        const range = line.moveRanges?.[i];
        tokens.forEach(token => entries.push({ token, from, to: i + 1,
          range: range ? { ...range, token, ...(/^[xyz]/.test(token)
            ? { endIdx: range.startIdx - 1, seekEndIdx: range.endIdx } : {}) } : undefined }));
        i++;
        continue;
      }
      // E = U D' y'. Carry its rotation through a BU/FU two-generator run,
      // retaining any net rotation after the closing E turn.
      if (!line.libraryCorrection && /^E(?:2'?|')?$/.test(line.moves[i])) {
        let end = i + 1;
        const faces = new Set<string>();
        while (end < line.moves.length && /^[UBF](?:2'?|')?$/.test(line.moves[end])) {
          faces.add(line.moves[end][0]);
          end++;
        }
        if (faces.has('U') && faces.size === 2 && /^E(?:2'?|')?$/.test(line.moves[end] ?? '')) {
          const amount = (token: string) => token.includes('2') ? 2 : token.endsWith("'") ? -1 : 1;
          const first = amount(line.moves[i]), last = amount(line.moves[end]);
          const append = (token: string, source: number) => {
            const range = line.moveRanges?.[source];
            entries.push({ token, from: source, to: source + 1, range: range ? { ...range, token } : undefined });
          };
          append(quarterToken('U', first), i);
          append(quarterToken('D', -first), i);
          const sides = 'BRFL';
          for (let n = i + 1; n < end; n++) {
            const token = line.moves[n];
            const face = token[0] === 'U' ? 'U' : sides[(sides.indexOf(token[0]) + first + 4) % 4];
            append(face + token.slice(1), n);
          }
          append(quarterToken('U', last), end);
          append(quarterToken('D', -last), end);
          if ((first + last) % 4 !== 0) append(quarterToken('y', -first - last), end);
          i = end + 1;
          continue;
        }
      }
      if (!/^[xyz](?:2'?|')?$/.test(line.moves[i])) {
        entries.push({ token: line.moves[i], from, to: ++i, range: line.moveRanges?.[from] });
        continue;
      }
      while (i < line.moves.length && /^[xyz](?:2'?|')?$/.test(line.moves[i])) i++;
      const original = line.moves.slice(from, i);
      const compact = compactCubeRotations(original.join(' ')).split(/\s+/).filter(Boolean);
      // Do not gratuitously rename equal-length notation or cross a layer move.
      if (compact.length >= original.length) {
        original.forEach((token, n) => entries.push({ token, from: from + n, to: from + n + 1,
          range: line.moveRanges?.[from + n] }));
      } else {
        const first = line.moveRanges?.[from], last = line.moveRanges?.[i - 1];
        // A synthesized net rotation represents the whole observed interval,
        // never a fabricated intermediate pose. Both ends seek the raw track.
        compact.forEach(token => entries.push({ token, from, to: i,
          range: first && last ? { ...first, token, endIdx: last.endIdx, endTs: last.endTs } : undefined }));
      }
    }
    if (entries.length === line.moves.length && entries.every((entry, i) => entry.token === line.moves[i])) return line;
    return { ...line, moves: entries.map(entry => entry.token),
      moveRanges: line.moveRanges ? entries.map(entry => entry.range!) : undefined,
      wasteGroups: line.wasteGroups ? entries.map(entry => line.wasteGroups![entry.from]) : undefined,
      algorithmGroups: line.algorithmGroups?.flatMap(group => {
        const indices = entries.flatMap((entry, index) => entry.from < group.to && entry.to > group.from ? [index] : []);
        return indices.length ? [{ from: indices[0], to: indices.at(-1)! + 1 }] : [];
      }),
    };
  });
  let lines: ReconTextLine[];
  try { lines = restoreCrossAtBoundaries(recon, expanded).map(withoutF2lZ); }
  catch { return recon; }
  if (recon === source && lines.length === recon.lines.length && lines.every((line, i) => line === recon.lines[i])) return omitBoundaryRotationLoops(omitSolvedTailRotations(restoreLibraryYaw(preferF2lSideTurns(recon))));
  return omitBoundaryRotationLoops(omitSolvedTailRotations(restoreLibraryYaw(preferF2lSideTurns({ ...recon, lines,
    text: [...(recon.inspection ? [`${recon.inspection} // insp`] : []), ...lines.map(formatReconLine)].join('\n') }))));
}

export function formatReconLine(line: ReconTextLine): string {
  const moves = formattedReconMoves(line).join(' ');
  if (!line.label) return moves;
  return `${moves} // ${line.label}${timeSuffix(line)}`;
}

/** Keep one token per playback range; format 3x3 wides like the library without changing execution tokens. */
export function formattedReconMoves(line: ReconTextLine): string[] {
  return line.moves.map((token, i) => {
    const move = canonicalize3x3WideMoves(token);
    const group = line.wasteGroups?.[i];
    if (group == null) return move;
    const open = i === 0 || line.wasteGroups?.[i - 1] !== group;
    const close = i === line.moves.length - 1 || line.wasteGroups?.[i + 1] !== group;
    return `${open ? '(' : ''}${move}${close ? ')' : ''}`;
  });
}

export interface ReconTextInput {
  /** Completed, corrected prefix from this same physical attempt. */
  confirmed?: ReconTextResult;
  method?: MethodId;
  language?: 'zh' | 'en';
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
 * 把转体按时刻插进一行的动作里。
 *
 * 位置靠**时刻**定,而不是靠下标 —— 转体压根不在动作流里,没有下标可用。一次转体
 * 排在「它之后发生的第一手」前面;比这一行所有动作都晚的排在末尾。
 *
 * 记号本身已经是人的视角了(`humanize.ts` 换过名,和它旁边那些动作同一个 ρ),
 * 这里只管摆位置。
 *
 * `lineMoves` 的每个合并记号仍保留第一条原始通知的时刻,所以直接逐项比较。不能按
 * 动作数量做比例折算:某一段中层很多时,合并前后的数量差会把 `y` 推迟好几手。
 */
interface WovenItem extends RangeMoveItem {
  rotationMs?: number;
  /** 防止普通转体碰巧挨着 U/D/F/B/L/R 时被压成假的宽层动作。 */
  wideRotation?: true;
}

function playbackRanges(items: WovenItem[], moves: SolveMove[]): RangeMoveItem[] {
  return items.map(item => {
    if (item.startIdx >= 0) return item;
    // Rotations do not consume encoder moves. Preserve their own time while
    // locating the raw cube state at that instant.
    const next = moves.findIndex(move => move.ts > item.ts);
    const count = next < 0 ? moves.length : next;
    return { ...item, startIdx: count, endIdx: count - 1 };
  });
}

function quarterToken(family: string, signedQuarters: number): string {
  const quarters = ((signedQuarters % 4) + 4) % 4;
  if (quarters === 1) return family;
  if (quarters === 2) return `${family}2${signedQuarters < 0 ? "'" : ''}`;
  return `${family}'`;
}

const WIDE_TURN_DEFS = [
    ['r', 'x', 1, 'L'], ['l', 'x', 3, 'R'],
    ['u', 'y', 1, 'D'], ['d', 'y', 3, 'U'],
    ['f', 'z', 1, 'B'], ['b', 'z', 3, 'F'],
  ] as const;

const WIDE_PAIRS = (() => {
  const out = new Map<string, string>();
  for (const [wide, rotation, rotationQuarter, face] of WIDE_TURN_DEFS) {
    const rotationSign = rotationQuarter === 3 ? -1 : 1;
    for (const q of [1, 2, -2, -1]) {
      const rot = quarterToken(rotation, rotationSign * q);
      const outer = quarterToken(face, q);
      const result = quarterToken(wide, q);
      out.set(`${rot} ${outer}`, result);
      out.set(`${outer} ${rot}`, result);
    }
  }
  return out;
})();

function inverseRotationToken(token: string): string | null {
  if (!/^[xyz](?:2'?|')?$/.test(token)) return null;
  if (token.endsWith("2'")) return token.slice(0, -1);
  if (token.endsWith('2')) return `${token}'`;
  return token.endsWith("'") ? token.slice(0, -1) : `${token}'`;
}

/**
 * A 3x3 wide turn rotates the sensor-bearing core and compensates with the
 * opposite outer face. The gyro therefore resembles a whole-cube rotation,
 * but it must not be treated like a whole-cube regrip. Calibrated recordings
 * match direction, turn amount and timing; legacy sensor-frame recordings
 * retain their existing inverse-pair convention below.
 */
const WIDE_TURN_SLACK_MS = 120;

/** Do not collapse separate same-face gestures before matching their gyro events. */
function wideGestureMoves(moves: SolveMove[]): ReturnType<typeof htmMoves> {
  const out: ReturnType<typeof htmMoves> = [];
  let from = 0;
  for (let i = 1; i <= moves.length; i++) {
    if (i < moves.length && moves[i].ts - moves[i - 1].ts <= WIDE_TURN_SLACK_MS) continue;
    out.push(...htmMoves(moves.slice(from, i)).map(move => ({
      ...move, startIdx: move.startIdx + from, endIdx: move.endIdx + from,
    })));
    from = i;
  }
  return out;
}

function markWideCoreEvents(
  inputCore: CoreTrack | null,
  counted: ReturnType<typeof htmMoves>,
): CoreTrack | null {
  if (!inputCore) return null;
  let core: CoreTrack = inputCore;
  const slicePairs = sliceSplitTable();
  const candidates: number[] = [];
  const wideTokens = new Map<number, string>();
  const wideMoveTimes = new Map<number, number>();
  const wideMoveEnds = new Map<number, number>();
  const claimedOuter = new Set<number>();
  const belongsToSlice = (idx: number): boolean => counted.some((move, moveIdx) => {
    const next = counted[moveIdx + 1];
    const split = next ? slicePairs.get(`${move.m} ${next.m}`) : undefined;
    return !!next && !!split && (core.frame !== 'scramble' || next.endTs - move.ts <= WIDE_TURN_SLACK_MS)
      && coreTurnsIn(core, move.ts, next.endTs, split.rotation).includes(idx);
  });
  if (core.frame === 'scramble') {
    // An immediate angular detector observes both quarters of a gradual half
    // turn. Group them only when one matching encoder half gesture supports it;
    // keep the source track and its intermediate playback poses untouched.
    const grouped: CoreTrack['events'][number][] = [];
    for (let i = 0; i < core.events.length; i++) {
      const a = core.events[i], b = core.events[i + 1];
      const half = `${a.token[0]}2${a.token.endsWith("'") ? "'" : ''}`;
      const match = b && a.token === b.token && /^[xyz]'?$/.test(a.token)
        && !belongsToSlice(i) && !belongsToSlice(i + 1)
        && counted.some((move, moveIdx) => {
          if (!WIDE_PAIRS.has(`${move.m} ${half}`)) return false;
          const distance = (t: number) => Math.min(Math.abs(move.ts - t), Math.abs(move.endTs - t));
          const from = Math.min(move.ts, a.tMs), to = Math.max(move.endTs, b.tMs);
          return distance(a.tMs) <= WIDE_TURN_SLACK_MS && distance(b.tMs) <= WIDE_TURN_SLACK_MS
            && !counted.some((other, idx) => idx !== moveIdx && other.ts > from && other.ts < to);
        });
      if (match) {
        grouped.push({ ...a, tMs: b.tMs, token: half, angleRad: Math.PI });
        i++;
      } else grouped.push(a);
    }
    core = { ...core, events: grouped };
  }
  core.events.forEach((event, idx) => {
    const inverse = inverseRotationToken(event.token);
    if (!inverse) return;
    const eventMs = event.startMs !== undefined && event.tMs - event.startMs <= 1200
      ? event.startMs
      : event.tMs;
    if (belongsToSlice(idx)) return;

    if (core.frame === 'scramble') {
      // Calibrated recordings already use physical WCA directions. Pair one
      // nearby encoder gesture with one core event, regardless of arrival order.
      // Anchor both at the encoder time so a stage cut cannot split the gesture.
      const gestureMs = event.notationMs ?? event.tMs;
      const nearest = counted.map((move, moveIdx) => ({ move, moveIdx,
        distance: Math.min(Math.abs(move.ts - gestureMs), Math.abs(move.endTs - gestureMs)),
      })).filter(({ move, moveIdx, distance }) => {
        if (claimedOuter.has(moveIdx) || distance > WIDE_TURN_SLACK_MS
          || !WIDE_PAIRS.has(`${move.m} ${event.token}`)) return false;
        const from = Math.min(move.ts, gestureMs), to = Math.max(move.endTs, gestureMs);
        return !counted.some((other, otherIdx) => otherIdx !== moveIdx
          && other.ts > from && other.ts < to);
      }).sort((a, b) => a.distance - b.distance || a.moveIdx - b.moveIdx)[0];
      if (nearest) {
        claimedOuter.add(nearest.moveIdx);
        wideTokens.set(idx, event.token);
        wideMoveTimes.set(idx, nearest.move.ts);
        wideMoveEnds.set(idx, nearest.move.endIdx);
      }
      return;
    }

    // A lone wide turn has no later inverse event to close the frame. In that
    // case require much stronger evidence: the core must settle at virtually
    // the same instant as the compensating outer-face encoder notification.
    // A normal regrip merely followed by U/D/F/B/L/R stays two written tokens.
    const synchronousOuter = counted.find(move => {
      const closeToSettled = Math.min(
        Math.abs(move.ts - event.tMs),
        Math.abs(move.endTs - event.tMs),
      ) <= 60;
      return closeToSettled
        && (WIDE_PAIRS.has(`${move.m} ${event.token}`) || WIDE_PAIRS.has(`${event.token} ${move.m}`));
    });
    if (synchronousOuter) wideTokens.set(idx, event.token);

    const outer = counted.find(move => {
      const close = Math.min(Math.abs(move.ts - eventMs), Math.abs(move.endTs - eventMs)) <= 120;
      return close && (WIDE_PAIRS.has(`${move.m} ${inverse}`) || WIDE_PAIRS.has(`${inverse} ${move.m}`));
    });
    if (!outer) return;
    // A slice can be closed by a wide move rather than another adjacent pair.
    // Use the encoder time so a delayed gyro sample cannot move that closing
    // gesture into the next stage and rename the entire following algorithm.
    if (idx > 0 && core.events[idx - 1].token === inverse && belongsToSlice(idx - 1)) {
      wideTokens.set(idx, inverse);
      wideMoveTimes.set(idx, outer.ts);
      return;
    }
    candidates.push(idx);
  });
  for (let i = 0; i + 1 < candidates.length; i += 1) {
    const aIdx = candidates[i], bIdx = candidates[i + 1];
    const a = core.events[aIdx], b = core.events[bIdx];
    if (bIdx === aIdx + 1 && b.tMs - a.tMs <= 4000
      && inverseRotationToken(a.token) === b.token) {
      wideTokens.set(aIdx, inverseRotationToken(a.token)!);
      wideTokens.set(bIdx, inverseRotationToken(b.token)!);
      i += 1;
    }
  }
  return {
    ...core,
    events: core.events.map((event, idx) => {
      const wideToken = wideTokens.get(idx);
      return wideToken ? { ...event, startMs: wideMoveTimes.get(idx) ?? event.startMs,
        wide: true, wideToken, wideEndIdx: wideMoveEnds.get(idx) } : event;
    }),
  };
}

function sameAxisFaceSlice(face: string, slice: string): boolean {
  return ((face === 'F' || face === 'B') && slice === 'S')
    || ((face === 'R' || face === 'L') && slice === 'M')
    || ((face === 'U' || face === 'D') && slice === 'E');
}

function compactNotation(items: WovenItem[], absorbedRotations: Set<number>): WovenItem[] {
  const out: WovenItem[] = [];
  const opposite: Readonly<Record<string, string>> = {
    B: 'F', F: 'B', L: 'R', R: 'L', D: 'U', U: 'D',
  };
  const pairOrder: Readonly<Record<string, number>> = {
    B: 0, F: 1, L: 0, R: 1, D: 0, U: 1,
  };
  for (let i = 0; i < items.length; i += 1) {
    const a = items[i], b = items[i + 1];
    if (b) {
      const aFace = /^([UDFBLR])(?:2'?|')?$/.exec(a.token)?.[1];
      const bFace = /^([UDFBLR])(?:2'?|')?$/.exec(b.token)?.[1];
      // Near-simultaneous opposite faces commute, and Bluetooth arrival order
      // can flip them. Give these two-hand gestures one stable written order.
      if (a.rotationMs === undefined && b.rotationMs === undefined
        && aFace && bFace && opposite[aFace] === bFace
        && b.ts - a.endTs <= 100 && pairOrder[aFace] > pairOrder[bFace]) {
        out.push(b, a);
        i += 1;
        continue;
      }
      const wide = WIDE_PAIRS.get(`${a.token} ${b.token}`);
      if (wide && (a.wideRotation || b.wideRotation)) {
        const rotationMs = a.rotationMs ?? b.rotationMs;
        if (rotationMs !== undefined) absorbedRotations.add(rotationMs);
        out.push({
          token: wide,
          ts: Math.min(a.ts, b.ts), endTs: Math.max(a.endTs, b.endTs),
          startIdx: Math.min(...[a.startIdx, b.startIdx].filter(idx => idx >= 0)),
          endIdx: Math.max(a.endIdx, b.endIdx),
        });
        i += 1;
        continue;
      }
      const face = /^([UDFBLR])([2']?)$/.exec(a.token);
      const slice = /^([MES])([2']?)$/.exec(b.token);
      if (face && slice && sameAxisFaceSlice(face[1], slice[1]) && b.ts - a.ts <= 80) {
        out.push({ ...a, token: `${a.token}${b.token}`, endTs: b.endTs, endIdx: b.endIdx });
        i += 1;
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

function displayLabel(label: string | null): string | null {
  if (!label) return null;
  return label.replace(/^EPLL-/, 'PLL-');
}

function crossIsDone(stage: string): boolean {
  return stage === 'cross' || stage === 'xcross' || stage === 'xxcross'
    || stage === 'xxxcross' || stage === 'f2l' || stage === 'oll'
    || stage === 'pll' || stage === 'solved';
}

function weaveRotations(
  lineMoves: RangeMoveItem[],
  rots: readonly HumanRotation[],
  absorbedRotations: Set<number>,
): WovenItem[] {
  const out: WovenItem[] = [];
  let cursor = 0;
  const placed = rots.map((r) => {
    let at = 0;
    while (at < lineMoves.length && lineMoves[at].ts < r.tMs) at++;
    return { ...r, at };
  }).sort((a, b) => a.at - b.at);
  for (const p of placed) {
    while (cursor < p.at) out.push(lineMoves[cursor++]);
    out.push({
      token: p.token,
      ts: p.tMs,
      endTs: p.tMs,
      startIdx: -1,
      endIdx: -1,
      rotationMs: p.tMs,
      ...(p.wide ? { wideRotation: true as const } : {}),
    });
  }
  while (cursor < lineMoves.length) out.push(lineMoves[cursor++]);
  return compactNotation(out, absorbedRotations);
}

/**
 * 产出整段文字复盘。异步:识别那一层是 cubing.js 的活。
 *
 * 任何一行识别失败(查表抛异常、打乱有引擎读不了的记号)只让那一行的 `label`
 * 变成 null,不会带走整段 —— 一份只差几个标签的谱子仍然有用。
 */
export async function buildReconText(input: ReconTextInput): Promise<ReconTextResult> {
  const { scramble, moves, totalMs, segs, metrics, slots } = input;
  const isCfop = !input.method || input.method === 'cfop';
  const physical = input.physical ?? input;
  const methodWalk = isCfop ? null : walkMethod(input.method!, physical.scramble, physical.moves, totalMs, input.viewRotation);
  const currentIndex = methodWalk ? Math.min(3, methodWalk.reachedIdx + 1)
    : segs.ollEndIdx != null ? 3 : segs.f2lEndIdx != null ? 2 : segs.crossEndIdx != null ? 1 : 0;
  const { key: currentKey, zh: currentZh, en: currentEn } = METHODS[input.method ?? 'cfop'].stages[currentIndex];
  const currentStage = { key: currentKey, zh: currentZh, en: currentEn };
  const kinds = ['cross', 'f2l', 'oll', 'pll'] as const;
  const sourceSpans: Span[] = isCfop ? stepSpans(segs, metrics, slots, moves)
    : (methodWalk?.stages ?? []).flatMap((stage, index) => stage.endIdx === null ? [] : [{
      kind: kinds[index] ?? 'pll', key: stage.key, endIdx: stage.endIdx,
      label: input.language === 'zh' ? stage.zh : stage.en,
      recognitionMs: stage.recognitionMs, executionMs: stage.executionMs, stepMs: stage.stepMs,
    }]);
  const counted = htmMoves(moves);
  // 姿态流是魔方自己配色系里的,而 `moves` 已经被 `orient.ts` 转进「十字朝下」——
  // 转体的记号得跟着换,不然谱子里的 `x` 和它旁边的动作不是一个系的。
  const measuredCore = input.core
    ? conjugateCoreTrack(input.core, facePermFor(input.viewRotation ?? ''))
    : null;
  const core = markWideCoreEvents(measuredCore, measuredCore?.frame === 'scramble' ? wideGestureMoves(moves) : counted);
  // 中层还原 + 转体。魔方按「相对中心核」报手法,所以一个 `S` 到这里是一对相对面 +
  // 后面每一手都被换了名 —— 那行谱子于是不像任何公式。转体同理,而且它和中层改的是
  // 同一个 ρ,所以一趟走完。只重写**写出来的记号**:计步、识别、参考解仍然吃
  // `counted`(魔方确实转了两下面)。
  // 谱子这一层吃**一手一条**的流,不是合过同面的 `counted`:合同面和配中层抢同一批
  // 记号,而先合同面会把中层拆散(`L R' R' L` → `L R2 L`,两个 M 全没了)。合同族
  // 现在在 `humanizeStream` 里做,排在认中层之后。计步照旧走 `counted`。
  // First pass discovers the physical gesture spans without stage cuts. The
  // second pass below restores the stage-level centre invariant after those
  // cuts have been moved out of the middle of any discovered gesture.
  const f2lEndMs = segs.f2lEndIdx == null ? Infinity : (moves[segs.f2lEndIdx]?.ts ?? -Infinity);
  const roughHumanized = humanizeStream(quarterMoves(moves), {
    core, suppressZRotationsThroughMs: !isCfop || core?.frame === 'scramble' ? undefined : f2lEndMs,
  });
  // A slice/wide gesture reaches the protocol as multiple outer-face events.
  // Stage detection can therefore fire after the first event, in the middle of
  // one physical gesture. Keep that gesture on one line and evaluate the stage
  // only after its final event.
  const snappedEnd = (span: Span): number => {
    const rawEnd = span.endIdx;
    let end = rawEnd;
    for (const move of roughHumanized.moves) {
      const families = new Set(
        moves.slice(move.startIdx, move.endIdx + 1).map(raw => /^([UDFBLR])/.exec(raw.m)?.[1]),
      );
      const fastSameFace = move.endTs - move.ts <= 200;
      if ((families.size > 1 || fastSameFace) && move.startIdx <= end && move.endIdx > end) {
        // Two quick same-face turns may straddle completed F2L pairs. Do not
        // move a valid stage boundary into the next pair's broken-cross state.
        if (isCfop && span.kind === 'f2l' && families.size === 1
          && !isCross(applyOneToken(solved(3), `${scramble} ${moves.slice(0, move.endIdx + 1).map(item => item.m).join(' ')}`))) continue;
        end = move.endIdx;
      }
    }
    return isCfop && span.kind === 'cross' ? snapCrossAufBeforePause(end, counted, totalMs) : end;
  };
  const confirmedLines = input.confirmed?.lines ?? [];
  const confirmedEnd = confirmedLines.at(-1)?.toIdx ?? -1;
  const confirmedKeys = new Set(confirmedLines.map(line => line.key));
  const snappedSpans = [...confirmedLines.map(line => ({ ...line, endIdx: line.toIdx })), ...sourceSpans
    .filter(span => !confirmedKeys.has(span.key) && span.endIdx > confirmedEnd).map(span => ({
    ...span,
    endIdx: snappedEnd(span),
  }))];
  const spans = snappedSpans.filter((span, i) => span.endIdx >= 0 && (i === 0 || span.endIdx > snappedSpans[i - 1].endIdx));
  const boundaries = new Set(spans.map(span => span.endIdx));
  const wasteSpans = wastedDisplaySpans(scramble, moves, boundaries);
  const preserveMoves = new Set<number>();
  for (const span of wasteSpans) {
    for (let i = span.fromIdx; i <= span.toIdx; i++) preserveMoves.add(i);
  }
  const humanizeOptions = {
    core,
    boundaries,
    suppressZRotationsThroughMs: !isCfop || core?.frame === 'scramble' ? undefined : segs.f2lEndIdx == null ? Infinity
      : (moves[spans.filter(span => span.kind === 'cross' || span.kind === 'f2l').at(-1)?.endIdx ?? -1]?.ts ?? f2lEndMs),
  };
  const countedHumanized = humanizeStream(quarterMoves(moves), humanizeOptions);
  let metricEnd = -1;
  let metricTs = moves[0]?.ts ?? 0;
  const methodStages = methodWalk?.stages.map(stage => {
    const endIdx = snappedSpans.find(span => span.key === stage.key)?.endIdx ?? stage.endIdx;
    if (endIdx === null) return stage;
    if (endIdx <= metricEnd) return { ...stage, endIdx, skipped: true, turns: 0, tps: null,
      recognitionMs: 0, executionMs: 0, stepMs: 0, cumulativeMs: endIdx < 0 ? 0 : metricTs };
    const metric = metricForRange(moves, counted, metricEnd, metricTs, endIdx);
    const turns = countedHumanized.moves.filter(move => move.startIdx > metricEnd && move.startIdx <= endIdx).length;
    metricEnd = endIdx; metricTs = metric.cumulativeMs;
    const updated = { ...stage, ...metric, endIdx, turns, tps: metric.executionMs > 0 ? turns / (metric.executionMs / 1000) : null };
    const span = spans.find(item => item.key === stage.key);
    if (span) Object.assign(span, { recognitionMs: updated.recognitionMs, executionMs: updated.executionMs, stepMs: updated.stepMs });
    return updated;
  });
  const humanized = preserveMoves.size === 0 ? countedHumanized
    : humanizeStream(quarterMoves(moves), { ...humanizeOptions, preserveMoves });
  const wasteGroupsFor = (items: WovenItem[]) => items.map(item => {
    const group = wasteSpans.findIndex(span => item.startIdx >= span.fromIdx && item.endIdx <= span.toIdx);
    return group < 0 ? null : group;
  });
  const rotations = humanized.rotations;
  const absorbedRotations = new Set<number>();
  const shownFor = (from: number, to: number): RangeMoveItem[] => (
    moveItemsForRange(moves, humanized.moves, from, to)
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
  const patternHistory = [prevPattern];

  // 这一行的时间窗:上一行最后一手之后 → 自己最后一手为止。第一行往前开口到无穷,
  // 因为起表前后那次「把魔方摆正」属于它。
  let prevEndMs = -Infinity;
  // 时间窗的界和分步分析表用的是同一份规矩(收尾那步开口到无穷),所以共用一个
  // `stepTimeBounds` —— 两边各写一遍迟早会分叉,而分叉的表现是「同一把,文字里
  // 有那次转体、表里没有」。
  const spanEndMs = stepTimeBounds(spans.map(s => s.endIdx), moves);
  if (spans.length && spans.at(-1)!.endIdx < moves.length - 1) {
    spanEndMs[spanEndMs.length - 1] = moves[spans.at(-1)!.endIdx].ts;
  }

  for (const [spanIdx, span] of spans.entries()) {
    const from = prevEnd + 1;
    // 识别用的动作和显示用的动作要分开:转体不是转动,喂给识别器会把局面算错、
    // 把步数撑大。识别永远只看 `turnTokens`。
    const turnTokens = tokensForRange(moves, counted, from, span.endIdx);
    const endMs = spanEndMs[spanIdx];
    const mine = rotations.filter(r => r.tMs > prevEndMs && r.tMs <= endMs);
    const lineMoves = weaveRotations(shownFor(from, span.endIdx), mine, absorbedRotations);
    prevEndMs = endMs;
    const currPattern = await patternFromAlg(alg(phys.scramble, rawUpTo(span.endIdx), viewRot));

    let label: string | null = null;
    try {
      const confirmedLine = confirmedLines.find(line => line.key === span.key);
      if (confirmedLine) {
        label = confirmedLine.label;
      } else if (!isCfop) {
        label = span.label ?? null;
      } else {
        let effectivePrev = prevPattern;
        const prevInfo = await detectStage(prevPattern);
        if (!crossIsDone(prevInfo.stage)) {
          const beforePrevPattern = patternHistory.at(-2) ?? patternHistory[0];
          const beforePrevInfo = await detectStage(beforePrevPattern);
          const isCancelInto = crossIsDone(beforePrevInfo.stage)
            || (await crossFamilyCancelInto(beforePrevInfo, prevPattern)).length > 0;
          if (isCancelInto) {
            const prefix = phys.moves.slice(from, span.endIdx + 1);
            for (let k = 1; k <= prefix.length; k += 1) {
              const through = prefix[k - 1].m;
              const candidate = await patternFromAlg(alg(
                phys.scramble,
                rawUpTo(from - 1),
                prefix.slice(0, k - 1).map(move => move.m).join(' '),
                through,
                viewRot,
              ));
              if (crossIsDone((await detectStage(candidate)).stage)) {
                effectivePrev = candidate;
                break;
              }
            }
          }
        }
        label = firstLabel(await buildCommentSuggestions({
          prevPattern: effectivePrev,
          currPattern,
          // 局面是真颜色的,喂给它的动作也必须是同一系的原始记号。
          lineMovesText: tokensForRange(phys.moves, physCounted, from, span.endIdx).join(' '),
          prevMovesText: prevEnd >= 0 ? rawUpTo(prevEnd) : '',
          moveCount: turnTokens.length,
          explicit: true,
        }));
      }
    } catch (err) {
      console.warn('[recon-text] label failed for', span.key, err);
    }

    label = displayLabel(label);
    lines.push({
      kind: span.kind,
      key: span.key,
      moves: lineMoves.map(item => item.token),
      moveRanges: playbackRanges(lineMoves, moves),
      wasteGroups: wasteGroupsFor(lineMoves),
      fromIdx: from,
      toIdx: span.endIdx,
      label,
      recognitionMs: span.recognitionMs,
      executionMs: span.executionMs,
      stepMs: span.stepMs,
    });

    prevEnd = span.endIdx;
    prevPattern = currPattern;
    patternHistory.push(currPattern);
  }

  // 最后一手之后还有动作(拧过头了、或者切分没走到底)——照实补一行,不丢。
  if (prevEnd < moves.length - 1) {
    const tail = weaveRotations(
      shownFor(prevEnd + 1, moves.length - 1),
      rotations.filter(r => r.tMs > prevEndMs),
      absorbedRotations,
    );
    if (tail.length > 0) {
      lines.push({
        kind: kinds[currentIndex], key: 'tail', stageKey: currentKey, moves: tail.map(item => item.token),
        moveRanges: playbackRanges(tail, moves),
        wasteGroups: wasteGroupsFor(tail),
        fromIdx: prevEnd + 1, toIdx: moves.length - 1,
        label: isCfop ? null : input.language === 'zh' ? currentZh : currentEn,
        recognitionMs: null, executionMs: null, stepMs: null,
      });
    }
  }

  const turns = counted.length;
  const seconds = totalMs / 1000;
  return {
    // 原始打乱 + 观察转体。共轭过的那条只在这个模块内部用(识别、切分),不出门。
    scramble: phys.scramble,
    crossColor: /^([UDFBLR])-cross$/.exec(segs.crossSide ?? '')?.[1],
    methodStages,
    currentStage,
    inspection: viewRot,
    lines,
    turns,
    // 保持合并后的 STM 口径；废步为了展示而展开，不增加原有计数。
    stm: countedHumanized.moves.length,
    seconds,
    tps: seconds > 0 ? turns / seconds : null,
    // 观察那一手是谱子的第一行,不是附注:少了它,原始打乱配下面这些动作对不上。
    text: [
      ...(viewRot === '' ? [] : [`${viewRot} // insp`]),
      ...lines.map(formatReconLine),
    ].join('\n'),
    rotations: rotations.filter(rotation => !absorbedRotations.has(rotation.tMs)),
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

/**
 * Overlay notation that the cuber has personally verified onto the automatic
 * reconstruction. The recording remains authoritative for timestamps,
 * playback ranges and metrics; only the human-facing notation is replaced.
 * A malformed or differently segmented override fails closed.
 */
export function applyReconTextOverride(
  auto: ReconTextResult,
  override: readonly string[] | null | undefined,
): ReconTextResult {
  if (!override || override.length === 0) return auto;
  const lines = override.map(line => line.trim()).filter(Boolean);
  let inspection = auto.inspection;
  let body = lines;
  if (lines.length === auto.lines.length + 1) {
    const marker = lines[0].lastIndexOf('//');
    const label = marker >= 0 ? lines[0].slice(marker + 2).trim() : '';
    const first = /^(?:insp|inspection|观察)$/i.test(label) && !/[\r\n\u2028\u2029]/.test(lines[0].slice(0, marker).trimEnd())
      ? [lines[0], lines[0].slice(0, marker).trimEnd()] : null;
    if (!first || first[1].trim() === '') return auto;
    inspection = first[1].trim();
    body = lines.slice(1);
  }
  if (body.length !== auto.lines.length) return auto;

  const parsed = body.map((raw) => {
    const cut = raw.lastIndexOf('//');
    const movesText = (cut < 0 ? raw : raw.slice(0, cut)).trim();
    const label = cut < 0 ? null : raw.slice(cut + 2).trim() || null;
    const moves = movesText.split(/\s+/).filter(Boolean);
    return moves.length > 0 ? { moves, label } : null;
  });
  if (parsed.some(line => line === null)) return auto;

  return {
    ...auto,
    inspection,
    lines: auto.lines.map((line, i) => ({
      ...line,
      moves: parsed[i]!.moves,
      wasteGroups: undefined,
      algorithmGroups: undefined,
      label: parsed[i]!.label,
    })),
    text: lines.join('\n'),
    presentation: undefined,
  };
}

/** Retain an immutable prefix and bridge only the new suffix into its frame.
 * Exact cubie-state equality rejects a changed gesture instead of silently
 * producing a reconstruction that no longer plays back the recorded solve. */
export async function retainConfirmedRecon(next: ReconTextResult, confirmed?: ReconTextResult): Promise<ReconTextResult> {
  if (!confirmed?.lines.length) return next;
  const end = confirmed.lines.at(-1)!.toIdx;
  const prefix = next.lines.filter(line => line.toIdx <= end);
  if (prefix.at(-1)?.toIdx !== end) throw new Error('Confirmed reconstruction boundary changed');
  const alg = (recon: ReconTextResult, lines: ReconTextLine[]) =>
    [recon.scramble, recon.inspection, ...lines.flatMap(line => line.moves)].join(' ');
  const before = await patternFromAlg(alg(confirmed, confirmed.lines));
  const after = await patternFromAlg(alg(next, prefix));
  const turns = ['', 'x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
  let bridge: string | undefined;
  for (const a of turns) {
    for (const b of turns) {
      const rotation = compactCubeRotations(`${a} ${b}`);
      if (before.applyAlg(rotation).isIdentical(after)) { bridge = rotation; break; }
    }
    if (bridge !== undefined) break;
  }
  if (bridge === undefined) throw new Error('Confirmed reconstruction state changed');
  const tail = next.lines.filter(line => line.fromIdx > end && line.toIdx > end);
  if (tail.length && bridge) {
    const line = tail[0];
    const tokens = bridge.split(' ');
    const first = line.moveRanges?.[0];
    tail[0] = { ...line, moves: [...tokens, ...line.moves],
      moveRanges: first ? [...tokens.map(token => ({ ...first, token, endTs: first.ts,
        startIdx: line.fromIdx, endIdx: line.fromIdx - 1 })), ...line.moveRanges!] : undefined,
      wasteGroups: line.wasteGroups ? [...tokens.map(() => null), ...line.wasteGroups] : undefined,
      algorithmGroups: line.algorithmGroups?.map(group => ({ from: group.from + tokens.length, to: group.to + tokens.length })),
      libraryCorrection: undefined,
    };
  }
  const lines = [...confirmed.lines, ...tail];
  return { ...next, inspection: confirmed.inspection, crossColor: confirmed.crossColor, lines,
    text: [...(confirmed.inspection ? [`${confirmed.inspection} // insp`] : []), ...lines.map(formatReconLine)].join('\n') };
}

import { formattedReconMoves, type ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { htmMoves } from '@cuberoot/shared/timer/reconstruct/htm';
import { tokensForRange } from '@cuberoot/shared/timer/reconstruct/step-metrics';
import type { SolveMove } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { MethodId } from '@cuberoot/shared/timer/reconstruct/methods';
import type { StageAverages, StageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { StepMetricsResult } from '@cuberoot/shared/timer/reconstruct/step-metrics';
import type { F2lSlotsResult } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import type { ReferenceResult, SlotReference } from '@cuberoot/shared/timer/reconstruct/reference';
import type { MethodWalkResult } from '@cuberoot/shared/timer/reconstruct/method-walk';
/** One table column. `chip` is the case / situation label under the heading. */
export interface Col {
  key: string;
  label: string;
  chip: string | null;
  /** Colour band index, so the bar and the heading agree. */
  tone: number;
  recognitionMs: number | null;
  executionMs: number | null;
  stepMs: number | null;
  cumulativeMs: number | null;
  turns: number | null;
  refTurns: number | null;
  /** 参考实际比的那个用户步数。末层是执行步数(不含起手 AUF),其余就是步数格
   *  本身。两者不同的时候必须说出来,否则「7 / 6 / 最优」看着像算错了。 */
  refUserTurns: number | null;
  refDelta: number | null;
  /** The reference line itself, shown under the table beside the sequence. */
  refSolution: string | null;
  /** Personal average for this stage, when there is one. */
  avgMs: number | null;
  skipped: boolean;
  /** Move that finished this step. Null for a step never reached — and for a
   *  free F2L pair, which is what makes its range empty rather than stealing
   *  the previous pair's moves. */
  endIdx: number | null;
}

export function buildCfopColumns(
  segs: StageSegments,
  stepMetrics: StepMetricsResult | null,
  slots: F2lSlotsResult | null,
  reference: ReferenceResult | null,
  slotReference: SlotReference[] | null,
  ao12: StageAverages | null,
): Col[] {
  const step = (k: string) => stepMetrics?.steps.find(s => s.step === k) ?? null;
  const ref = (k: string) => reference?.stages.find(s => s.step === k) ?? null;
  const cols: Col[] = [];

  const cross = step('cross');
  const crossRef = ref('cross');
  cols.push({
    key: 'cross',
    label: 'Cross',
    chip: null,
    tone: 0,
    recognitionMs: cross?.recognitionMs ?? null,
    executionMs: cross?.executionMs ?? null,
    stepMs: cross?.stepMs ?? segs.crossMs,
    cumulativeMs: cross?.cumulativeMs ?? segs.crossDoneMs,
    turns: cross?.turns ?? segs.crossHtm,
    refTurns: crossRef?.refTurns ?? null,
    refUserTurns: crossRef?.userTurns ?? null,
    refDelta: crossRef?.delta ?? null,
    refSolution: crossRef?.refSolution ?? null,
    avgMs: ao12?.crossMs ?? null,
    skipped: cross?.skipped ?? false,
    endIdx: segs.crossEndIdx ?? null,
  });

  if (slots && slots.slots.length > 0) {
    slots.slots.forEach((s, i) => {
      // Positional, not keyed by slot id: `computeF2lSlotReferences` walks the
      // same array in the same order, and two pairs CAN share a slot id only if
      // the walker went wrong — matching by index keeps a mismatch loud.
      const sr = slotReference?.[i] ?? null;
      cols.push({
        key: `slot-${s.slot}`,
        label: `F${i + 1}`,
        chip: null,
        tone: 1,
        recognitionMs: s.recognitionMs,
        executionMs: s.executionMs,
        stepMs: s.stepMs,
        cumulativeMs: s.cumulativeMs,
        turns: s.turns,
        refTurns: sr && sr.slot === s.slot ? sr.refTurns : null,
        refUserTurns: sr && sr.slot === s.slot ? sr.userTurns : null,
        refDelta: sr && sr.slot === s.slot ? sr.delta : null,
        refSolution: sr && sr.slot === s.slot ? sr.refSolution : null,
        avgMs: null,
        skipped: s.free,
        endIdx: s.endIdx,
      });
    });
  } else {
    const f2l = step('f2l');
    const f2lRef = ref('f2l');
    cols.push({
      key: 'f2l',
      label: 'F2L',
      chip: null,
      tone: 1,
      recognitionMs: f2l?.recognitionMs ?? null,
      executionMs: f2l?.executionMs ?? null,
      stepMs: f2l?.stepMs ?? segs.f2lMs,
      cumulativeMs: f2l?.cumulativeMs ?? segs.f2lDoneMs,
      turns: f2l?.turns ?? segs.f2lHtm,
      refTurns: f2lRef?.refTurns ?? null,
      refUserTurns: f2lRef?.userTurns ?? null,
      refDelta: f2lRef?.delta ?? null,
      refSolution: f2lRef?.refSolution ?? null,
      avgMs: ao12?.f2lMs ?? null,
      skipped: f2l?.skipped ?? false,
      endIdx: segs.f2lEndIdx ?? null,
    });
  }

  for (const k of ['oll', 'pll'] as const) {
    const st = step(k);
    const r = ref(k);
    cols.push({
      key: k,
      label: k.toUpperCase(),
      chip: null,
      tone: k === 'oll' ? 2 : 3,
      recognitionMs: st?.recognitionMs ?? null,
      executionMs: st?.executionMs ?? null,
      stepMs: st?.stepMs ?? (k === 'oll' ? segs.ollMs : segs.pllMs),
      cumulativeMs: st?.cumulativeMs ?? (k === 'oll' ? segs.ollDoneMs : segs.solvedMs),
      turns: st?.turns ?? (k === 'oll' ? segs.ollHtm : segs.pllHtm),
      refTurns: r?.refTurns ?? null,
      refUserTurns: r?.userTurns ?? null,
      refDelta: r?.delta ?? null,
      refSolution: r?.refSolution ?? null,
      avgMs: k === 'oll' ? (ao12?.ollMs ?? null) : (ao12?.pllMs ?? null),
      skipped: st?.skipped ?? false,
      endIdx: (k === 'oll' ? segs.ollEndIdx : segs.solvedEndIdx) ?? null,
    });
  }
  return cols;
}

export function buildWalkColumns(walk: MethodWalkResult, isZh: boolean, averages?: Record<string, number>): Col[] {
  return walk.stages.map((s, i) => ({
    key: s.key,
    label: isZh ? s.zh : s.en,
    chip: null,
    tone: i % 4,
    recognitionMs: s.recognitionMs,
    executionMs: s.executionMs,
    stepMs: s.stepMs,
    cumulativeMs: s.cumulativeMs,
    turns: s.turns,
    refTurns: null,
    refUserTurns: null,
    refDelta: null,
    refSolution: null,
    avgMs: averages?.[s.key] ?? null,
    skipped: s.skipped,
    endIdx: s.endIdx,
  }));
}


export function columnTotals(cols: Col[]) {
    let rec = 0, exec = 0, turns = 0, step = 0;
    let anyRec = false, anyTurns = false, anyStep = false;
    let last: number | null = null;
    for (const c of cols) {
      if (c.recognitionMs !== null) { rec += c.recognitionMs; anyRec = true; }
      if (c.executionMs !== null) { exec += c.executionMs; anyRec = true; }
      if (c.turns !== null) { turns += c.turns; anyTurns = true; }
      if (c.stepMs !== null) { step += c.stepMs; anyStep = true; }
      if (c.cumulativeMs !== null) last = c.cumulativeMs;
    }
    const span = rec + exec;
    return {
      rec: anyRec ? rec : null,
      exec: anyRec ? exec : null,
      turns: anyTurns ? turns : null,
      // The step row sums; the cumulative row is a clock reading, not a sum.
      // They differ by the pick-up before the first turn, which is why this is
      // two numbers rather than one printed twice.
      step: anyStep ? step : null,
      last,
      recPct: span > 0 ? Math.round((rec / span) * 100) : null,
      execPct: span > 0 ? Math.round((exec / span) * 100) : null,
    };

}

export function stageAverageDelta(column: Pick<Col, 'stepMs' | 'avgMs'>): number | null {
  return column.avgMs !== null && column.stepMs !== null && column.avgMs > 0
    ? Math.round(((column.stepMs - column.avgMs) / column.avgMs) * 100) : null;
}

export function reportStepSequences(cols: Col[], moves: SolveMove[], method: MethodId, reconLines?: ReconTextLine[]) {

    const out = new Map<string, string[]>();
    if (method !== 'cfop' && reconLines) {
      for (const line of reconLines) {
        const key = line.stageKey ?? line.key;
        out.set(key, [...(out.get(key) ?? []), ...formattedReconMoves(line)]);
      }
      return out;
    }
    if (moves.length === 0) return out;
    const counted = htmMoves(moves);
    let prev = -1;
    for (const c of cols) {
      if (c.endIdx === null) { out.set(c.key, []); continue; }
      out.set(c.key, tokensForRange(moves, counted, prev + 1, c.endIdx));
      prev = c.endIdx;
    }
    return out;
  
}

export function reportTableVisibility(cols: Col[]) {
  return { hasRef:cols.some(c=>c.refTurns !== null), hasAvg:cols.some(c=>c.avgMs !== null && c.stepMs !== null) };
}

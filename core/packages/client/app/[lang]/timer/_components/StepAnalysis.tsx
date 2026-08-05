'use client';

/**
 * Step analysis — the whole solve as one matrix.
 *
 * Replaces the four stage cards. Cards read top-to-bottom, one stage at a time,
 * which is the wrong axis: the question a cuber brings to a report is "WHICH
 * stage cost me the recognition", and answering it from cards means holding
 * four numbers in your head. A matrix answers it by scanning one row.
 *
 * Columns are the stages of the chosen method, plus — for CFOP — F2L opened out
 * into its four pairs, which is where the time actually goes. Rows are the same
 * five numbers for every column, and every column is summed into TOTAL, with
 * recognition and execution also given as a share of the solve.
 *
 * Two rows are conditional, on the same principle: reference turns appear once
 * the search lands, and cube rotations appear only for a solve that recorded an
 * orientation track. Neither renders as a row of dashes when it has nothing to
 * say — an empty row costs the same width as a full one and answers nothing.
 *
 * Method comes from `_lib/reconstruct/methods.ts`. CFOP additionally gets case
 * names and reference lines because that is where the rest of the engine is;
 * the other methods get times and turns, which is everything the walk can
 * honestly produce for them, and no empty cells pretending otherwise.
 *
 * The table scrolls horizontally on its own (`.sa-scroll`), never the page —
 * eight columns do not fit a phone and squeezing them to fit is how you get a
 * table nobody can read.
 */

import { useMemo, useState } from 'react';

import { tr } from '@/i18n/tr';
import type { StageAverages } from '../_lib/reconstruct/stage_segments';
import type { StageSegments } from '../_lib/reconstruct/stage_segments';
import type { StepMetricsResult } from '../_lib/reconstruct/step_metrics';
import { tokensForRange } from '../_lib/reconstruct/step_metrics';
import { htmMoves } from '../_lib/reconstruct/htm';
import type { SolveMove } from '../_lib/reconstruct/stage_segments';
import type { ReferenceResult, SlotReference } from '../_lib/reconstruct/reference';
import { gradeForDelta } from '../_lib/reconstruct/reference';
import type { F2lSlotsResult, F2lStart } from '../_lib/reconstruct/f2l_slots';
import type { MethodWalkResult } from '../_lib/reconstruct/method_walk';
import { METHOD_ORDER, METHODS } from '../_lib/reconstruct/methods';
import type { MethodId } from '../_lib/reconstruct/methods';
import { rotationsByStep, stepTimeBounds } from '../_lib/reconstruct/rotation_detect';

export interface StepAnalysisProps {
  method: MethodId;
  onMethodChange: (m: MethodId) => void;
  /** CFOP-only: the persisted segmentation, for case names and the stage bar. */
  segs: StageSegments | null;
  /** CFOP-only: the four-step recognition/execution split. */
  stepMetrics: StepMetricsResult | null;
  /** CFOP-only: F2L opened into pairs. */
  slots: F2lSlotsResult | null;
  /** CFOP-only: per-stage reference turn counts; null until the search lands. */
  reference: ReferenceResult | null;
  /** CFOP-only: the same question asked per F2L pair — see reference.ts. Lands
   *  with `reference`; the two are computed in the same deferred pass. */
  slotReference: SlotReference[] | null;
  /** Personal stage averages, for the ±% row. CFOP-only (they are CFOP stages). */
  ao12: StageAverages | null;
  /** Any method: the generic walk. Used directly when the method isn't CFOP. */
  walk: MethodWalkResult | null;
  /** The raw turn stream, for the per-step sequences. */
  moves: SolveMove[];
  /**
   * 整体转体(`y` / `x'` / …),从姿态流里推出来的 —— 只有**录了姿态**的把才有。
   *
   * 空 / 不给的时候整行不渲染,而不是渲染一行 `–`:大多数把根本没有这个数,一行占位
   * 的横杠既没信息又占地方(和参考行、ao12 行同一条规矩)。
   */
  rotations?: readonly { tMs: number }[];
  /** Hide the four-block proportion bar. Set when the report is already showing
   *  the per-turn timeline above, which says strictly more (it has the pauses).
   *  Two bars stacked would be the same fact twice — the thing this table exists
   *  to avoid. The bar stays for methods the timeline can't colour. */
  hideBar?: boolean;
  isZh: boolean;
}

/** One table column. `chip` is the case / situation label under the heading. */
interface Col {
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

const sec = (ms: number | null | undefined): string =>
  ms === null || ms === undefined ? '–' : (ms / 1000).toFixed(2);

const num = (n: number | null | undefined): string =>
  n === null || n === undefined ? '–' : String(n);

/** Only the exact reference match gets a badge; negative deltas stay numeric. */
function gradeLabel(): string {
  return tr({ zh: '最优', en: 'Optimal' });
}

function gradeTitle(): string {
  return tr({
    zh: '和参考解法一样短',
    en: 'As short as the reference line',
  });
}

function startLabel(s: F2lStart): string | null {
  switch (s) {
    case 'paired-top':     return tr({ zh: '顶层组好', en: 'paired on top' });
    case 'split-top':      return tr({ zh: '顶层拆开', en: 'split on top' });
    case 'corner-slotted': return tr({ zh: '角已入槽', en: 'corner in slot' });
    case 'edge-slotted':   return tr({ zh: '棱已入槽', en: 'edge in slot' });
    case 'both-slotted':   return tr({ zh: '角棱都在槽里', en: 'both in slot' });
    case 'solved':         return tr({ zh: '白给', en: 'free' });
    case 'unknown':        return null;
  }
}

/** Slot name as the cuber sees it: front-right, back-left … */
function slotLabel(slot: string): string {
  switch (slot) {
    case 'FR': return tr({ zh: '前右', en: 'FR' });
    case 'FL': return tr({ zh: '前左', en: 'FL' });
    case 'BR': return tr({ zh: '后右', en: 'BR' });
    case 'BL': return tr({ zh: '后左', en: 'BL' });
    default:   return slot;
  }
}

function buildCfopColumns(
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
    label: tr({ zh: '十字', en: 'Cross' }),
    chip: segs.crossSide,
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
        label: tr({ zh: `第 ${i + 1} 组`, en: `Slot ${i + 1}` }),
        chip: s.free ? startLabel('solved') : `${slotLabel(s.slot)}${
          startLabel(s.start) ? ` · ${startLabel(s.start)}` : ''}`,
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
      chip: k === 'oll' ? segs.ollCase : segs.pllCase,
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

function buildWalkColumns(walk: MethodWalkResult, isZh: boolean): Col[] {
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
    avgMs: null,
    skipped: s.skipped,
    endIdx: s.endIdx,
  }));
}

export default function StepAnalysis(props: StepAnalysisProps) {
  const { method, onMethodChange, segs, stepMetrics, slots, reference, slotReference, ao12, walk, moves, rotations, hideBar, isZh } = props;
  // Which column is open. One at a time: the sequences are long enough that
  // four of them at once is the wall of text the table exists to avoid.
  const [openKey, setOpenKey] = useState<string | null>(null);

  const cols = useMemo<Col[]>(() => {
    if (method === 'cfop' && segs) {
      return buildCfopColumns(segs, stepMetrics, slots, reference, slotReference, ao12);
    }
    if (walk) return buildWalkColumns(walk, isZh);
    return [];
  }, [method, segs, stepMetrics, slots, reference, slotReference, ao12, walk, isZh]);

  /**
   * 每列几次转体。转体**没有动作下标** —— 它压根不在动作流里,只有时刻,所以列界
   * 也用时刻:第 i 列的界 = 它最后一手的时刻。最后一列的界给 `Infinity`,收尾那次
   * 转体(拧完最后一手之后把魔方摆正)才不会被丢掉。
   *
   * 没走到的步 / 白给的那一对没有 `endIdx`,界就沿用上一列 —— 零宽,分不到东西,
   * 这正是想要的:那一步没发生过。
   */
  const rotCounts = useMemo<number[] | null>(() => {
    if (!rotations || rotations.length === 0 || cols.length === 0) return null;
    const bounds = stepTimeBounds(cols.map(c => c.endIdx), moves);
    return rotationsByStep(rotations, bounds).map(r => r.length);
  }, [rotations, cols, moves]);

  const totals = useMemo(() => {
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
  }, [cols]);

  // Per-step sequences, cut at the same boundaries the numbers use: a step owns
  // `(previous step's last move, its own last move]`. A column with no boundary
  // (never reached, or a free pair) owns nothing, and does not move the cursor
  // on — so the step after it still starts where the last real one ended.
  const sequences = useMemo(() => {
    const out = new Map<string, string[]>();
    if (moves.length === 0) return out;
    const counted = htmMoves(moves);
    let prev = -1;
    for (const c of cols) {
      if (c.endIdx === null) { out.set(c.key, []); continue; }
      out.set(c.key, tokensForRange(moves, counted, prev + 1, c.endIdx));
      prev = c.endIdx;
    }
    return out;
  }, [cols, moves]);

  const openCol = cols.find(c => c.key === openKey) ?? null;

  if (cols.length === 0) return null;

  const barTotal = cols.reduce((n, c) => n + Math.max(0, c.stepMs ?? 0), 0);
  const hasRef = cols.some(c => c.refTurns !== null);
  const hasAvg = cols.some(c => c.avgMs !== null && c.stepMs !== null);

  return (
    <section className="sa">
      <div className="sa-head">
        <h3 className="sa-title">{tr({ zh: '分步分析', en: 'Step analysis' })}</h3>
        <label className="sa-method">
          <select
            className="sa-method-select"
            value={method}
            onChange={(e) => onMethodChange(e.target.value as MethodId)}
            aria-label={tr({ zh: '还原方法', en: 'Method' })}
          >
            {METHOD_ORDER.map(id => (
              <option key={id} value={id}>{isZh ? METHODS[id].zh : METHODS[id].en}</option>
            ))}
          </select>
        </label>
      </div>

      {barTotal > 0 && !hideBar && (
        <div className="sa-bar" role="img" aria-label={tr({ zh: '各步用时占比', en: 'Time per step' })}>
          {cols.map(c => {
            const w = ((c.stepMs ?? 0) / barTotal) * 100;
            if (w <= 0) return null;
            return (
              <span
                key={c.key}
                className="sa-bar-seg"
                data-tone={c.tone}
                style={{ width: `${w}%` }}
                title={`${c.label} ${sec(c.stepMs)}s`}
              />
            );
          })}
        </div>
      )}

      <div className="sa-scroll">
        <table className="sa-table">
          <thead>
            <tr>
              <th scope="col" className="sa-rowhead" />
              {cols.map(c => {
                const seq = sequences.get(c.key) ?? [];
                const open = openKey === c.key;
                return (
                  <th key={c.key} scope="col" data-tone={c.tone} data-open={open ? '' : undefined}>
                    <button
                      type="button"
                      className="sa-col-btn"
                      aria-expanded={open}
                      disabled={seq.length === 0}
                      onClick={() => setOpenKey(open ? null : c.key)}
                      title={seq.length === 0
                        ? undefined
                        : tr({ zh: '看这一步拧了什么', en: 'Show this step’s turns' })}
                    >
                      <span className="sa-col-name">{c.label}</span>
                      {c.chip && <span className="sa-chip">{c.chip}</span>}
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="sa-total-col">{tr({ zh: '合计', en: 'Total' })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="sa-rowhead">{tr({ zh: '识别', en: 'Recognition' })}</th>
              {cols.map(c => <td key={c.key} data-open={openKey === c.key ? '' : undefined}>{sec(c.recognitionMs)}</td>)}
              <td className="sa-total-col">
                {sec(totals.rec)}
                {totals.recPct !== null && <span className="sa-pct">{totals.recPct}%</span>}
              </td>
            </tr>
            <tr>
              <th scope="row" className="sa-rowhead">{tr({ zh: '执行', en: 'Execution' })}</th>
              {cols.map(c => <td key={c.key} data-open={openKey === c.key ? '' : undefined}>{sec(c.executionMs)}</td>)}
              <td className="sa-total-col">
                {sec(totals.exec)}
                {totals.execPct !== null && <span className="sa-pct">{totals.execPct}%</span>}
              </td>
            </tr>
            <tr className="sa-row-strong">
              <th scope="row" className="sa-rowhead">{tr({ zh: '本步', en: 'Step time' })}</th>
              {cols.map(c => (
                <td key={c.key} data-open={openKey === c.key ? '' : undefined}>
                  {c.skipped ? tr({ zh: '跳过', en: 'skip' }) : sec(c.stepMs)}
                </td>
              ))}
              <td className="sa-total-col">{sec(totals.step)}</td>
            </tr>
            <tr>
              <th scope="row" className="sa-rowhead">{tr({ zh: '累计', en: 'Total time' })}</th>
              {cols.map(c => <td key={c.key} data-open={openKey === c.key ? '' : undefined}>{sec(c.cumulativeMs)}</td>)}
              <td className="sa-total-col">{sec(totals.last)}</td>
            </tr>
            <tr>
              <th scope="row" className="sa-rowhead">{tr({ zh: '步数', en: 'Turns' })}</th>
              {cols.map(c => <td key={c.key} data-open={openKey === c.key ? '' : undefined}>{num(c.turns)}</td>)}
              <td className="sa-total-col">{num(totals.turns)}</td>
            </tr>
            {rotCounts && (
              <tr>
                <th scope="row" className="sa-rowhead">{tr({ zh: '转体', en: 'Rotations' })}</th>
                {cols.map((c, i) => (
                  <td key={c.key} data-open={openKey === c.key ? '' : undefined}>{num(rotCounts[i])}</td>
                ))}
                <td className="sa-total-col">{num(rotations?.length ?? null)}</td>
              </tr>
            )}
            {hasRef && (
              <tr className="sa-row-ref">
                <th scope="row" className="sa-rowhead">{tr({ zh: '参考', en: 'Reference' })}</th>
                {cols.map(c => {
                  // A skipped step spent no turns and owes none, so its delta is
                  // 0 — but "you matched the optimum" is not a thing to say
                  // about a pair the scramble handed you. No badge there.
                  const grade = c.skipped || gradeForDelta(c.refDelta) !== 'optimal'
                    ? null
                    : 'optimal';
                  // 末层比的是**去掉起手 AUF 的执行步数**(参考公式本身不含 AUF),
                  // 所以「步数 7 / 参考 6 / 最优」三个格看起来会打架。把比的那个
                  // 数说出来,否则读的人只能猜哪一格错了。
                  const cmp = c.refUserTurns;
                  const mismatch = cmp !== null && c.turns !== null && cmp !== c.turns;
                  return (
                    <td
                      key={c.key}
                      data-open={openKey === c.key ? '' : undefined}
                      title={mismatch
                        ? tr({
                          zh: `比的是执行步数 ${cmp}(不含起手 AUF)—— 参考公式本身没有 AUF`,
                          en: `Compared against ${cmp} execution turns (the leading AUF is excluded — the reference alg has none)`,
                        })
                        : undefined}
                    >
                      {c.refTurns === null ? '–' : (
                        <>
                          {c.refTurns}
                          {grade && (
                            <span className={`sa-grade ${grade}`} title={gradeTitle()}>
                              {gradeLabel()}
                            </span>
                          )}
                          {!grade && c.refDelta !== null && c.refDelta !== 0 && (
                            <span className={`sa-delta ${c.refDelta > 0 ? 'slower' : 'faster'}`}>
                              {c.refDelta > 0 ? '+' : ''}{c.refDelta}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
                {/* Opening F2L into pairs costs the F2L column, and with it the
                    place its reference used to print. The whole-solve figure
                    still lands here, and the per-stage lines are still under
                    「参考解法」 below — so the number is moved, not lost. */}
                <td className="sa-total-col">{reference?.refTurns ?? '–'}</td>
              </tr>
            )}
            {hasAvg && (
              <tr className="sa-row-avg">
                <th scope="row" className="sa-rowhead">{tr({ zh: '对比 ao12', en: 'vs ao12' })}</th>
                {cols.map(c => {
                  const open = openKey === c.key ? '' : undefined;
                  if (c.avgMs === null || c.stepMs === null || c.avgMs <= 0) {
                    return <td key={c.key} data-open={open}>–</td>;
                  }
                  const pct = Math.round(((c.stepMs - c.avgMs) / c.avgMs) * 100);
                  return (
                    <td key={c.key} data-open={open}>
                      <span className={`sa-delta ${pct > 0 ? 'slower' : 'faster'}`}>
                        {pct > 0 ? '+' : ''}{pct}%
                      </span>
                    </td>
                  );
                })}
                <td className="sa-total-col">–</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openCol && (
        <div className="sa-seq">
          <div className="sa-seq-row">
            <span className="sa-seq-label">{openCol.label}</span>
            <span className="sa-seq-moves">{(sequences.get(openCol.key) ?? []).join(' ')}</span>
          </div>
          {/* The reference line right under the cuber's own, because the only
              useful thing to do with "7 turns were available" is to see which
              seven. Absent for a skipped step — there is nothing to compare. */}
          {!openCol.skipped && openCol.refSolution && (
            <div className="sa-seq-row is-ref">
              <span className="sa-seq-label">{tr({ zh: '参考', en: 'Reference' })}</span>
              <span className="sa-seq-moves">{openCol.refSolution}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

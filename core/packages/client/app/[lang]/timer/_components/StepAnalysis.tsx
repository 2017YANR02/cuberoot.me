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
 * Method comes from `_lib/reconstruct/methods.ts`. CFOP additionally gets case
 * names and reference lines because that is where the rest of the engine is;
 * the other methods get times and turns, which is everything the walk can
 * honestly produce for them, and no empty cells pretending otherwise.
 *
 * The table scrolls horizontally on its own (`.sa-scroll`), never the page —
 * eight columns do not fit a phone and squeezing them to fit is how you get a
 * table nobody can read.
 */

import { useMemo } from 'react';

import { tr } from '@/i18n/tr';
import type { StageAverages } from '../_lib/reconstruct/stage_segments';
import type { StageSegments } from '../_lib/reconstruct/stage_segments';
import type { StepMetricsResult } from '../_lib/reconstruct/step_metrics';
import type { ReferenceResult } from '../_lib/reconstruct/reference';
import type { F2lSlotsResult, F2lStart } from '../_lib/reconstruct/f2l_slots';
import type { MethodWalkResult } from '../_lib/reconstruct/method_walk';
import { METHOD_ORDER, METHODS } from '../_lib/reconstruct/methods';
import type { MethodId } from '../_lib/reconstruct/methods';

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
  /** Personal stage averages, for the ±% row. CFOP-only (they are CFOP stages). */
  ao12: StageAverages | null;
  /** Any method: the generic walk. Used directly when the method isn't CFOP. */
  walk: MethodWalkResult | null;
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
  refDelta: number | null;
  /** Personal average for this stage, when there is one. */
  avgMs: number | null;
  skipped: boolean;
}

const sec = (ms: number | null | undefined): string =>
  ms === null || ms === undefined ? '–' : (ms / 1000).toFixed(2);

const num = (n: number | null | undefined): string =>
  n === null || n === undefined ? '–' : String(n);

function startLabel(s: F2lStart): string | null {
  switch (s) {
    case 'paired-top':     return tr({ zh: '顶层配好', en: 'paired on top' });
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
    refDelta: crossRef?.delta ?? null,
    avgMs: ao12?.crossMs ?? null,
    skipped: cross?.skipped ?? false,
  });

  if (slots && slots.slots.length > 0) {
    slots.slots.forEach((s, i) => {
      cols.push({
        key: `slot-${s.slot}`,
        label: tr({ zh: `第 ${i + 1} 对`, en: `Slot ${i + 1}` }),
        chip: s.free ? startLabel('solved') : `${slotLabel(s.slot)}${
          startLabel(s.start) ? ` · ${startLabel(s.start)}` : ''}`,
        tone: 1,
        recognitionMs: s.recognitionMs,
        executionMs: s.executionMs,
        stepMs: s.stepMs,
        cumulativeMs: s.cumulativeMs,
        turns: s.turns,
        refTurns: null,
        refDelta: null,
        avgMs: null,
        skipped: s.free,
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
      refDelta: f2lRef?.delta ?? null,
      avgMs: ao12?.f2lMs ?? null,
      skipped: f2l?.skipped ?? false,
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
      refDelta: r?.delta ?? null,
      avgMs: k === 'oll' ? (ao12?.ollMs ?? null) : (ao12?.pllMs ?? null),
      skipped: st?.skipped ?? false,
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
    refDelta: null,
    avgMs: null,
    skipped: s.skipped,
  }));
}

export default function StepAnalysis(props: StepAnalysisProps) {
  const { method, onMethodChange, segs, stepMetrics, slots, reference, ao12, walk, isZh } = props;

  const cols = useMemo<Col[]>(() => {
    if (method === 'cfop' && segs) return buildCfopColumns(segs, stepMetrics, slots, reference, ao12);
    if (walk) return buildWalkColumns(walk, isZh);
    return [];
  }, [method, segs, stepMetrics, slots, reference, ao12, walk, isZh]);

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

      {barTotal > 0 && (
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
              {cols.map(c => (
                <th key={c.key} scope="col" data-tone={c.tone}>
                  <span className="sa-col-name">{c.label}</span>
                  {c.chip && <span className="sa-chip">{c.chip}</span>}
                </th>
              ))}
              <th scope="col" className="sa-total-col">{tr({ zh: '合计', en: 'Total' })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="sa-rowhead">{tr({ zh: '识别', en: 'Recognition' })}</th>
              {cols.map(c => <td key={c.key}>{sec(c.recognitionMs)}</td>)}
              <td className="sa-total-col">
                {sec(totals.rec)}
                {totals.recPct !== null && <span className="sa-pct">{totals.recPct}%</span>}
              </td>
            </tr>
            <tr>
              <th scope="row" className="sa-rowhead">{tr({ zh: '执行', en: 'Execution' })}</th>
              {cols.map(c => <td key={c.key}>{sec(c.executionMs)}</td>)}
              <td className="sa-total-col">
                {sec(totals.exec)}
                {totals.execPct !== null && <span className="sa-pct">{totals.execPct}%</span>}
              </td>
            </tr>
            <tr className="sa-row-strong">
              <th scope="row" className="sa-rowhead">{tr({ zh: '本步', en: 'Step time' })}</th>
              {cols.map(c => <td key={c.key}>{c.skipped ? tr({ zh: '跳过', en: 'skip' }) : sec(c.stepMs)}</td>)}
              <td className="sa-total-col">{sec(totals.step)}</td>
            </tr>
            <tr>
              <th scope="row" className="sa-rowhead">{tr({ zh: '累计', en: 'Total time' })}</th>
              {cols.map(c => <td key={c.key}>{sec(c.cumulativeMs)}</td>)}
              <td className="sa-total-col">{sec(totals.last)}</td>
            </tr>
            <tr>
              <th scope="row" className="sa-rowhead">{tr({ zh: '步数', en: 'Turns' })}</th>
              {cols.map(c => <td key={c.key}>{num(c.turns)}</td>)}
              <td className="sa-total-col">{num(totals.turns)}</td>
            </tr>
            {hasRef && (
              <tr className="sa-row-ref">
                <th scope="row" className="sa-rowhead">{tr({ zh: '参考', en: 'Reference' })}</th>
                {cols.map(c => (
                  <td key={c.key}>
                    {c.refTurns === null ? '–' : (
                      <>
                        {c.refTurns}
                        {c.refDelta !== null && c.refDelta !== 0 && (
                          <span className={`sa-delta ${c.refDelta > 0 ? 'slower' : 'faster'}`}>
                            {c.refDelta > 0 ? '+' : ''}{c.refDelta}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                ))}
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
                  if (c.avgMs === null || c.stepMs === null || c.avgMs <= 0) {
                    return <td key={c.key}>–</td>;
                  }
                  const pct = Math.round(((c.stepMs - c.avgMs) / c.avgMs) * 100);
                  return (
                    <td key={c.key}>
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
    </section>
  );
}

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

import ReportContent from './ReportContent';
import { reportStepTable, initialReportUI, reduceReportUI } from './report-content';
import { useMemo, useState } from 'react';
import { buildCfopColumns, buildWalkColumns, reportStepSequences, type Col } from './report-columns';

import { useReconstructHost } from './ReconstructHost';
import type { StageAverages } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { StageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { StepMetricsResult } from '@cuberoot/shared/timer/reconstruct/step-metrics';
import type { SolveMove } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { ReferenceResult, SlotReference } from '@cuberoot/shared/timer/reconstruct/reference';
import type { F2lSlotsResult } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import type { MethodWalkResult } from '@cuberoot/shared/timer/reconstruct/method-walk';
import MethodPicker from './MethodPicker';
import { type ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { MethodId } from '@cuberoot/shared/timer/reconstruct/methods';
import { rotationsByStep, stepTimeBounds } from '@cuberoot/shared/timer/reconstruct/rotation-detect';

export interface StepAnalysisProps {
  method: MethodId;
  onMethodChange?: (m: MethodId) => void;
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
  methodAverages?: Record<string, number>;
  reconLines?: ReconTextLine[];
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





export default function StepAnalysis(props: StepAnalysisProps) {
  const { localize: tr } = useReconstructHost();
  const { method, onMethodChange, segs, stepMetrics, slots, reference, slotReference, ao12, walk, moves, rotations, hideBar, isZh } = props;
  // Which column is open. One at a time: the sequences are long enough that
  // four of them at once is the wall of text the table exists to avoid.
  const [ui, setUI] = useState(initialReportUI);

  const cols = useMemo<Col[]>(() => {
    if (method === 'cfop' && segs) {
      return buildCfopColumns(segs, stepMetrics, slots, reference, slotReference, ao12);
    }
    if (walk) return buildWalkColumns(walk, isZh, props.methodAverages);
    return [];
  }, [method, segs, stepMetrics, slots, reference, slotReference, ao12, walk, isZh, tr, props.methodAverages]);

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


  // Per-step sequences, cut at the same boundaries the numbers use: a step owns
  // `(previous step's last move, its own last move]`. A column with no boundary
  // (never reached, or a free pair) owns nothing, and does not move the cursor
  // on — so the step after it still starts where the last real one ended.
  const sequences = useMemo(() => reportStepSequences(cols, moves, method, props.reconLines), [cols, moves, method, props.reconLines]);

  const content=reportStepTable(cols,sequences,rotCounts,reference,method,ui,tr,hideBar);
  return <>
    {onMethodChange && <MethodPicker method={method} onChange={onMethodChange} />}
    <ReportContent node={content} dispatch={action=>setUI(state=>reduceReportUI(state,action))}/>
  </>;
}

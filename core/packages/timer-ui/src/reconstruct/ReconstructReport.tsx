/**
 * ReconstructReport — the post-solve report itself, without a dialog around it.
 *
 * Split out of ReconstructModal (2026-08-02) because the report stopped being a
 * second screen: 成绩详情 now renders it inline, so «查看复盘» is no longer a
 * click you have to know about. Two callers, one report:
 *
 *   SolveModal          — inline, under the solve's own header and actions.
 *   ReconstructModal    — a dialog with nothing in it but this, for the places
 *                         that have no solve to attach to (?replay= deep links)
 *                         or no timer around them (1v1 history).
 *
 * 顺序:**先这把是怎么拧的,再这把拧得怎么样**(2026-08-03 用户提的)。
 *
 *   摘要 — 时间 / STM / TPS,加上读完之后想做的那几件事。
 *   回放 + 还原步骤 — 三维回放和按步写出来的动作(打乱就是还原步骤的第一行)。固定展示,
 *     它是报告的主体。
 *   数据 — 分步分析表。排在后面不是因为不重要,而是
 *     因为它们都在**归因**:不知道自己拧了什么的时候,一张 5×7 的表读不出东西。
 *   参考解法 — 折叠,放在原始动作序列之前。
 *   原始动作序列 — 折叠,收尾。
 *
 * 分区块而不是分标签页(研究文档原本画的是 tab):tab 把内容藏在一次点击**加**一次
 * 选择后面,而这几块常常要对着看。
 *
 * Reference searches and text recognition run in a reusable Web Worker.
 * The main thread renders the basic report while those results arrive.
 *
 * BLD solves keep their own shape: memo/execution split, letter pairs, and no
 * CFOP staging (the walker models a 3x3 speedsolve).
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Solve, EventId } from '@cuberoot/shared/timer';
import type { ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';
import { sliceReconstruction, detectMemoPause } from '@cuberoot/shared/timer/reconstruct/slice';
import { computeStageAverages } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { StepMetricsResult } from '@cuberoot/shared/timer/reconstruct/step-metrics';
import { detectWastedWork } from '@cuberoot/shared/timer/reconstruct/error-detect';
import { walkMethod, detectSolveMethod } from '@cuberoot/shared/timer/reconstruct/method-walk';

import { type GyroSample } from '@cuberoot/shared/smart-cube/gyro-track';
import { applyReconTextOverride, prepareReconstruction, prepareTrainingReconstruction } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { timerSupportsTrainingTiming } from '@cuberoot/shared/timer/training-settings';
import { createLiveReconstructionStream, reconstructionAnalyzer } from './analysis-client';
import type { AnalysisInput, AnalysisSnapshot } from './analysis-protocol';
import StepAnalysis from './StepAnalysis';
import ReportContent from './ReportContent';
import { reportComposition, reportNotationExtras, reportSummary, reportTrainingSummary, reportRawMoves, reportReferences, reportMeta, reportBld, initialReportUI, reduceReportUI, resolveReportSlots } from './report-content';
import { rememberMethodStages, useMethodHistory } from './method-history';
import StepMoveList from './StepMoveList';
import { simplifyF2lRotations } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { reconstructionSummary, trainingCaseHistory, trainingCaseStatistics } from './report-presentation';
import { snapshotReconNotation } from './review-snapshot';
import ReconstructActions from './ReconstructActions';

import { memoize3bld } from '@cuberoot/shared/timer/reconstruct/bld-helper';
import PlaybackPanel from './PlaybackPanel';
import './reconstruct.css';
import { ReconstructHostContext, useReconstructHost, type ReconstructHost } from './ReconstructHost';
export type { ReconstructHost } from './ReconstructHost';

export interface ReconstructReportProps {
  /** Review observes completed default CFOP notation; never writes back to the solve. */
  onReviewSnapshot?: (snapshot: ReconSnapshot | null) => void;
  solve: Solve;
  isZh: boolean;
  /** Recent solves of the same event for personal-average comparison.
   *  When provided and contains at least 5 solves with stageSegments,
   *  per-stage cells render a ±% label vs the user's ao12 / ao100 stage
   *  averages. Excludes the current solve implicitly via id match. */
  history?: Solve[];
  /** Optional callback for the BLD auto-memo "Apply" button. When provided
   *  and the solve is a BLD-class event without a manually-set memoMs, the
   *  report shows an inline hint with the auto-detected value plus a button
   *  that calls back with that ms value. Caller is responsible for writing
   *  the value into solve.bld.memoMs. When omitted, the hint is read-only. */
  onMemoApply?: (ms: number) => void;
  /** Load this solve's scramble into the timer. Omitted where there is no timer
   *  to load it into (the report is also rendered in places that only read).
   *  Closing whatever the report sits in is the CALLER's call — a dialog wants
   *  to dismiss itself, an inline report has nothing to dismiss. */
  onUseScramble?: (scramble: string) => void;
  /** Record whether the reconstruction matched reality. `undefined` clears a
   *  previous answer. Omitted where the solve can't be written back to. */
  onReconFeedback?: (ok: boolean | undefined) => void;
  /** Drop the 日期 cell from the summary row. For containers that already show
   *  the timestamp in their own header — the solve detail page does. */
  hideDate?: boolean;
  /** The inline recap renders these actions beside its full-screen control. */
  hideActions?: boolean;
  /** In-progress move score, using the same segmentation and notation as the report. */
  live?: boolean;
  /** In-progress samples retain their coordinate frame and avoid Base64 encoding. */
  liveGyroSamples?: readonly GyroSample[];
  /** Mirror the current stage from this same analysis stream below the live cube. */
  liveStageTarget?: HTMLElement | null;
}

const BLD_AUTO_DETECT_EVENTS = new Set<EventId>(['333bld', '444bld', '555bld', '333mbld']);
// Events that get a Speffz letter-pair memo panel. Currently 3BLD only —
// 4BLD/5BLD have wings/x-centers/+centers that the 3x3 helper can't handle.
const BLD_MEMO_EVENTS = new Set<EventId>(['333bld', '333ni']);




function ReconstructReportBody({
  solve, isZh, history, onMemoApply, onUseScramble, onReconFeedback, hideDate, hideActions, live = false, liveStageTarget, liveGyroSamples, onReviewSnapshot,
}: ReconstructReportProps) {
  const host = useReconstructHost();
  const { localize: tr } = host;
  const moves = solve.moves ?? [];
  const methodMoves = moves.map(move => move.m).join(' ');
  // Classification uses move order, never elapsed time. Timer ticks must not
  // repeat the orientation search or invalidate the report's method.
  const method = useMemo(() => detectSolveMethod(solve.scramble,
    methodMoves ? methodMoves.split(' ').map((m,ts)=>({m,ts})) : [], 0), [solve.scramble,methodMoves]);
  const slices = useMemo(
    () => sliceReconstruction(moves, solve.timeMs, solve.bld?.memoMs),
    [moves, solve.timeMs, solve.bld?.memoMs],
  );
  const prepared = useMemo(() => prepareReconstruction(solve, method, isZh ? 'zh' : 'en',
    live && liveGyroSamples ? liveGyroSamples.slice() : undefined),
  [solve.scramble, moves, solve.timeMs, solve.gyro, solve.device?.model, method, isZh, live, liveGyroSamples]);
  const { view, stageSegs, stepMx, slots } = prepared;
  // Wasted-work detection (state revisits — see error_detect.ts). Gated the
  // same way: the walker models a 3x3.
  const waste = useMemo(
    () => (stageSegs ? detectWastedWork(solve.scramble, moves) : null),
    [stageSegs, solve.scramble, moves],
  );
  const wastedIdx = useMemo(() => {
    const set = new Set<number>();
    for (const sp of waste?.spans ?? []) {
      for (let i = sp.fromIdx; i <= sp.toIdx; i++) set.add(i);
    }
    return set;
  }, [waste]);

  const scoreable = !live && stepMx !== null && stepMx.putDownMs !== null && solve.penalty !== 'DNF';
  // Reader preference only; changing methods never rewrites the stored solve.
  const analysisInput = useMemo<AnalysisInput | null>(() => prepared.text ? {
    scoreable: scoreable && method === 'cfop', text: prepared.text,
  } : null, [prepared.text, scoreable, method]);
  const [analysisState, setAnalysisState] = useState<{
    solveId: string; input: AnalysisInput; snapshot: AnalysisSnapshot;
  } | null>(null);
  const liveStreamRef = useRef<ReturnType<typeof createLiveReconstructionStream> | null>(null);
  useEffect(() => {
    if (!live) return;
    const stream = createLiveReconstructionStream((input, snapshot) => {
      if (snapshot.text || snapshot.status === 'error') {
        reconstructionAnalyzer.rememberLive(solve.id, input, snapshot);
        setAnalysisState({ solveId: solve.id, input, snapshot });
      }
    });
    liveStreamRef.current = stream;
    return () => { stream.dispose(); liveStreamRef.current = null; };
  }, [live, solve.id]);
  useEffect(() => {
    if (!analysisInput) return;
    if (live) {
      liveStreamRef.current?.update(analysisInput);
      return;
    }
    return reconstructionAnalyzer.subscribe(analysisInput, snapshot => {
      setAnalysisState({ solveId: solve.id, input: analysisInput, snapshot });
    }, solve.id);
  }, [analysisInput, live, solve.id]);
  // Never display the previous solve's result while the new effect subscribes.
  // Live updates retain the latest completed snapshot of this attempt while
  // the worker catches up, rather than flashing an empty list at every turn.
  const analysis = analysisState?.solveId === solve.id && (analysisState.input === analysisInput
    || (live && analysisState.input.text.method === method
      && analysisState.input.text.language === (isZh ? 'zh' : 'en')))
    ? analysisState.snapshot : analysisInput && !live ? reconstructionAnalyzer.peek(analysisInput, solve.id) : null;
  const reconText = useMemo(() => analysis?.text
    ? method === 'cfop' ? applyReconTextOverride(analysis.text, solve.reconstruction) : analysis.text
    : null, [analysis?.text, solve.reconstruction, method]);
  useEffect(() => {
    if (!live && !analysis?.provisional && reconText?.methodStages) rememberMethodStages(solve, method, reconText.methodStages);
  }, [live, analysis?.provisional, reconText?.methodStages, solve, method]);
  const methodAverages = useMethodHistory(method, solve, history, !live && analysis?.status === 'complete');

  // Personal stage averages computed from the caller-provided history.
  // We exclude the current solve so a fresh solve isn't compared against
  // itself. Both windows require at least 5 eligible samples to render
  // — below that the comparison would be too noisy to be useful.
  const stageAvgs = useMemo(() => {
    if (!history || history.length === 0) return null;
    const eligible = history.filter(s => s.id !== solve.id);
    const ao12 = computeStageAverages(eligible, 12);
    const ao100 = computeStageAverages(eligible, 100);
    if (ao12.sampleSize < 5) return null;
    return { ao12, ao100 };
  }, [history, solve.id]);

  const rawWalk = useMemo(
    () => (method === 'cfop' ? null : walkMethod(method, solve.scramble, moves, solve.timeMs, view.rotation)),
    [method, solve.scramble, moves, solve.timeMs, view.rotation],
  );
  const walk = useMemo(() => rawWalk && reconText?.methodStages ? {
    ...rawWalk, stages: reconText.methodStages,
    totalTurns: reconText.methodStages.reduce((sum, stage) => sum + (stage.turns ?? 0), 0),
    totalRecognitionMs: reconText.methodStages.reduce((sum, stage) => sum + (stage.recognitionMs ?? 0), 0),
    totalExecutionMs: reconText.methodStages.reduce((sum, stage) => sum + (stage.executionMs ?? 0), 0),
  } : rawWalk, [rawWalk, reconText?.methodStages]);
  const playbackRecon = useMemo(() => reconText && method === 'cfop'
    ? simplifyF2lRotations(reconText) : reconText, [reconText, method]);
  const playbackLines = playbackRecon?.lines ?? [];
  const reviewSnapshot = useMemo(() => !live && solve.event === '333' && method === 'cfop'
    && analysis?.status === 'complete' && !analysis.provisional && reconText
    ? snapshotReconNotation(reconText) : null, [live, solve.event, method, analysis?.status, analysis?.provisional, reconText]);
  useEffect(() => { onReviewSnapshot?.(reviewSnapshot); }, [onReviewSnapshot, reviewSnapshot]);

  // 回放固定展示；折叠只留给「参考解法」和「原始动作序列」这类附加内容。
  const [reportUI, setReportUI] = useState(initialReportUI);

  const dt = new Date(solve.ts);
  const memoMs = solve.bld?.memoMs;

  // 摘要里的步数按 STM 记:还原步骤上一个中层是一个记号(`S`,不是 `F' B`),读者对着
  // 还原步骤数出来的就该是这个数。文字复盘落地前先拿面转数顶着 —— 两者只差合并掉的
  // 那几对。效率比对和分步分析表仍然按 HTM 数(那边和参考解法比,口径必须一致,
  // 见 `humanize.ts` 头注),所以那张表的步数会比这里多几个。
  const executionMs = useMemo(() => {
    if (method === 'cfop') {
      if (!stepMx) return null;
      return stepMx.steps.reduce((sum, step) => sum + (step.executionMs ?? 0), 0);
    }
    if (!walk) return null;
    return walk.stages.reduce((sum, stage) => sum + (stage.executionMs ?? 0), 0);
  }, [method, stepMx, walk]);
  const { stm: stmCount, tps: stmTps, fluency } = reconstructionSummary(moves, solve.timeMs, reconText, executionMs, memoMs);

  // Auto-detect memo pause for BLD-class solves that haven't had a memoMs
  // set manually. The hint surfaces at the top of the report; user can apply
  // (callback) or just read the value. Skipped entirely once memoMs exists.
  const autoMemoMs = useMemo<number | null>(() => {
    if (memoMs !== undefined && memoMs !== null) return null;
    if (!BLD_AUTO_DETECT_EVENTS.has(solve.event)) return null;
    if (moves.length < 2) return null;
    return detectMemoPause(moves, solve.timeMs);
  }, [memoMs, solve.event, moves, solve.timeMs]);

  // Speffz letter-pair memo (3BLD only). Computed defensively — invalid
  // scrambles (empty / non-3x3 tokens) just yield empty pairs and we hide the
  // panel. Event gate keeps the panel off for non-BLD solves entirely.
  const bldMemo = useMemo(() => {
    if (!BLD_MEMO_EVENTS.has(solve.event)) return null;
    if (!solve.scramble || !solve.scramble.trim()) return null;
    try {
      return memoize3bld(solve.scramble);
    } catch (err) {
      console.warn('[reconstruct] bld memo failed:', err);
      return null;
    }
  }, [solve.event, solve.scramble]);

  if (live) {
    // Use the segmentation belonging to the displayed worker snapshot, so a
    // newer move cannot relabel an older stage while analysis is catching up.
    const currentSegs = analysisState?.solveId === solve.id
      ? analysisState.input.text.segs : stageSegs;
    const stageName = method !== 'cfop' ? reconText?.currentStage ? tr(reconText.currentStage) : '…' : currentSegs?.ollEndIdx != null ? 'PLL'
      : currentSegs?.f2lEndIdx != null ? 'OLL'
        : currentSegs?.crossEndIdx != null
          ? `F2L-${Math.min(4, (reconText?.lines.filter(line => line.kind === 'f2l').length ?? 0) + 1)}`
          : 'Cross';
    // Completed rows stay in the side panel; only the unfinished tail belongs
    // beneath the cube. At a boundary, show the next stage with an empty score.
    const currentMoves = reconText?.lines.find(line => line.key === 'tail')?.moves ?? [];
    return <>
      {liveStageTarget && createPortal(<>
        <div className="timer-live-stage-label">{stageName}</div>
        <div className="sml-moves">{currentMoves.join(' ') || '…'}</div>
      </>, liveStageTarget)}
      {reconText ? (
      <StepMoveList method={method} recon={reconText} reference={null} slotReference={null} />
    ) : (
      <div className="sml-moves" aria-busy={analysis?.status !== 'error'}>
        {moves.map(move => move.m).join(' ')}
      </div>
      )}
    </>;
  }

  /**
   * 数据那一半:分步分析表和阶段补充信息。
   *
   * 摘出来是因为它排在**回放和还原步骤后面**(2026-08-03 用户提的顺序)。以前它是报告
   * 的第一屏,道理是「这把慢在哪」该一眼看到;但那是在假设读者已经知道自己拧了
   * 什么。真实顺序是反的 —— 先认出这把是怎么拧的(回放 + 还原步骤),那些数字才有东西
   * 可归因;先给一张 5×7 的表,读者第一件事仍然是往下翻去找还原步骤。
   */
  const analysisBlock = (
    <>
      {/* 这里以前还有一根 SolveTimeline(带阶段名的那条)。删了:回放那根进度条
          是同一根轴、同一份切分,只是多了个游标 —— 同一件事在一页上画两遍,读者
          第一反应是去找两者的区别。留下的是回放那根,并给它补上阶段名和阶段用时
          (2026-08-03 用户提的)。 */}

      {(stageSegs || walk) && memoMs === undefined && (
        <StepAnalysis
          method={method}
          segs={stageSegs}
          stepMetrics={stepMx}
          slots={slots}
          reference={analysis?.reference ?? null}
          slotReference={analysis?.slotReference ?? null}
          ao12={stageAvgs?.ao12 ?? null}
          walk={walk}
          methodAverages={methodAverages}
          reconLines={reconText?.lines}
          moves={moves}
          // 转体和还原步骤里那些是同一份 —— 表里数的和文字里写的必须是一回事。
          rotations={reconText?.rotations ?? []}
          // 有文字复盘时,阶段条由回放那根带游标的轴负责(同一份切分),这里不再
          // 画第二根;切不出还原步骤的那些把留着它,否则一根都没有。
          hideBar={playbackLines.length > 0}
          isZh={isZh}
        />
      )}
      {stageSegs && memoMs === undefined && method === 'cfop' && (
        <StageMetaLine
          stepMetrics={stepMx}
          inspectionMs={solve.inspectionMs ?? null}
        />
      )}
    </>
  );

  const extras=reportNotationExtras(solve,playbackRecon,initialReportUI(solve.reconOk),tr,{recordGyro:host.recordGyro,canEnableGyro:Boolean(host.onEnableGyro),canFeedback:Boolean(onReconFeedback)});
  const composition=reportComposition({solve,recon:reconText,analysis:analysis??null,hasAnalysis:Boolean(analysisInput),scoreable,state:reportUI,tr,
    hideActions,hasTable:Boolean(stageSegs||walk),hasMeta:false,autoMemoMs,hasBldMemo:Boolean(bldMemo)});
  const document=resolveReportSlots(composition,{
    summary:reportSummary(solve,{stm:stmCount,tps:stmTps,fluency},tr,hideDate?undefined:{short:dt.toLocaleDateString(),full:dt.toLocaleString()}),
    'raw-list':reportRawMoves(solve,wastedIdx,tr),
    'reference-list':analysis?.reference?reportReferences(analysis.reference,tr):null,
    ...reportBld(solve,autoMemoMs,bldMemo,slices.executionMs,Boolean(onMemoApply),tr),
  });
  return <ReportContent node={document} dispatch={action=>{
    setReportUI(state=>reduceReportUI(state,action));
    if(action.type==='memo')onMemoApply?.(Number(action.value));
  }} slots={{
    actions:<ReconstructActions host={host} solve={solve} onUseScramble={onUseScramble} placement="report" snapshot={reviewSnapshot}/>,
    analysis:analysisBlock,
    playback:<PlaybackPanel
          method={method}
          event={solve.event}
          scramble={solve.scramble}
          moves={moves}
          viewRotation={view.rotation}
          inspection={playbackRecon?.inspection}
          totalMs={solve.timeMs}
          isZh={isZh}
          lines={playbackLines}
          rotations={reconText?.rotations}
          gyro={solve.gyro ?? null}
          deviceModel={solve.device?.model ?? null}
          side={playbackRecon ? ({ idx, playFrom }) => (
            <StepMoveList
              method={method}
              recon={reconText}
              reference={analysis?.reference ?? null}
              slotReference={analysis?.slotReference ?? null}
              currentIdx={idx}
              onSeek={playFrom}
              notice={<ReportContent node={extras.notice} dispatch={()=>host.onEnableGyro?.()}/>}
              feedback={<ReportContent node={extras.feedback} dispatch={action=>onReconFeedback?.(reduceReportUI(initialReportUI(solve.reconOk),action).feedback??undefined)}/>}
            />
          ) : undefined}
        />,
  }}/>;
}



/** 0-100 with its three components. Pending renders the same row with dashes
 *  so the report doesn't jump when the search lands. */
/** Where a stage's reference came from — the honesty label. */
/** The reference line for each stage, with the move sequence — the depth layer
 *  where "6 turns were available" becomes "and here they are". */

/**
 * The solve-level line the step table has no column for: inspection and
 * put-down. Everything here is about the WHOLE solve rather than one step,
 * which is exactly why it sits outside the table instead of being squeezed
 * into a TOTAL cell.
 */
function StageMetaLine({
  stepMetrics, inspectionMs,
}: {
  stepMetrics: StepMetricsResult | null;
  inspectionMs: number | null;
}) {
  const {localize:tr}=useReconstructHost();
  return <ReportContent node={stepMetrics?reportMeta(inspectionMs,stepMetrics.putDownMs,tr):null} dispatch={()=>{}}/>;
}

/** Dedicated training report. It never mounts the full-solve analyzer or method history. */
function TrainingReportBody({ solve, isZh, history, onUseScramble, onReconFeedback, hideActions,
  live = false, liveStageTarget, liveGyroSamples }: ReconstructReportProps) {
  const host = useReconstructHost();
  const { localize: tr } = host;
  const prepared = useMemo(() => prepareTrainingReconstruction(solve, isZh ? 'zh' : 'en',
    liveGyroSamples?.slice(), live), [solve, isZh, liveGyroSamples, live]);
  const { recon, view, metrics } = prepared;
  const statistics = useMemo(() => live ? null : trainingCaseStatistics(trainingCaseHistory(history ?? [], solve)
    .map(item => prepareTrainingReconstruction(item, 'en').metrics)), [history, solve, live]);
  const [ui, setUI] = useState(initialReportUI);
  if (live) return <>
    {liveStageTarget && createPortal(<>
      <div className="timer-live-stage-label">{recon.currentStage && tr(recon.currentStage)}</div>
      <div className="sml-moves">{recon.lines.find(line => line.key === recon.currentStage?.key)?.moves.join(' ') || '…'}</div>
    </>, liveStageTarget)}
    <StepMoveList method="training" recon={recon} reference={null} slotReference={null} />
  </>;
  const extras = reportNotationExtras(solve, recon, initialReportUI(solve.reconOk), tr, {
    recordGyro: host.recordGyro, canEnableGyro: Boolean(host.onEnableGyro), canFeedback: Boolean(onReconFeedback),
  });
  const composition = reportComposition({ solve, recon, analysis: null, hasAnalysis: false, scoreable: false,
    state: ui, tr, hideActions, hasTable: false, hasMeta: false, autoMemoMs: null, hasBldMemo: false, trainingSummary: true });
  const document = resolveReportSlots(composition, {
    'training-summary': reportTrainingSummary(solve, metrics, statistics, tr),
    'raw-list': reportRawMoves(solve, new Set(), tr),
  });
  return <ReportContent node={document} dispatch={action => setUI(state => reduceReportUI(state, action))} slots={{
    actions: <ReconstructActions host={host} solve={solve} onUseScramble={onUseScramble} placement="report" />,
    playback: <PlaybackPanel method="training" event={solve.event} scramble={solve.scramble} moves={solve.moves ?? []}
      viewRotation={view.rotation} totalMs={solve.timeMs} isZh={isZh} lines={recon.lines} rotations={recon.rotations}
      gyro={solve.gyro ?? null} deviceModel={solve.device?.model ?? null}
      side={({ idx, playFrom }) => <StepMoveList method="training" recon={recon} reference={null} slotReference={null}
        currentIdx={idx} onSeek={playFrom}
        notice={<ReportContent node={extras.notice} dispatch={() => host.onEnableGyro?.()} />}
        feedback={<ReportContent node={extras.feedback} dispatch={action => onReconFeedback?.(
          reduceReportUI(initialReportUI(solve.reconOk), action).feedback ?? undefined)} />} />} />,
  }} />;
}

/** Full shared report; only clipboard, settings and public URL construction are host-owned. */
export default function ReconstructReport({ host, ...props }: ReconstructReportProps & { host: ReconstructHost }) {
  return <ReconstructHostContext.Provider value={host}>{timerSupportsTrainingTiming(props.solve.event)
    ? <TrainingReportBody {...props} /> : <ReconstructReportBody {...props} />}</ReconstructHostContext.Provider>;
}
